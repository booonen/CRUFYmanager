import { describe, expect, it } from 'vitest';
import { computeOvr, defaultStatBlock, OVR_WEIGHTS } from './ovr';
import { POSITIONS } from '../domain/player';

describe('OVR weights', () => {
  it('every position row sums to 1.0 (within rounding)', () => {
    for (const pos of POSITIONS) {
      const sum = Object.values(OVR_WEIGHTS[pos]).reduce((s, v) => s + v, 0);
      expect(sum).toBeGreaterThan(0.99);
      expect(sum).toBeLessThan(1.01);
    }
  });

  it('outfield positions assign 0 weight to GK-only stats', () => {
    for (const pos of POSITIONS) {
      if (pos === 'GK') continue;
      const w = OVR_WEIGHTS[pos];
      expect(w.handling).toBe(0);
      expect(w.reflexes).toBe(0);
      expect(w.kicking).toBe(0);
    }
  });
});

describe('computeOvr', () => {
  it('returns the value of the stat block for a uniform stat block', () => {
    const stats = defaultStatBlock();
    for (const pos of POSITIONS) {
      expect(computeOvr(pos, stats)).toBe(50);
    }
  });

  it('GK with high goalkeeping stats overall-rates higher than with high outfield stats', () => {
    const allLow = { ...defaultStatBlock() };
    Object.keys(allLow).forEach((k) => ((allLow as Record<string, number>)[k] = 30));

    const gkStrong = { ...allLow, handling: 95, reflexes: 95, kicking: 90 };
    const outfielderStrong = { ...allLow, pace: 95, finishing: 95, dribbling: 95 };

    expect(computeOvr('GK', gkStrong)).toBeGreaterThan(computeOvr('GK', outfielderStrong));
  });

  it('FWD-ST overall is higher with elite finishing than elite defending', () => {
    const base = defaultStatBlock();
    Object.keys(base).forEach((k) => ((base as Record<string, number>)[k] = 50));

    const finisher = { ...base, finishing: 95 };
    const defender = { ...base, defending: 95 };

    expect(computeOvr('FWD-ST', finisher)).toBeGreaterThan(computeOvr('FWD-ST', defender));
  });
});
