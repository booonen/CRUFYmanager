import type { Calendar } from '../domain/calendar';
import { advanceBlockers, progressBlockers } from '../engine/calendar';
import { t } from '../lang';
import type { SpineActionResult } from './competitions';
import { useSavefileStore } from './savefile';

export function useCalendar(): Calendar | null {
  return useSavefileStore((s) => s.savefile?.calendar ?? null);
}

/**
 * Time only moves over published ground: the current matchday cannot advance
 * (or jump) while any round on the days being passed has unpublished results.
 */
export function advanceMatchday(): SpineActionResult {
  const sf = useSavefileStore.getState().savefile;
  if (!sf) return { ok: false, message: 'no savefile' };
  if (sf.calendar.currentMatchday >= sf.calendar.matchdaysPerSeason) {
    return { ok: false, message: t('calendar.seasonEnd') };
  }
  const blockers = advanceBlockers(sf);
  if (blockers.length > 0) {
    return { ok: false, message: t('calendar.advanceBlocked', { count: blockers.length, md: sf.calendar.currentMatchday }) };
  }
  useSavefileStore.getState().updateSavefile((current) => ({
    ...current,
    calendar: {
      ...current.calendar,
      currentMatchday: Math.min(current.calendar.currentMatchday + 1, current.calendar.matchdaysPerSeason),
    },
  }));
  return { ok: true };
}

export function setCurrentMatchday(matchday: number): SpineActionResult {
  const sf = useSavefileStore.getState().savefile;
  if (!sf) return { ok: false, message: 'no savefile' };
  if (matchday < sf.calendar.currentMatchday) {
    return { ok: false, message: t('calendar.noTimeTravel') };
  }
  if (matchday > sf.calendar.matchdaysPerSeason) {
    return { ok: false, message: t('calendar.seasonEnd') };
  }
  const blockers = progressBlockers(sf, matchday);
  if (blockers.length > 0) {
    return { ok: false, message: t('calendar.advanceBlocked', { count: blockers.length, md: sf.calendar.currentMatchday }) };
  }
  useSavefileStore.getState().updateSavefile((current) => ({
    ...current,
    calendar: { ...current.calendar, currentMatchday: matchday },
  }));
  return { ok: true };
}
