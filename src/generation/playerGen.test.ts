import { describe, expect, it, beforeAll } from 'vitest';
import { generatePlayer } from './playerGen';
import { createRng } from './prng';
import { registerAllNamePools } from './registerPools';
import type { Calendar } from '../domain/calendar';

beforeAll(() => {
  registerAllNamePools();
});

const cal = (): Calendar => ({
  currentSeason: 1,
  currentMatchday: 1,
  matchdaysPerSeason: 52,
  schedule: [],
});

describe('generatePlayer', () => {
  it('returns a valid DomesticPlayer with non-empty firstName + lastName', () => {
    const rng = createRng('player-1');
    const p = generatePlayer({
      rng,
      calendar: cal(),
      position: 'MID-CM',
      age: 25,
      targetOvr: 75,
      nationality: 'England',
      clubId: 'club-x',
    });
    expect(p.tier).toBe('domestic');
    expect(p.firstName.length).toBeGreaterThan(0);
    expect(p.lastName.length).toBeGreaterThan(0);
    expect(p.position).toBe('MID-CM');
    expect(p.clubId).toBe('club-x');
    expect(p.stats.ovr).toBeGreaterThanOrEqual(60);
    expect(p.stats.ovr).toBeLessThanOrEqual(85);
    expect(p.stats.personalities.length).toBeGreaterThanOrEqual(1);
    expect(p.stats.personalities.length).toBeLessThanOrEqual(3);
  });

  it('generates the same player given the same seed', () => {
    const a = generatePlayer({
      rng: createRng('same'),
      calendar: cal(),
      position: 'FWD-ST',
      age: 22,
      targetOvr: 70,
      nationality: 'Spain',
      clubId: 'club-x',
    });
    const b = generatePlayer({
      rng: createRng('same'),
      calendar: cal(),
      position: 'FWD-ST',
      age: 22,
      targetOvr: 70,
      nationality: 'Spain',
      clubId: 'club-x',
    });
    expect(a.firstName).toBe(b.firstName);
    expect(a.lastName).toBe(b.lastName);
    expect(a.stats).toEqual(b.stats);
  });

  it('young players get higher potential than current OVR on average', () => {
    let bumps = 0;
    const N = 50;
    for (let i = 0; i < N; i++) {
      const rng = createRng(`young-${i}`);
      const p = generatePlayer({
        rng,
        calendar: cal(),
        position: 'MID-CAM',
        age: 18,
        targetOvr: 60,
        nationality: 'France',
        clubId: 'club-x',
      });
      if (p.stats.potential > p.stats.ovr) bumps++;
    }
    expect(bumps / N).toBeGreaterThan(0.7);
  });
});
