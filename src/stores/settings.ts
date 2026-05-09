import type { UserSettings } from '../domain/settings';
import { useSavefileStore } from './savefile';

export function useSettings(): UserSettings | null {
  return useSavefileStore((s) => s.savefile?.settings ?? null);
}

export function updateSettings(updater: (current: UserSettings) => UserSettings): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    settings: updater(sf.settings),
  }));
}
