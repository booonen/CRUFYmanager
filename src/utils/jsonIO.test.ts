import { describe, expect, it } from 'vitest';
import { exportSavefile, parseSavefile } from './jsonIO';
import { createBlankSavefile } from '../domain/factory';
import { SCHEMA_VERSION } from '../domain/savefile';

describe('jsonIO', () => {
  it('exports + parses a savefile losslessly', () => {
    const original = createBlankSavefile({
      countryName: 'Testland',
      countryShortCode: 'TST',
      matchdaysPerSeason: 38,
    });
    const blob = exportSavefile(original);
    const parsed = parseSavefile(blob);
    expect(parsed.meta.countryName).toBe('Testland');
    expect(parsed.meta.countryShortCode).toBe('TST');
    expect(parsed.calendar.matchdaysPerSeason).toBe(38);
  });

  it('rejects non-JSON', () => {
    expect(() => parseSavefile('not json')).toThrow();
  });

  it('rejects JSON that is not a savefile envelope', () => {
    expect(() => parseSavefile(JSON.stringify({ hello: 'world' }))).toThrow();
  });

  it('rejects savefiles from a newer schema version', () => {
    const future = JSON.stringify({
      schemaVersion: SCHEMA_VERSION + 99,
      exportedAt: new Date().toISOString(),
      savefile: createBlankSavefile({
        countryName: 'X',
        countryShortCode: 'X',
        matchdaysPerSeason: 10,
      }),
    });
    expect(() => parseSavefile(future)).toThrow(/newer/);
  });
});
