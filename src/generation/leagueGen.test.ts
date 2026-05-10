import { describe, expect, it, beforeAll } from 'vitest';
import { generateLeague } from './leagueGen';
import { createRng } from './prng';
import { registerAllNamePools } from './registerPools';
import { DEFAULT_SQUAD_SIZE } from './shapes';
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

describe('generateLeague', () => {
  it('produces tierCount × clubsPerTier clubs and the right player count', () => {
    const result = generateLeague({
      rng: createRng('lg-1'),
      calendar: cal(),
      countryName: 'England',
      tierCount: 2,
      clubsPerTier: 4,
    });
    expect(result.tiers).toHaveLength(2);
    expect(result.clubs).toHaveLength(8);
    expect(result.managers).toHaveLength(8);
    expect(result.players).toHaveLength(8 * DEFAULT_SQUAD_SIZE);
  });

  it('every club has its squadPlayerIds populated and a manager assigned', () => {
    const result = generateLeague({
      rng: createRng('lg-2'),
      calendar: cal(),
      countryName: 'Germany',
      tierCount: 2,
      clubsPerTier: 3,
    });
    for (const club of result.clubs) {
      expect(club.squadPlayerIds.length).toBe(DEFAULT_SQUAD_SIZE);
      expect(club.managerId).toBeTruthy();
    }
  });

  it('tier 1 clubs have higher mean OVR than tier 2 clubs', () => {
    const result = generateLeague({
      rng: createRng('lg-3'),
      calendar: cal(),
      countryName: 'France',
      tierCount: 2,
      clubsPerTier: 6,
    });
    const tier1 = result.tiers[0]!;
    const tier2 = result.tiers[1]!;
    const mean = (ids: string[]) => {
      const ovrs = ids.map(
        (id) => result.clubs.find((c) => c.id === id)!.ovr,
      );
      return ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
    };
    expect(mean(tier1)).toBeGreaterThan(mean(tier2));
  });

  it('acceptance gate: 4 tiers × 16 clubs × 25 players = 1600 entities under 30s', () => {
    const start = performance.now();
    const result = generateLeague({
      rng: createRng('lg-bench'),
      calendar: cal(),
      countryName: 'Testland',
      tierCount: 4,
      clubsPerTier: 16,
    });
    const elapsed = performance.now() - start;
    expect(result.players).toHaveLength(64 * DEFAULT_SQUAD_SIZE);
    expect(elapsed).toBeLessThan(30000);
  }, 60000);
});
