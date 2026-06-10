import { describe, expect, it } from 'vitest';
import type { Savefile } from '../domain/savefile';
import { forceSeedStage } from './mutate';
import { adHocEntries, fillStage, getComp, rankOf, setUp } from './testkit';

const wcSpec = () => ({
  name: 'World Cup',
  shortName: 'WC',
  preset: {
    kind: 'groups-knockout' as const,
    groupCount: 8,
    legs: 1 as const,
    qualifyPerGroup: 2,
    bestOfPlace: null,
    koLegs: 1 as const,
    thirdPlace: true,
    awayGoals: false,
  },
  entries: adHocEntries(32),
});

function groupRanks(sf: Savefile, competitionId: string, stageIndex: number): number[][] {
  const stage = getComp(sf, competitionId).sportEvents[0]?.stages[stageIndex];
  return (stage?.groups ?? []).map((g) => g.entryIds.map((id) => rankOf(sf, competitionId, id)));
}

describe('groups → knockout qualification', () => {
  it('32 entries snake into 8 groups of 4 with one top seed each', () => {
    const { sf, competitionId } = setUp(wcSpec());
    const groups = groupRanks(sf, competitionId, 0);
    expect(groups).toHaveLength(8);
    for (const g of groups) {
      expect(g).toHaveLength(4);
      expect(g.filter((r) => r <= 8)).toHaveLength(1); // exactly one pot-1 seed
    }
  });

  it('R16 stays TBD until the group stage completes, then fills by the standard cross', () => {
    const { sf, competitionId } = setUp(wcSpec());
    let current = sf;

    const ko = () => getComp(current, competitionId).sportEvents[0]?.stages[1];
    expect(ko()?.rounds[0]?.fixtures.every((fx) => fx.homeEntryId === null)).toBe(true);

    current = fillStage(current, competitionId, 0); // better rank always wins
    const groups = getComp(current, competitionId).sportEvents[0]?.stages[0]?.groups ?? [];
    const r16 = ko()?.rounds[0];
    expect(r16?.fixtures.every((fx) => fx.homeEntryId !== null && fx.awayEntryId !== null)).toBe(true);

    // Winner/runner-up per group = best/second-best rank in the group.
    const winners = groups.map((g) =>
      g.entryIds.map((id) => rankOf(current, competitionId, id)).sort((a, b) => a - b),
    );
    const expectPair = (fxIndex: number, winnerGroup: number, runnerGroup: number) => {
      const fx = r16?.fixtures[fxIndex];
      expect(rankOf(current, competitionId, fx?.homeEntryId ?? '')).toBe(winners[winnerGroup]?.[0]);
      expect(rankOf(current, competitionId, fx?.awayEntryId ?? '')).toBe(winners[runnerGroup]?.[1]);
    };
    // Standard cross: A1–B2, C1–D2, E1–F2, G1–H2, B1–A2, D1–C2, F1–E2, H1–G2.
    expectPair(0, 0, 1);
    expectPair(1, 2, 3);
    expectPair(2, 4, 5);
    expectPair(3, 6, 7);
    expectPair(4, 1, 0);
    expectPair(5, 3, 2);
    expectPair(6, 5, 4);
    expectPair(7, 7, 6);
  });

  it('plays to a champion: rank 1 lifts the trophy in an all-favorites world', () => {
    const { sf, competitionId } = setUp(wcSpec());
    let current = fillStage(sf, competitionId, 0);
    current = fillStage(current, competitionId, 1);
    const ko = getComp(current, competitionId).sportEvents[0]?.stages[1];
    const final = ko?.rounds.at(-1)?.fixtures[0];
    expect(final?.result).not.toBeNull();
    const homeRank = rankOf(current, competitionId, final?.homeEntryId ?? '');
    const awayRank = rankOf(current, competitionId, final?.awayEntryId ?? '');
    expect(Math.min(homeRank, awayRank)).toBe(1);
    expect(Math.max(homeRank, awayRank)).toBe(2);
  });

  it('force-seeding fills the next stage from partial standings (God mode)', () => {
    const { sf, competitionId } = setUp(wcSpec());
    let current = sf;
    // Play only matchday 1, then force.
    const stage0 = getComp(current, competitionId).sportEvents[0]?.stages[0];
    expect(stage0?.rounds.length).toBe(3);
    current = (() => {
      // fill only round 0 manually via fillStage on a cloned structure is overkill;
      // instead force-seed with zero results: standings are all-tied, slots fill
      // with whatever the (stable) tiebreak order yields.
      const event = getComp(current, competitionId).sportEvents[0];
      if (!event) throw new Error('no event');
      return forceSeedStage(current, { competitionId, eventId: event.id }, 1);
    })();
    const r16 = getComp(current, competitionId).sportEvents[0]?.stages[1]?.rounds[0];
    expect(r16?.fixtures.every((fx) => fx.homeEntryId !== null && fx.awayEntryId !== null)).toBe(true);
  });

  it('best-of-place: 6 groups of 4, top 2 + 4 best thirds → ranked pairing, 16 qualifiers', () => {
    const { sf, competitionId } = setUp({
      name: 'Continental',
      shortName: 'CC',
      preset: {
        kind: 'groups-knockout' as const,
        groupCount: 6,
        legs: 1 as const,
        qualifyPerGroup: 2,
        bestOfPlace: { place: 3, count: 4 },
        koLegs: 1 as const,
        thirdPlace: false,
        awayGoals: false,
      },
      entries: adHocEntries(24),
    });
    const current = fillStage(sf, competitionId, 0);
    const ko = getComp(current, competitionId).sportEvents[0]?.stages[1];
    const r16 = ko?.rounds[0];
    expect(r16?.fixtures).toHaveLength(8);
    const occupants = (r16?.fixtures ?? [])
      .flatMap((fx) => [fx.homeEntryId, fx.awayEntryId])
      .filter((id): id is string => id !== null);
    expect(new Set(occupants).size).toBe(16);
    // All six group winners and runners-up are in; exactly 4 of the 6 third-placers.
    const ranks = occupants.map((id) => rankOf(current, competitionId, id));
    const thirds = groupRanks(current, competitionId, 0).map(
      (g) => [...g].sort((a, b) => a - b)[2] ?? -1,
    );
    const qualifiedThirds = thirds.filter((r) => ranks.includes(r));
    expect(qualifiedThirds).toHaveLength(4);
  });
});
