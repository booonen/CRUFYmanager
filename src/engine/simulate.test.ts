import { describe, expect, it } from 'vitest';
import { DEFAULT_SIM_PARAMS } from '../domain/scorination';
import {
  simFixture,
  simInputForFixture,
  simRoundEmpties,
  upsertBonus,
  setScore,
  type FixtureRef,
} from './mutate';
import { bonusAt, simInputsDigest, simulateMatch, type SimMatchInput } from './simulate';
import { adHocEntries, getComp, refFor, setUp } from './testkit';

const input = (over?: Partial<SimMatchInput>): SimMatchInput => ({
  homeRating: 15,
  awayRating: 15,
  homeStyle: 0,
  awayStyle: 0,
  ratingMax: 30,
  params: { ...DEFAULT_SIM_PARAMS },
  knockout: false,
  ...over,
});

function distribution(matchInput: SimMatchInput, n = 1000) {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let goals = 0;
  for (let i = 0; i < n; i++) {
    const out = simulateMatch(matchInput, `seed-${i}`);
    goals += out.home + out.away;
    if (out.home > out.away) homeWins += 1;
    else if (out.home < out.away) awayWins += 1;
    else draws += 1;
  }
  return { homeWins: homeWins / n, draws: draws / n, awayWins: awayWins / n, avgGoals: goals / n };
}

describe('outcome calibration (defaults)', () => {
  it('equals: symmetric wins, believable draw rate, sane goal volume', () => {
    const d = distribution(input());
    expect(d.draws).toBeGreaterThan(0.2);
    expect(d.draws).toBeLessThan(0.32);
    expect(Math.abs(d.homeWins - d.awayWins)).toBeLessThan(0.08);
    expect(d.avgGoals).toBeGreaterThan(2.2);
    expect(d.avgGoals).toBeLessThan(3.2);
  });

  it('a 20%-of-scale favorite wins roughly two of three', () => {
    const d = distribution(input({ homeRating: 21, awayRating: 15 }));
    expect(d.homeWins).toBeGreaterThan(0.55);
    expect(d.homeWins).toBeLessThan(0.75);
    expect(d.awayWins).toBeLessThan(0.22);
  });

  it('a half-scale gap is near-decisive but never a lock', () => {
    const d = distribution(input({ homeRating: 27, awayRating: 12 }));
    expect(d.homeWins).toBeGreaterThan(0.78);
    expect(d.homeWins).toBeLessThan(0.97);
    expect(d.awayWins).toBeGreaterThan(0.005);
  });

  it('chaos widens upsets', () => {
    const calm = distribution(input({ homeRating: 24, awayRating: 12, params: { ...DEFAULT_SIM_PARAMS, chaos: 0.02 } }));
    const wild = distribution(input({ homeRating: 24, awayRating: 12, params: { ...DEFAULT_SIM_PARAMS, chaos: 0.35 } }));
    expect(wild.awayWins).toBeGreaterThan(calm.awayWins);
  });
});

describe('scale invariance (zero-anchored)', () => {
  it('ratings, bonuses, and ratingMax scaled together ⇒ identical scores for identical seeds', () => {
    for (let i = 0; i < 50; i++) {
      const seed = `inv-${i}`;
      const a = simulateMatch(input({ homeRating: 18.4, awayRating: 11.2, ratingMax: 30 }), seed);
      const b = simulateMatch(
        input({ homeRating: 18.4 * 3.37, awayRating: 11.2 * 3.37, ratingMax: 30 * 3.37 }),
        seed,
      );
      expect(b).toEqual(a);
    }
  });

  it('knockout sims always resolve', () => {
    for (let i = 0; i < 300; i++) {
      const out = simulateMatch(input({ knockout: true }), `ko-${i}`);
      if (out.home === out.away) {
        expect(out.decidedBy).toBe('shootout');
        expect(out.shootout).not.toBeNull();
        const [sh, sa] = out.shootout ?? [0, 0];
        expect(sh).not.toBe(sa);
      } else {
        expect(['regulation', 'extra-time']).toContain(out.decidedBy);
      }
    }
  });
});

