import type { Savefile } from '../domain/savefile';
import type { Competition, Round, SportEvent, Stage } from '../domain/spine';

export type RoundStatus = 'empty' | 'partial' | 'complete' | 'published';

export function roundStatus(round: Round): RoundStatus {
  const playable = round.fixtures.filter((fx) => !fx.isBye);
  if (playable.length === 0) return 'complete';
  const withResult = playable.filter((fx) => fx.result !== null);
  if (withResult.length === 0) return 'empty';
  if (withResult.length < playable.length) return 'partial';
  return playable.every((fx) => fx.result?.lifecycle.status === 'published') ? 'published' : 'complete';
}

export const STATUS_GLYPH: Record<RoundStatus, string> = {
  empty: '○',
  partial: '◐',
  complete: '●',
  published: '✓',
};

/** "MD4" for matchday-style stages, the round's own name for knockout rounds. */
export function compactRoundLabel(stage: Stage, round: Round): string {
  return stage.format.kind === 'league' || stage.format.kind === 'groups'
    ? `MD${round.index + 1}`
    : round.name;
}

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

/**
 * Rounds standing in the way of moving the current matchday to `targetMd`:
 * every round on a day in [currentMatchday, targetMd) must be fully published
 * (playable fixtures all have published results) before time moves past it.
 */
export function progressBlockers(sf: Savefile, targetMd: number): CalendarSlotEntry[] {
  const index = matchdayIndex(sf);
  const out: CalendarSlotEntry[] = [];
  for (let md = sf.calendar.currentMatchday; md < targetMd; md++) {
    for (const entry of index.get(md) ?? []) {
      const playable = entry.round.fixtures.filter((fx) => !fx.isBye);
      if (playable.length === 0) continue;
      if (roundStatus(entry.round) !== 'published') out.push(entry);
    }
  }
  return out;
}

/** Blockers for a plain "advance by one" (the common case). */
export function advanceBlockers(sf: Savefile): CalendarSlotEntry[] {
  return progressBlockers(sf, sf.calendar.currentMatchday + 1);
}
