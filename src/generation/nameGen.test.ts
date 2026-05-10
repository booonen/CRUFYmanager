import { describe, expect, it, beforeAll } from 'vitest';
import { generateClubName, generateFullName, listPools, resolvePool } from './nameGen';
import { createRng } from './prng';
import { registerAllNamePools } from './registerPools';

beforeAll(() => {
  registerAllNamePools();
});

describe('nameGen', () => {
  it('registers all 13 pools', () => {
    const pools = listPools();
    expect(pools.length).toBeGreaterThanOrEqual(13);
    const codes = new Set(pools.map((p) => p.code));
    expect(codes).toEqual(
      new Set([
        'english',
        'german',
        'french',
        'spanish',
        'italian',
        'slavic',
        'nordic',
        'african',
        'chinese',
        'arabic',
        'turkish',
        'greek',
        'japanese',
      ]),
    );
  });

  it('resolves common nationality aliases to the right pool', () => {
    expect(resolvePool('England').code).toBe('english');
    expect(resolvePool('Germany').code).toBe('german');
    expect(resolvePool('Argentina').code).toBe('spanish');
    expect(resolvePool('Czech Republic').code).toBe('slavic');
    expect(resolvePool('Sweden').code).toBe('nordic');
    expect(resolvePool('Japan').code).toBe('japanese');
  });

  it('falls back to a real pool for unknown nationality', () => {
    const p = resolvePool('Atlantis');
    expect(p.code).toBeTruthy();
    expect(p.firstNames.length).toBeGreaterThan(0);
  });

  it('generateFullName returns first + last from the pool', () => {
    const rng = createRng('name');
    const { firstName, lastName } = generateFullName({ nationality: 'England', rng });
    expect(firstName.length).toBeGreaterThan(0);
    expect(lastName.length).toBeGreaterThan(0);
  });

  it('generateClubName uses {city} substitution and produces a sensible shortName', () => {
    const rng = createRng('club-name');
    const { name, shortName, city } = generateClubName('England', rng);
    expect(name).toContain(city);
    expect(shortName.length).toBeGreaterThan(0);
    expect(shortName.length).toBeLessThanOrEqual(4);
  });

  it('every pool has at least 50 first names + 50 last names + 20 cities + 4 templates', () => {
    for (const pool of listPools()) {
      expect(pool.firstNames.length).toBeGreaterThanOrEqual(50);
      expect(pool.lastNames.length).toBeGreaterThanOrEqual(50);
      expect(pool.cities.length).toBeGreaterThanOrEqual(20);
      expect(pool.clubTemplates.length).toBeGreaterThanOrEqual(4);
    }
  });
});
