import { describe, expect, it } from 'vitest';
import { computeAge, dobForAge } from './age';
import type { Calendar } from '../domain/calendar';

const cal = (season: number, matchday: number): Calendar => ({
  currentSeason: season,
  currentMatchday: matchday,
  matchdaysPerSeason: 52,
  schedule: [],
});

describe('age', () => {
  it('dobForAge + computeAge round-trip when matchday matches', () => {
    const c = cal(10, 20);
    const dob = dobForAge(25, c);
    expect(computeAge(dob, c)).toBe(25);
  });

  it('age is one less if the current matchday has not reached birth matchday', () => {
    const c1 = cal(10, 30);
    const dob = dobForAge(20, c1);
    const c2 = cal(11, 10);
    expect(computeAge(dob, c2)).toBe(20);
  });

  it('age clamps to non-negative', () => {
    const c = cal(1, 1);
    const dobInFuture = { season: 5, matchday: 10 };
    expect(computeAge(dobInFuture, c)).toBe(0);
  });
});
