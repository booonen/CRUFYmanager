import type { Competition } from '../domain/competition';
import { useSavefileStore } from './savefile';

export function useCompetitions(): Competition[] {
  return useSavefileStore((s) => s.savefile?.competitions ?? []);
}
