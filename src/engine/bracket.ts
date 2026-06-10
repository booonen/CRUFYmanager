import type { BracketTie, Fixture, Stage, TieFeed } from '../domain/spine';

export interface TieResolution {
  winnerEntryId: string;
  loserEntryId: string | null; // null for byes
}

function fixturesOfTie(stage: Stage, tieId: string): Fixture[] {
  const out: Fixture[] = [];
  for (const round of stage.rounds) {
    for (const fx of round.fixtures) {
      if (fx.tieId === tieId) out.push(fx);
    }
  }
  return out.sort((a, b) => (a.leg ?? 1) - (b.leg ?? 1));
}

/**
 * Resolves a knockout tie from its fixtures. Single leg: score decides; a level
 * score needs a shootout (KO draws without a decider stay unresolved). Two legs:
 * aggregate, then (optionally) away goals, then the second leg's shootout.
 */
export function resolveTie(stage: Stage, tie: BracketTie, awayGoals: boolean): TieResolution | null {
  const fixtures = fixturesOfTie(stage, tie.id);
  const first = fixtures[0];
  if (!first) return null;

  if (tie.home.kind === 'bye' || tie.away.kind === 'bye') {
    const survivor = tie.home.kind === 'bye' ? first.awayEntryId : first.homeEntryId;
    return survivor ? { winnerEntryId: survivor, loserEntryId: null } : null;
  }

  const home = first.homeEntryId;
  const away = first.awayEntryId;
  if (!home || !away) return null;

  if (fixtures.length === 1) {
    const result = first.result;
    if (!result || result.payload.family !== 'score') return null;
    const [hg, ag] = result.payload.score;
    if (hg !== ag) {
      return hg > ag
        ? { winnerEntryId: home, loserEntryId: away }
        : { winnerEntryId: away, loserEntryId: home };
    }
    if (result.payload.decidedBy === 'shootout' && result.payload.shootout) {
      const [hs, as] = result.payload.shootout;
      if (hs === as) return null;
      return hs > as
        ? { winnerEntryId: home, loserEntryId: away }
        : { winnerEntryId: away, loserEntryId: home };
    }
    return null;
  }

  // Two legs: leg 2 has home/away swapped.
  const leg1 = fixtures[0];
  const leg2 = fixtures[1];
  if (!leg1?.result || !leg2?.result) return null;
  if (leg1.result.payload.family !== 'score' || leg2.result.payload.family !== 'score') return null;
  const [l1h, l1a] = leg1.result.payload.score;
  const [l2h, l2a] = leg2.result.payload.score;

  const homeAggregate = l1h + l2a; // tie-home plays away in leg 2
  const awayAggregate = l1a + l2h;
  if (homeAggregate !== awayAggregate) {
    return homeAggregate > awayAggregate
      ? { winnerEntryId: home, loserEntryId: away }
      : { winnerEntryId: away, loserEntryId: home };
  }
  if (awayGoals) {
    const homeAwayGoals = l2a;
    const awayAwayGoals = l1a;
    if (homeAwayGoals !== awayAwayGoals) {
      return homeAwayGoals > awayAwayGoals
        ? { winnerEntryId: home, loserEntryId: away }
        : { winnerEntryId: away, loserEntryId: home };
    }
  }
  if (leg2.result.payload.decidedBy === 'shootout' && leg2.result.payload.shootout) {
    const [s2h, s2a] = leg2.result.payload.shootout;
    if (s2h !== s2a) {
      // Leg-2 home is the tie's away side.
      return s2h > s2a
        ? { winnerEntryId: away, loserEntryId: home }
        : { winnerEntryId: home, loserEntryId: away };
    }
  }
  return null;
}

export type ExternalFeedResolver = (feed: TieFeed) => string | null;

export interface PropagationOutcome {
  stage: Stage;
  resolutions: Map<string, TieResolution>;
  /** tieId → [home, away] expected occupants (null = not yet determinable). */
  expected: Map<string, [string | null, string | null]>;
}

/**
 * Resolves feeds phase by phase and writes occupants into fixtures that have no
 * result yet (an existing result's pairing is never disturbed — integrity checks
 * surface contradictions on published results instead). Feeds are never rewritten;
 * resolution is recomputed on every reflow, so upstream edits flow downstream.
 */
export function propagateBracket(
  stage: Stage,
  awayGoals: boolean,
  resolveExternal: ExternalFeedResolver,
): PropagationOutcome {
  if (!stage.bracket) return { stage, resolutions: new Map(), expected: new Map() };

  let working = stage;
  const resolutions = new Map<string, TieResolution>();
  const expected = new Map<string, [string | null, string | null]>();
  const ties = [...stage.bracket.ties].sort((a, b) => a.phase - b.phase || a.slot - b.slot);

  const resolveFeed = (feed: TieFeed): string | null => {
    switch (feed.kind) {
      case 'entry':
        return feed.entryId;
      case 'bye':
      case 'tbd':
        return null;
      case 'winner-of':
        return resolutions.get(feed.tieId)?.winnerEntryId ?? null;
      case 'loser-of':
        return resolutions.get(feed.tieId)?.loserEntryId ?? null;
      case 'seed':
      case 'group-qualifier':
        return resolveExternal(feed);
    }
  };

  for (const tie of ties) {
    const homeEntry = resolveFeed(tie.home);
    const awayEntry = resolveFeed(tie.away);
    expected.set(tie.id, [homeEntry, awayEntry]);

    working = {
      ...working,
      rounds: working.rounds.map((round) => ({
        ...round,
        fixtures: round.fixtures.map((fx) => {
          if (fx.tieId !== tie.id || fx.result !== null) return fx;
          // Never blank an occupant on an unresolved feed — stale slots stay visible
          // and integrity checks flag published contradictions.
          const home = (fx.leg === 2 ? awayEntry : homeEntry) ?? fx.homeEntryId;
          const away = (fx.leg === 2 ? homeEntry : awayEntry) ?? fx.awayEntryId;
          if (fx.homeEntryId === home && fx.awayEntryId === away) return fx;
          return { ...fx, homeEntryId: home, awayEntryId: away };
        }),
      })),
    };

    const resolution = resolveTie(working, tie, awayGoals);
    if (resolution) resolutions.set(tie.id, resolution);
  }

  return { stage: working, resolutions, expected };
}
