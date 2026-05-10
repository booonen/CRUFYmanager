import { describe, expect, it } from 'vitest';
import { POSITIONS } from '../domain/player';
import { computeOvr } from '../utils/ovr';
import { sampleStatBlock } from './statSampler';
import { createRng } from './prng';

describe('sampleStatBlock', () => {
  it('produces an OVR within ±5 of target ≥ 95% of the time at every position', () => {
    const targets = [50, 60, 70, 80, 85];
    const trialsPerCombo = 60;
    let total = 0;
    let near = 0;

    for (const pos of POSITIONS) {
      for (const target of targets) {
        for (let i = 0; i < trialsPerCombo; i++) {
          const rng = createRng(`${pos}-${target}-${i}`);
          const block = sampleStatBlock(rng, pos, target);
          const ovr = computeOvr(pos, block);
          total++;
          if (Math.abs(ovr - target) <= 5) near++;
        }
      }
    }

    const hitRate = near / total;
    // At ±5 we expect very high convergence.
    expect(hitRate).toBeGreaterThanOrEqual(0.95);
  });

  it('zeroes-out positions still produce reasonable stat values', () => {
    const rng = createRng('outfield-gk-stats');
    const block = sampleStatBlock(rng, 'FWD-ST', 80);
    // GK-only stats should still be in 1-99 (just won't contribute to OVR).
    for (const stat of ['handling', 'reflexes', 'kicking'] as const) {
      expect(block[stat]).toBeGreaterThanOrEqual(1);
      expect(block[stat]).toBeLessThanOrEqual(99);
    }
  });
});
