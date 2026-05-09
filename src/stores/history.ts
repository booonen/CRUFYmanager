import type { HistoryArchive } from '../domain/history';
import { useSavefileStore } from './savefile';

export function useHistory(): HistoryArchive | null {
  return useSavefileStore((s) => s.savefile?.history ?? null);
}
