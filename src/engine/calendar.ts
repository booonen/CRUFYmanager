import type { Savefile } from '../domain/savefile';
import type { Competition, Round, SportEvent, Stage } from '../domain/spine';

/** One competition-round sitting on a global matchday. */
export interface CalendarSlotEntry {
  competition: Competition;
  event: SportEvent;
  stage: Stage;
  stageIndex: number;
  round: Round;
}

/**
 * The cross-competition calendar lens: which rounds sit on which global
 * matchday. Pure derivation over the savefile — placement lives on the rounds.
 */
export function matchdayIndex(sf: Savefile): Map<number, CalendarSlotEntry[]> {
  const out = new Map<number, CalendarSlotEntry[]>();
  for (const competition of sf.competitions) {
    for (const event of competition.sportEvents) {
      event.stages.forEach((stage, stageIndex) => {
        for (const round of stage.rounds) {
          if (round.calendarMatchday === null) continue;
          const list = out.get(round.calendarMatchday) ?? [];
          list.push({ competition, event, stage, stageIndex, round });
          out.set(round.calendarMatchday, list);
        }
      });
    }
  }
  return out;
}

/** Rounds that never made it onto the calendar (overflow or manual unscheduling). */
export function unscheduledRounds(sf: Savefile): CalendarSlotEntry[] {
  const out: CalendarSlotEntry[] = [];
  for (const competition of sf.competitions) {
    for (const event of competition.sportEvents) {
      event.stages.forEach((stage, stageIndex) => {
        for (const round of stage.rounds) {
          if (round.calendarMatchday === null) {
            out.push({ competition, event, stage, stageIndex, round });
          }
        }
      });
    }
  }
  return out;
}
