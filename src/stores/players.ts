import type { Player } from '../domain/player';
import { useSavefileStore } from './savefile';

export function usePlayers(): Player[] {
  return useSavefileStore((s) => s.savefile?.players ?? []);
}
