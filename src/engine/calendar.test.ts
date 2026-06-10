import { describe, expect, it } from 'vitest';
import type { Savefile } from '../domain/savefile';
import { advanceBlockers, matchdayIndex, progressBlockers, unscheduledRounds } from './calendar';
import { SpineGuardError, addCompetition, publishRound, setRoundMatchday } from './mutate';
import { adHocEntries, fillStage, getComp, mkSave, setUp } from './testkit';

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

  it('advance is blocked by unpublished results and cleared by publishing', () => {
    const { sf, competitionId } = setUp(leagueSpec(4)); // 3 rounds on MD 1–3
    // An unplayed round blocks too — the day's programme isn't published yet.
    expect(advanceBlockers(sf)).toHaveLength(1);

    let current = fillStage(sf, competitionId, 0);
    // All rounds complete but unpublished: MD1's round blocks the advance.
    expect(advanceBlockers(current).map((b) => b.round.index)).toEqual([0]);
    // Jumping to MD3 is blocked by both MD1 and MD2 rounds.
    expect(progressBlockers(current, 3)).toHaveLength(2);

    const comp = getComp(current, competitionId);
    const event = comp.sportEvents[0];
    const stage = event?.stages[0];
    const md1 = stage?.rounds[0];
    if (!event || !stage || !md1) throw new Error('structure missing');
    current = publishRound(current, {
      competitionId,
      eventId: event.id,
      stageId: stage.id,
      roundId: md1.id,
    });
    expect(advanceBlockers(current)).toHaveLength(0);
    expect(progressBlockers(current, 3)).toHaveLength(1); // MD2 still unpublished
  });

  it('the past is locked: no scheduling into it, no moving rounds out of it', () => {
    const { sf, competitionId } = setUp(leagueSpec(6)); // 5 rounds on MD 1–5
    const later: Savefile = { ...sf, calendar: { ...sf.calendar, currentMatchday: 3 } };
    const comp = getComp(later, competitionId);
    const event = comp.sportEvents[0];
    const stage = event?.stages[0];
    const pastRound = stage?.rounds[0]; // MD1
    const futureRound = stage?.rounds[3]; // MD4
    if (!event || !stage || !pastRound || !futureRound) throw new Error('structure missing');
    const refOf = (roundId: string) => ({
      competitionId,
      eventId: event.id,
      stageId: stage.id,
      roundId,
    });

    expect(() => setRoundMatchday(later, refOf(pastRound.id), 5)).toThrow(SpineGuardError);
    expect(() => setRoundMatchday(later, refOf(pastRound.id), null)).toThrow(SpineGuardError);
    expect(() => setRoundMatchday(later, refOf(futureRound.id), 2)).toThrow(SpineGuardError);
    // Today and the future remain fair game.
    expect(() => setRoundMatchday(later, refOf(futureRound.id), 3)).not.toThrow();
    expect(() => setRoundMatchday(later, refOf(futureRound.id), 5)).not.toThrow();
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
