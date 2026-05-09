import type { ForeignWorld } from '../domain/foreignWorld';
import { useSavefileStore } from './savefile';

export function useForeignWorld(): ForeignWorld | null {
  return useSavefileStore((s) => s.savefile?.foreignWorld ?? null);
}
