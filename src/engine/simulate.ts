import type { SimParams } from '../domain/scorination';
import type { Entry, ScoreDecidedBy, SportEvent } from '../domain/spine';
import { makeRng, normal, poisson, type Rng } from './rng';

export const ENGINE_VERSION = 'fb-1';

/**
 * Host-fed bonus in effect at a matchday: the latest ledger value with
 * matchday ≤ at (null matchday = baseline, applies from the start).
 */
export function bonusAt(entry: Entry, atMatchday: number | null): number {
  let best: { md: number; value: number } | null = null;
  for (const b of entry.bonus) {
    const md = b.matchday ?? -1;
    if (atMatchday !== null && md > atMatchday) continue;
    if (!best || md >= best.md) best = { md, value: b.value };
  }
  return best?.value ?? 0;
}

/** Zero-anchored scale top (phase-3 Q2): host-provided or highest seeding. */
export function eventRatingMax(event: SportEvent): number {
  if (event.ratingMax !== null && event.ratingMax > 0) return event.ratingMax;
  const max = Math.max(0, ...event.entries.map((e) => e.seeding));
  return max > 0 ? max : 1;
}

export interface SimMatchInput {
  homeRating: number; // effective: seeding + bonus
  awayRating: number;
  /** Style modifiers (−5…+5 each); their sum shifts goal volume, never winner/GD. */
  homeStyle: number;
  awayStyle: number;
  ratingMax: number;
  params: SimParams;
  knockout: boolean; // sims must resolve: ET then shootout
}

export interface SimMatchOutput {
  home: number;
  away: number;
  decidedBy: ScoreDecidedBy;
  shootout: [number, number] | null;
}

function goalShare(input: SimMatchInput, rng: Rng): number {
  const { params } = input;
  const gap =
    (input.homeRating - input.awayRating) / input.ratingMax + params.homeEdge + normal(rng) * params.chaos;
  return 1 / (1 + Math.exp(-params.favoritism * gap));
}

function shootout(input: SimMatchInput, rng: Rng): [number, number] {
  // Slight edge for the stronger side, capped at 60/40 per kick.
  const gap = (input.homeRating - input.awayRating) / input.ratingMax;
  const pHome = Math.min(0.6, Math.max(0.4, 0.5 + gap * 0.1)) + 0.25; // ~0.65–0.85 per kick
  const pAway = 0.75;
  let home = 0;
  let away = 0;
  for (let kick = 0; kick < 5; kick++) {
    if (rng() < pHome) home += 1;
    if (rng() < pAway) away += 1;
  }
  while (home === away) {
    if (rng() < pHome) home += 1;
    if (rng() < pAway) away += 1;
  }
  return [home, away];
}

/**
 * Combined style shifts both scores by the same amount (goal volume only):
 * positive style adds mutual goals, negative removes them — capped so the
 * loser never drops below zero. Winner and GD are untouched by construction.
 */
function applyStyle(input: SimMatchInput, rng: Rng, home: number, away: number): [number, number] {
  const combined = input.homeStyle + input.awayStyle;
  const impact = Math.max(0, input.params.styleImpact);
  if (combined > 0) {
    const extra = poisson(rng, combined * impact);
    return [home + extra, away + extra];
  }
  if (combined < 0) {
    const removed = Math.min(Math.min(home, away), poisson(rng, -combined * impact));
    return [home - removed, away - removed];
  }
  return [home, away];
}

/** Pure, fully seeded outcome sim. Same seed + same inputs ⇒ same output. */
export function simulateMatch(input: SimMatchInput, seed: string): SimMatchOutput {
  const rng = makeRng(seed);
  const share = goalShare(input, rng);
  const lambdaTotal = Math.max(0.2, input.params.goalsPerMatch);
  let home = poisson(rng, lambdaTotal * share);
  let away = poisson(rng, lambdaTotal * (1 - share));

  if (!input.knockout || home !== away) {
    [home, away] = applyStyle(input, rng, home, away);
    return { home, away, decidedBy: 'regulation', shootout: null };
  }

  // Extra time: a third of regulation's expectancy.
  const etHome = poisson(rng, (lambdaTotal / 3) * share);
  const etAway = poisson(rng, (lambdaTotal / 3) * (1 - share));
  home += etHome;
  away += etAway;
  if (home !== away) {
    [home, away] = applyStyle(input, rng, home, away);
    return { home, away, decidedBy: 'extra-time', shootout: null };
  }
  [home, away] = applyStyle(input, rng, home, away);
  return { home, away, decidedBy: 'shootout', shootout: shootout(input, rng) };
}

/**
 * Digest of everything that fed a sim — stored on the result so replays can
 * warn when inputs drifted since the roll. djb2 over a stable string.
 */
export function simInputsDigest(input: SimMatchInput): string {
  const s = [
    ENGINE_VERSION,
    input.homeRating,
    input.awayRating,
    input.homeStyle,
    input.awayStyle,
    input.ratingMax,
    input.knockout ? 'ko' : 'rr',
    input.params.goalsPerMatch,
    input.params.chaos,
    input.params.favoritism,
    input.params.homeEdge,
    input.params.styleImpact,
  ].join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
