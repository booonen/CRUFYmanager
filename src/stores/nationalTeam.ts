import type { NationalTeam } from '../domain/nationalTeam';
import { useSavefileStore } from './savefile';

export function useNationalTeam(): NationalTeam | null {
  return useSavefileStore((s) => s.savefile?.nationalTeam ?? null);
}
