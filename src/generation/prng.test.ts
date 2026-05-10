import { describe, expect, it } from 'vitest';
import { createRng } from './prng';

describe('prng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('hello');
    const b = createRng('hello');
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('diverges with different seeds', () => {
    const a = createRng('one');
    const b = createRng('two');
    let differences = 0;
    for (let i = 0; i < 100; i++) {
      if (a.next() !== b.next()) differences++;
    }
    expect(differences).toBeGreaterThan(95);
  });

  it('int() respects bounds', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(5, 10);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(10);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('pick() returns elements from the array', () => {
    const rng = createRng('pick');
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 200; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('chance(p) is roughly p', () => {
    const rng = createRng('chance');
    let trues = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) if (rng.chance(0.3)) trues++;
    expect(trues / N).toBeGreaterThan(0.27);
    expect(trues / N).toBeLessThan(0.33);
  });
});