describe('style modifiers (volume only, never winner/GD)', () => {
  it('same seed: any style combination preserves winner and goal difference', () => {
    for (let i = 0; i < 120; i++) {
      const seed = `style-${i}`;
      const base = simulateMatch(input({ homeRating: 19, awayRating: 13 }), seed);
      const spicy = simulateMatch(input({ homeRating: 19, awayRating: 13, homeStyle: 5, awayStyle: 4 }), seed);
      const drab = simulateMatch(input({ homeRating: 19, awayRating: 13, homeStyle: -5, awayStyle: -4 }), seed);
      expect(spicy.home - spicy.away).toBe(base.home - base.away);
      expect(drab.home - drab.away).toBe(base.home - base.away);
      expect(Math.min(spicy.home, spicy.away)).toBeGreaterThanOrEqual(0);
      expect(Math.min(drab.home, drab.away)).toBeGreaterThanOrEqual(0);
    }
  });

  it('positive style inflates goal volume, negative deflates it', () => {
    let spicyGoals = 0;
    let baseGoals = 0;
    let drabGoals = 0;
    for (let i = 0; i < 600; i++) {
      const seed = `vol-${i}`;
      const b = simulateMatch(input(), seed);
      const s2 = simulateMatch(input({ homeStyle: 5, awayStyle: 5 }), seed);
      const d = simulateMatch(input({ homeStyle: -5, awayStyle: -5 }), seed);
      baseGoals += b.home + b.away;
      spicyGoals += s2.home + s2.away;
      drabGoals += d.home + d.away;
    }
    expect(spicyGoals).toBeGreaterThan(baseGoals + 600); // ≳1 extra goal per match
    expect(drabGoals).toBeLessThan(baseGoals);
  });

  it('zero combined style changes nothing at all', () => {
    for (let i = 0; i < 60; i++) {
      const seed = `zero-${i}`;
      expect(simulateMatch(input({ homeStyle: 2.5, awayStyle: -2.5 }), seed)).toEqual(
        simulateMatch(input(), seed),
      );
    }
  });

  it('style feeds the inputs digest', () => {
    expect(simInputsDigest(input({ homeStyle: 1 }))).not.toBe(simInputsDigest(input()));
  });
});

describe('bonus ledger semantics', () => {
  const entry = (bonus: { matchday: number | null; value: number }[]) => ({
    id: 'e1',
    participant: { kind: 'ad-hoc' as const, name: 'X', shortCode: 'X' },
    seeding: 10,
    bonus: bonus.map((b, i) => ({ id: `b${i}`, matchday: b.matchday, value: b.value, note: '' })),
    styleMod: 0,
  });

  it('latest value with matchday ≤ at wins; null is the baseline', () => {
    const e = entry([
      { matchday: null, value: 1 },
      { matchday: 3, value: 4 },
      { matchday: 5, value: 2.5 },
    ]);
    expect(bonusAt(e, 1)).toBe(1);
    expect(bonusAt(e, 3)).toBe(4);
    expect(bonusAt(e, 4)).toBe(4);
    expect(bonusAt(e, 7)).toBe(2.5);
    expect(bonusAt(e, null)).toBe(2.5); // unscheduled rounds use the latest
    expect(bonusAt(entry([]), 9)).toBe(0);
  });
});

