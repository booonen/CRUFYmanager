export interface Rng {
  /** uniform [0, 1) */
  next(): number;
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** uniform real in [min, max) */
  range(min: number, max: number): number;
  /** pick one element of arr */
  pick<T>(arr: readonly T[]): T;
  /** Box-Muller-ish normal-ish, mean + stddev, clipped to [min, max] */
  normal(mean: number, stddev: number, min?: number, max?: number): number;
  /** with probability p, return true */
  chance(p: number): boolean;
}

const MASK = 0xffffffff;

function hashStringToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32. Tiny, stateful, deterministic per seed. */
export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'number' ? seed : hashStringToSeed(seed)) >>> 0;
  if (state === 0) state = 0x12345678;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / (MASK + 1);
  };

  const int = (min: number, max: number): number => {
    if (max < min) return int(max, min);
    return Math.floor(next() * (max - min + 1)) + min;
  };

  const range = (min: number, max: number): number => {
    if (max < min) return range(max, min);
    return min + next() * (max - min);
  };

  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error('createRng.pick: empty array');
    return arr[int(0, arr.length - 1)] as T;
  };

  const normal = (mean: number, stddev: number, min?: number, max?: number): number => {
    // Box-Muller
    const u1 = Math.max(1e-9, next());
    const u2 = next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const v = mean + z * stddev;
    if (typeof min === 'number' && v < min) return min;
    if (typeof max === 'number' && v > max) return max;
    return v;
  };

  const chance = (p: number): boolean => next() < p;

  return { next, int, range, pick, normal, chance };
}

export function newSeedString(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
