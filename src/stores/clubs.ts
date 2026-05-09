import type { Club } from '../domain/club';
import { useSavefileStore } from './savefile';

export function useClubs(): Club[] {
  return useSavefileStore((s) => s.savefile?.clubs ?? []);
}
