import { create } from 'zustand';
import {
  createSaveSlot,
  deleteSaveSlot,
  flushPendingSave,
  getActiveSaveId,
  listSaveSlots,
  loadSaveSlot,
  renameSaveSlot,
  scheduleSave,
  setActiveSaveId,
} from '../db/persistence';
import type { Savefile, SaveSlotSummary } from '../domain/savefile';
import { createBlankSavefile, type NewSavefileInput } from '../domain/factory';
import { parseSavefile } from '../utils/jsonIO';

export type SavefileStatus = 'idle' | 'loading' | 'ready' | 'no-save' | 'error';

interface SavefileStoreState {
  status: SavefileStatus;
  errorMessage: string | null;
  activeSaveId: string | null;
  savefile: Savefile | null;
  slots: SaveSlotSummary[];

  hydrate: () => Promise<void>;
  refreshSlots: () => Promise<void>;

  createSavefile: (input: NewSavefileInput) => Promise<string>;
  switchTo: (saveId: string) => Promise<void>;
  deleteSlot: (saveId: string) => Promise<void>;
  renameSlot: (saveId: string, newName: string) => Promise<void>;
  importFromJson: (jsonText: string) => Promise<string>;
  flushNow: () => Promise<void>;

  updateSavefile: (updater: (current: Savefile) => Savefile) => void;
}

export const useSavefileStore = create<SavefileStoreState>((set, get) => ({
  status: 'idle',
  errorMessage: null,
  activeSaveId: null,
  savefile: null,
  slots: [],

  hydrate: async () => {
    set({ status: 'loading', errorMessage: null });
    try {
      const [activeId, slots] = await Promise.all([getActiveSaveId(), listSaveSlots()]);
      if (!activeId) {
        set({ status: 'no-save', activeSaveId: null, savefile: null, slots });
        return;
      }
      const slot = await loadSaveSlot(activeId);
      if (!slot) {
        await setActiveSaveId(null);
        set({ status: 'no-save', activeSaveId: null, savefile: null, slots });
        return;
      }
      set({
        status: 'ready',
        activeSaveId: slot.id,
        savefile: slot.savefile,
        slots,
      });
    } catch (err) {
      set({ status: 'error', errorMessage: (err as Error).message });
    }
  },

  refreshSlots: async () => {
    const slots = await listSaveSlots();
    set({ slots });
  },

  createSavefile: async (input) => {
    const savefile = createBlankSavefile(input);
    const slot = await createSaveSlot({ name: input.countryName, savefile });
    const slots = await listSaveSlots();
    set({
      status: 'ready',
      activeSaveId: slot.id,
      savefile: slot.savefile,
      slots,
      errorMessage: null,
    });
    return slot.id;
  },

  switchTo: async (saveId) => {
    await flushPendingSave();
    const slot = await loadSaveSlot(saveId);
    if (!slot) {
      set({ status: 'error', errorMessage: `Save ${saveId} not found` });
      return;
    }
    await setActiveSaveId(saveId);
    set({
      status: 'ready',
      activeSaveId: slot.id,
      savefile: slot.savefile,
      errorMessage: null,
    });
  },

  deleteSlot: async (saveId) => {
    await flushPendingSave();
    await deleteSaveSlot(saveId);
    const slots = await listSaveSlots();
    const state = get();
    if (state.activeSaveId === saveId) {
      set({ status: 'no-save', activeSaveId: null, savefile: null, slots });
    } else {
      set({ slots });
    }
  },

  renameSlot: async (saveId, newName) => {
    await renameSaveSlot(saveId, newName);
    await get().refreshSlots();
  },

  importFromJson: async (jsonText) => {
    const savefile = parseSavefile(jsonText);
    const slot = await createSaveSlot({ name: savefile.meta.countryName, savefile });
    const slots = await listSaveSlots();
    set({
      status: 'ready',
      activeSaveId: slot.id,
      savefile: slot.savefile,
      slots,
      errorMessage: null,
    });
    return slot.id;
  },

  flushNow: async () => {
    await flushPendingSave();
  },

  updateSavefile: (updater) => {
    const state = get();
    if (!state.savefile || !state.activeSaveId) return;
    const next = updater(state.savefile);
    set({ savefile: next });
    scheduleSave(state.activeSaveId, next);
  },
}));

export function useSavefile(): Savefile | null {
  return useSavefileStore((s) => s.savefile);
}

export function requireSavefile(): Savefile {
  const sf = useSavefileStore.getState().savefile;
  if (!sf) throw new Error('No active savefile');
  return sf;
}
