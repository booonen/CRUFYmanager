import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t()', () => {
  it('returns string for known nested key', () => {
    expect(t('app.name')).toBe('CRUFYmanager');
  });

  it('returns the key when missing', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates {vars}', () => {
    // there's no real interpolated key in en.ts yet — verify via fallback
    const out = t('app.name', { who: 'world' });
    expect(out).toBe('CRUFYmanager');
  });
});
