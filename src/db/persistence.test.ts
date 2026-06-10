import { describe, expect, it } from 'vitest';
import {
  createSaveSlot,
  deleteSaveSlot,
  flushPendingSave,
  flushSavefile,
  getActiveSaveId,
  listSaveSlots,
  loadSaveSlot,
  scheduleSave,
} from './persistence';
import { createBlankSavefile } from '../domain/factory';

const newSf = (country = 'Testland') =>
  createBlankSavefile({ countryName: country, countryShortCode: 'TST', matchdaysPerSeason: 32 });

describe('persistence', () => {
  it('round-trips a savefile through Dexie', async () => {
    const slot = await createSaveSlot({ name: 'TST', savefile: newSf() });
    const loaded = await loadSaveSlot(slot.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.savefile.meta.countryName).toBe('Testland');
    expect(loaded?.savefile.meta.countryShortCode).toBe('TST');
    expect(loaded?.savefile.calendar.matchdaysPerSeason).toBe(32);
  });

  it('lists save slots ordered by lastSavedAt desc', async () => {
    const a = await createSaveSlot({ name: 'A', savefile: newSf('Alpha') });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createSaveSlot({ name: 'B', savefile: newSf('Bravo') });
    const slots = await listSaveSlots();
    const ids = slots.map((s) => s.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(ids[0]).toBe(b.id);
  });

  it('tracks active save id', async () => {
    const slot = await createSaveSlot({ name: 'A', savefile: newSf() });
    expect(await getActiveSaveId()).toBe(slot.id);
  });

  it('clears active id when active slot is deleted', async () => {
    const slot = await createSaveSlot({ name: 'A', savefile: newSf() });
    await deleteSaveSlot(slot.id);
    expect(await getActiveSaveId()).toBeNull();
  });

  it('debounced scheduleSave eventually persists changes', async () => {
    const slot = await createSaveSlot({ name: 'A', savefile: newSf('Alpha') });
    const next = { ...slot.savefile, meta: { ...slot.savefile.meta, countryName: 'Bravo' } };
    scheduleSave(slot.id, next);
    await flushPendingSave();
    const loaded = await loadSaveSlot(slot.id);
    expect(loaded?.savefile.meta.countryName).toBe('Bravo');
  });

  it('flushSavefile updates lastSavedAt', async () => {
    const slot = await createSaveSlot({ name: 'A', savefile: newSf() });
    const before = slot.lastSavedAt;
    await new Promise((r) => setTimeout(r, 5));
    await flushSavefile(slot.id, slot.savefile);
    const slots = await listSaveSlots();
    const updated = slots.find((s) => s.id === slot.id);
    expect(updated).toBeDefined();
    expect(updated && updated.lastSavedAt > before).toBe(true);
  });
});
