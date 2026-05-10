import { describe, expect, it } from 'vitest';
import { migrate } from './migrations';
import { createBlankSavefile } from '../domain/factory';
import { SCHEMA_VERSION } from '../domain/savefile';

describe('migrate', () => {
  it('is a no-op on a current-version savefile', () => {
    const sf = createBlankSavefile({
      countryName: 'X',
      countryShortCode: 'X',
      matchdaysPerSeason: 10,
    });
    const out = migrate(sf);
    expect(out.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out).toEqual(sf);
  });

  it('rejects a savefile from a newer schemaVersion than supported', () => {
    const sf = createBlankSavefile({
      countryName: 'X',
      countryShortCode: 'X',
      matchdaysPerSeason: 10,
    });
    const future = { ...sf, meta: { ...sf.meta, schemaVersion: SCHEMA_VERSION + 99 } };
    expect(() => migrate(future)).toThrow(/newer/);
  });

  it('rejects a savefile from an older schemaVersion when no migration is registered', () => {
    const sf = createBlankSavefile({
      countryName: 'X',
      countryShortCode: 'X',
      matchdaysPerSeason: 10,
    });
    if (SCHEMA_VERSION === 1) {
      // Nothing to test — no older version exists yet.
      return;
    }
    const stale = { ...sf, meta: { ...sf.meta, schemaVersion: SCHEMA_VERSION - 1 } };
    // With no migrations registered, an older version should error.
    expect(() => migrate(stale)).toThrow();
  });
});
