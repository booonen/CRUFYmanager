import type { SaveSlot, SaveSlotSummary, Savefile } from '../domain/savefile';
import { SCHEMA_VERSION } from '../domain/savefile';
import { newSaveId } from '../utils/ids';
import { migrate } from './migrations';
import { getDb } from './schema';

const FLUSH_DEBOUNCE_MS = 500;

let pendingFlush: ReturnType<typeof setTimeout> | null = null;
let pendingSavefile: Savefile | null = null;
let pendingSaveId: string | null = null;

export async function getActiveSaveId(): Promise<string | null> {
  const meta = await getDb().meta.get('singleton');
  return meta?.activeSaveId ?? null;
}

export async function setActiveSaveId(id: string | null): Promise<void> {
  await getDb().meta.put({
    id: 'singleton',
    activeSaveId: id,
    schemaVersion: SCHEMA_VERSION,
  });
}

export async function listSaveSlots(): Promise<SaveSlotSummary[]> {
  const rows = await getDb().saves.orderBy('lastSavedAt').reverse().toArray();
  return rows.map(({ id, name, createdAt, lastSavedAt, countryName, countryShortCode }) => ({
    id,
    name,
    createdAt,
    lastSavedAt,
    countryName,
    countryShortCode,
  }));
}

export async function loadSaveSlot(id: string): Promise<SaveSlot | null> {
  const row = await getDb().saves.get(id);
  if (!row) return null;
  return { ...row, savefile: migrate(row.savefile) };
}

export interface CreateSaveSlotInput {
  name: string;
  savefile: Savefile;
}

export async function createSaveSlot(input: CreateSaveSlotInput): Promise<SaveSlot> {
  const id = newSaveId();
  const slot: SaveSlot = {
    id,
    name: input.name,
    createdAt: input.savefile.meta.createdAt,
    lastSavedAt: input.savefile.meta.lastSavedAt,
    countryName: input.savefile.meta.countryName,
    countryShortCode: input.savefile.meta.countryShortCode,
    savefile: input.savefile,
  };
  await getDb().saves.put(slot);
  await setActiveSaveId(id);
  return slot;
}

export async function deleteSaveSlot(id: string): Promise<void> {
  await getDb().saves.delete(id);
  const active = await getActiveSaveId();
  if (active === id) {
    await setActiveSaveId(null);
  }
}

export async function renameSaveSlot(id: string, name: string): Promise<void> {
  await getDb().saves.update(id, { name });
}

export async function flushSavefile(saveId: string, savefile: Savefile): Promise<void> {
  const stamped: Savefile = {
    ...savefile,
    meta: { ...savefile.meta, lastSavedAt: new Date().toISOString() },
  };
  await getDb().saves.update(saveId, {
    name: stamped.meta.countryName,
    lastSavedAt: stamped.meta.lastSavedAt,
    countryName: stamped.meta.countryName,
    countryShortCode: stamped.meta.countryShortCode,
    savefile: stamped,
  });
}

export function scheduleSave(saveId: string, savefile: Savefile): void {
  pendingSaveId = saveId;
  pendingSavefile = savefile;

  if (pendingFlush) {
    clearTimeout(pendingFlush);
  }

  pendingFlush = setTimeout(() => {
    void runPendingFlush();
  }, FLUSH_DEBOUNCE_MS);
}

export async function flushPendingSave(): Promise<void> {
  if (pendingFlush) {
    clearTimeout(pendingFlush);
    pendingFlush = null;
  }
  await runPendingFlush();
}

async function runPendingFlush(): Promise<void> {
  if (!pendingSaveId || !pendingSavefile) return;
  const id = pendingSaveId;
  const savefile = pendingSavefile;
  pendingSaveId = null;
  pendingSavefile = null;
  pendingFlush = null;
  await flushSavefile(id, savefile);
}