describe('sim integration (savefile level)', () => {
  const leagueSetup = () => {
    const { sf, competitionId } = setUp({
      name: 'Sim League',
      shortName: 'SL',
      preset: { kind: 'league', legs: 1 },
      entries: adHocEntries(4),
    });
    const comp = getComp(sf, competitionId);
    const event = comp.sportEvents[0];
    const stage = event?.stages[0];
    const round = stage?.rounds[0];
    const fixture = round?.fixtures[0];
    if (!event || !stage || !round || !fixture) throw new Error('structure missing');
    const ref: FixtureRef = refFor(sf, competitionId, stage, round, fixture);
    return { sf, competitionId, event, ref, roundRef: { ...ref } };
  };

  const payloadOf = (sf: ReturnType<typeof leagueSetup>['sf'], ref: FixtureRef) => {
    const fx = getComp(sf, ref.competitionId)
      .sportEvents.find((e) => e.id === ref.eventId)
      ?.stages.find((s) => s.id === ref.stageId)
      ?.rounds.find((r) => r.id === ref.roundId)
      ?.fixtures.find((f) => f.id === ref.fixtureId);
    if (!fx?.result) throw new Error('no result');
    return fx.result;
  };

  it('sim writes a draft with seed + digest; replaying the stored seed reproduces it; re-roll changes the seed', () => {
    const { sf, ref } = leagueSetup();
    const once = simFixture(sf, ref);
    const result = payloadOf(once, ref);
    expect(result.provenance.method).toBe('sim');
    expect(result.lifecycle.status).toBe('draft');
    expect(result.provenance.seed).toBeTruthy();
    expect(result.provenance.inputsDigest).toBe(simInputsDigest(simInputForFixture(once, ref)));

    // Replay: same seed + same inputs ⇒ same score.
    const replayed = simulateMatch(simInputForFixture(once, ref), result.provenance.seed ?? '');
    expect(result.payload.family === 'score' && result.payload.score).toEqual([
      replayed.home,
      replayed.away,
    ]);

    const rerolled = payloadOf(simFixture(once, ref), ref);
    expect(rerolled.provenance.seed).not.toBe(result.provenance.seed);
  });

  it('digest drifts when inputs change after the roll (bonus fed in later)', () => {
    const { sf, ref } = leagueSetup();
    const once = simFixture(sf, ref);
    const stored = payloadOf(once, ref).provenance.inputsDigest;
    const homeEntryId = payloadOf(once, ref).competitors[0] ?? '';
    const drifted = upsertBonus(once, ref, homeEntryId, { matchday: null, value: 2, note: 'late RP' });
    expect(simInputsDigest(simInputForFixture(drifted, ref))).not.toBe(stored);
  });

  it('bonus shifts outcomes across many seeds', () => {
    const { sf, ref } = leagueSetup();
    const homeId = (() => {
      const fx = getComp(sf, ref.competitionId).sportEvents[0]?.stages[0]?.rounds[0]?.fixtures[0];
      return fx?.homeEntryId ?? '';
    })();
    const base = simInputForFixture(sf, ref);
    const boosted = simInputForFixture(
      upsertBonus(sf, ref, homeId, { matchday: null, value: 1.5, note: '' }),
      ref,
    );
    let baseWins = 0;
    let boostedWins = 0;
    for (let i = 0; i < 600; i++) {
      if (simulateMatch(base, `b-${i}`).home > simulateMatch(base, `b-${i}`).away) baseWins += 1;
      const out = simulateMatch(boosted, `b-${i}`);
      if (out.home > out.away) boostedWins += 1;
    }
    expect(boostedWins).toBeGreaterThan(baseWins);
  });

  it('Sim round fills only untouched fixtures', () => {
    const { sf, ref, roundRef } = leagueSetup();
    const manual = setScore(sf, ref, { home: 9, away: 9, decidedBy: 'regulation', shootout: null });
    const simmed = simRoundEmpties(manual, roundRef);
    const kept = payloadOf(simmed, ref);
    expect(kept.provenance.method).toBe('manual');
    expect(kept.payload.family === 'score' && kept.payload.score).toEqual([9, 9]);
    const round = getComp(simmed, ref.competitionId).sportEvents[0]?.stages[0]?.rounds[0];
    expect(round?.fixtures.every((fx) => fx.result !== null)).toBe(true);
  });
});
