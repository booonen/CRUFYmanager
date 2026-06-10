import { describe, expect, it } from 'vitest';
import { matchdayIndex, unscheduledRounds } from './calendar';
import { SpineGuardError, addCompetition, setRoundMatchday } from './mutate';
import { adHocEntries, getComp, mkSave, setUp } from './testkit';

const leagueSpec = (n: number) => ({
  name: 'League',
  shortName: 'L',
  preset: { kind: 'league' as const, legs: 1 as const },
  entries: adHocEntries(n),
});

describe('cross-competition calendar', () => {
  it('new competitions land on consecutive matchdays from the current one', () => {
    const { sf, competitionId } = setUp(leagueSpec(6)); // 5 rounds, current MD = 1
    const stage = getComp(sf, competitionId).sportEvents[0]?.stages[0];
    expect(stage?.rounds.map((r) => r.calendarMatchday)).toEqual([1, 2, 3, 4, 5]);
  });

  it('two competitions stack on the same matchdays and the index sees both', () => {
    const first = setUp(leagueSpec(6));
    const { savefile: sf } = addCompetition(first.sf, {
      ...leagueSpec(4),
      name: 'Cup-ish',
      shortName: 'C',
    });
    const onMd1 = matchdayIndex(sf).get(1) ?? [];
    expect(onMd1).toHaveLength(2);
    expect(new Set(onMd1.map((e) => e.competition.shortName))).toEqual(new Set(['L', 'C']));
  });

  it('rounds past the season end stay unscheduled and are reported', () => {
    const base = mkSave(); // 10 matchdays per season
    const { savefile: sf } = addCompetition(base, leagueSpec(12)); // 11 rounds
    const unscheduled = unscheduledRounds(sf);
    expect(unscheduled).toHaveLength(1);
    expect(unscheduled[0]?.round.index).toBe(10);
  });

  it('rounds can be moved to another matchday (or unscheduled), within bounds', () => {
    const { sf, competitionId } = setUp(leagueSpec(4));
    const comp = getComp(sf, competitionId);
    const event = comp.sportEvents[0];
    const stage = event?.stages[0];
    const round = stage?.rounds[0];
    if (!event || !stage || !round) throw new Error('structure missing');
    const ref = { competitionId, eventId: event.id, stageId: stage.id, roundId: round.id };

    let next = setRoundMatchday(sf, ref, 7);
    expect(matchdayIndex(next).get(7)?.[0]?.round.id).toBe(round.id);
    next = setRoundMatchday(next, ref, null);
    expect(unscheduledRounds(next)).toHaveLength(1);
    expect(() => setRoundMatchday(next, ref, 99)).toThrow(SpineGuardError);
  });
});
