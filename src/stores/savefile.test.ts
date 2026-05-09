import { describe, expect, it, beforeEach } from 'vitest';
import { useSavefileStore } from './savefile';
import { exportSavefile } from '../utils/jsonIO';
import { createBlankSavefile } from '../domain/factory';

beforeEach(() => {
  useSavefileStore.setState({
    status: 'idle',
    errorMessage: null,
    activeSaveId: null,
    savefile: null,
    slots: [],
  });
});

describe('useSavefileStore', () => {
  it('hydrate reports no-save when DB is empty', async () => {
    await useSavefileStore.getState().hydrate();
    expect(useSavefileStore.getState().status).toBe('no-save');
    expect(useSavefileStore.getState().savefile).toBeNull();
  });

  it('createSavefile makes the new save active', async () => {
    const id = await useSavefileStore.getState().createSavefile({
      countryName: 'Foo',
      countryShortCode: 'FOO',
      matchdaysPerSeason: 28,
    });
    const state = useSavefileStore.getState();
    expect(state.activeSaveId).toBe(id);
    expect(state.status).toBe('ready');
    expect(state.savefile?.meta.countryName).toBe('Foo');
    expect(state.slots.some((s) => s.id === id)).toBe(true);
  });

  it('importFromJson registers a new save and switches to it', async () => {
    const blob = exportSavefile(
      createBlankSavefile({
        countryName: 'Imported',
        countryShortCode: 'IMP',
        matchdaysPerSeason: 24,
      }),
    );
    const id = await useSavefileStore.getState().importFromJson(blob);
    expect(useSavefileStore.getState().activeSaveId).toBe(id);
    expect(useSavefileStore.getState().savefile?.meta.countryName).toBe('Imported');
  });

  it('updateSavefile mutates the active savefile in memory', async () => {
    await useSavefileStore.getState().createSavefile({
      countryName: 'A',
      countryShortCode: 'A',
      matchdaysPerSeason: 20,
    });
    useSavefileStore.getState().updateSavefile((sf) => ({
      ...sf,
      meta: { ...sf.meta, countryName: 'A-renamed' },
    }));
    expect(useSavefileStore.getState().savefile?.meta.countryName).toBe('A-renamed');
  });

  it('hydrate restores active save after reset', async () => {
    await useSavefileStore.getState().createSavefile({
      countryName: 'Persistent',
      countryShortCode: 'PER',
      matchdaysPerSeason: 30,
    });
    useSavefileStore.setState({
      status: 'idle',
      activeSaveId: null,
      savefile: null,
      slots: [],
      errorMessage: null,
    });
    await useSavefileStore.getState().hydrate();
    expect(useSavefileStore.getState().status).toBe('ready');
    expect(useSavefileStore.getState().savefile?.meta.countryName).toBe('Persistent');
  });
});
