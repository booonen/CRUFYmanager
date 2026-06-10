import type { Calendar } from '../domain/calendar';
import { useSavefileStore } from './savefile';

export function useCalendar(): Calendar | null {
  return useSavefileStore((s) => s.savefile?.calendar ?? null);
}

export function setCurrentMatchday(matchday: number): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    calendar: {
      ...sf.calendar,
      currentMatchday: Math.min(Math.max(1, matchday), sf.calendar.matchdaysPerSeason),
    },
  }));
}

export function advanceMatchday(): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    calendar: {
      ...sf.calendar,
      currentMatchday: Math.min(sf.calendar.currentMatchday + 1, sf.calendar.matchdaysPerSeason),
    },
  }));
}
