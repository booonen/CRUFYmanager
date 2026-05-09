import type { Calendar } from '../domain/calendar';
import { useSavefileStore } from './savefile';

export function useCalendar(): Calendar | null {
  return useSavefileStore((s) => s.savefile?.calendar ?? null);
}
