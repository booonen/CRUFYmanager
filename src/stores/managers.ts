import type { Manager } from '../domain/manager';
import { useSavefileStore } from './savefile';

export function useManagers(): Manager[] {
  return useSavefileStore((s) => s.savefile?.managers ?? []);
}
