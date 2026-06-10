import { describe, expect, it } from 'vitest';
import { setScore } from './mutate';
import { adHocEntries, fillStage, getComp, rankOf, refFor, setUp } from './testkit';

const koSpec = (n: number, legs: 1 | 2, awayGoals = false) => ({
  name: 'Test Cup',
  shortName: 'TC',
  preset: { kind: 'knockout' as const, legs, thirdPlace: true, awayGoals, pairing: 'ranked' as const },
  entries: adHocEntries(n),
});

describe('knockout brackets', () => {
  it('8 entries, single leg: seeds placed so 1 and 2 can only meet in the final', () => {
    const { sf, competitionId } = setUp(koSpec(8, 1));
    const stage = getComp(sf, competitionId).sportEvents[0]?.stages[0];
    const qf = stage?.rounds[0];
    expect(qf?.fixtures).toHaveLength(4);
    const pairs = (qf?.fixtures ?? []).map((fx) => [
      rankOf(sf, competitionId, fx.homeEntryId ?? ''),
      rankOf(sf, competitionId, fx.awayEntryId ?? ''),
    ]);
    expect(pairs).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });

  it('plays through: winners propagate, semifinal losers land in the third-place match', () => {
    const { sf, competitionId } = setUp(koSpec(8, 1));
    const played = fillStage(sf, competitionId, 0); // better rank always wins
    const stage = getComp(played, competitionId).sportEvents[0]?.stages[0];
    const rounds = stage?.rounds ?? [];
    expect(rounds.map((r) => r.fixtures.length)).toEqual([4, 2, 1, 1]); // QF, SF, 3rd, F
    const third = rounds[2]?.fixtures[0];
    const final = rounds[3]?.fixtures[0];
    expect(
      [third?.homeEntryId, third?.awayEntryId].map((id) => rankOf(played, competitionId, id ?? '')).sort(),
    ).toEqual([3, 4]);
    expect(
      [final?.homeEntryId, final?.awayEntryId].map((id) => rankOf(played, competitionId, id ?? '')).sort(),
    ).toEqual([1, 2]);
  });

  it('a drawn knockout match without a decider leaves the tie unresolved; a shootout resolves it', () => {
    const { sf, competitionId } = setUp(koSpec(4, 1));
    let current = sf;
    const comp = () => getComp(current, competitionId).sportEvents[0]?.stages[0];
    const stage0 = comp();
    const sfRound = stage0?.rounds[0];
    const fx0 = sfRound?.fixtures[0];
    if (!stage0 || !sfRound || !fx0) throw new Error('structure missing');

    current = setScore(current, refFor(current, competitionId, stage0, sfRound, fx0), {
      home: 1,
      away: 1,
      decidedBy: 'regulation',
      shootout: null,
    });
    let finalFx = comp()?.rounds.at(-1)?.fixtures[0];
    expect(finalFx?.homeEntryId).toBeNull(); // undecided tie feeds nothing

    current = setScore(current, refFor(current, competitionId, stage0, sfRound, fx0), {
      home: 1,
      away: 1,
      decidedBy: 'shootout',
      shootout: [3, 4],
    });
    finalFx = comp()?.rounds.at(-1)?.fixtures[0];
    const awayId = sfRound.fixtures[0]?.awayEntryId;
    expect(finalFx?.homeEntryId).toBe(awayId); // shootout winner advanced
  });

  it('6 entries pad to 8 with byes for the top seeds, which auto-advance', () => {
    const { sf, competitionId } = setUp(koSpec(6, 1));
    const stage = getComp(sf, competitionId).sportEvents[0]?.stages[0];
    const r1 = stage?.rounds[0];
    const byes = (r1?.fixtures ?? []).filter((fx) => fx.isBye);
    expect(byes).toHaveLength(2);
    expect(byes.map((fx) => rankOf(sf, competitionId, fx.homeEntryId ?? '')).sort()).toEqual([1, 2]);
    // Byes auto-advance without a result:
    const semis = stage?.rounds[1];
    const semiOccupants = (semis?.fixtures ?? [])
      .flatMap((fx) => [fx.homeEntryId, fx.awayEntryId])
      .filter((id): id is string => id !== null)
      .map((id) => rankOf(sf, competitionId, id));
    expect(semiOccupants.sort()).toEqual([1, 2]);
  });

  it('two-leg ties: aggregate decides; away goals only when toggled on', () => {
    const play = (awayGoals: boolean) => {
      const { sf, competitionId } = setUp(koSpec(4, 2, awayGoals));
      let current = sf;
      const stage = () => getComp(current, competitionId).sportEvents[0]?.stages[0];
      const s0 = stage();
      const leg1 = s0?.rounds[0];
      const leg2 = s0?.rounds[1];
      const tie0leg1 = leg1?.fixtures[0];
      const tie0leg2 = leg2?.fixtures.find((fx) => fx.tieId === tie0leg1?.tieId);
      if (!s0 || !leg1 || !leg2 || !tie0leg1 || !tie0leg2) throw new Error('structure missing');

      // Tie home (seed 1) wins leg 1 at home 2-1; loses leg 2 away 0-1.
      // Aggregate 2-2. Away goals: tie-away scored 1 away, tie-home scored 0 away.
      current = setScore(current, refFor(current, competitionId, s0, leg1, tie0leg1), {
        home: 2,
        away: 1,
        decidedBy: 'regulation',
        shootout: null,
      });
      current = setScore(current, refFor(current, competitionId, s0, leg2, tie0leg2), {
        home: 1,
        away: 0,
        decidedBy: 'regulation',
        shootout: null,
      });
      const finalRound = stage()?.rounds.at(-1);
      return { homeSlot: finalRound?.fixtures[0]?.homeEntryId ?? null, current, competitionId, tie0leg1 };
    };

    const withoutAwayGoals = play(false);
    expect(withoutAwayGoals.homeSlot).toBeNull(); // 2-2 aggregate, undecided

    const withAwayGoals = play(true);
    expect(withAwayGoals.homeSlot).toBe(withAwayGoals.tie0leg1.awayEntryId); // away side through
  });
});
