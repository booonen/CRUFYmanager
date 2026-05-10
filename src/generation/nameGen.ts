import type { Rng } from './prng';

export interface NamePool {
  code: string;
  displayName: string;
  firstNames: string[];
  lastNames: string[];
  cities: string[];
  clubTemplates: string[];
  /** Optional attribution / sourcing note. Not user-facing. */
  notes?: string;
}

const POOLS_BY_CODE = new Map<string, NamePool>();
const POOLS_BY_NATIONALITY: Record<string, string> = {};

export function registerPool(pool: NamePool): void {
  POOLS_BY_CODE.set(pool.code.toLowerCase(), pool);
}

/** Map a free-text "nationality" name to a pool code. Case-insensitive. */
export function registerNationalityAlias(nationalityName: string, poolCode: string): void {
  POOLS_BY_NATIONALITY[normalizeNationality(nationalityName)] = poolCode.toLowerCase();
}

export function listPools(): NamePool[] {
  return Array.from(POOLS_BY_CODE.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export function getPool(code: string): NamePool | null {
  return POOLS_BY_CODE.get(code.toLowerCase()) ?? null;
}

/**
 * Resolve a free-text nationality (e.g. "Republic of Foo", "England") to a
 * pool, falling back to the generic pool when nothing matches.
 */
export function resolvePool(nationality: string): NamePool {
  const norm = normalizeNationality(nationality);
  const direct = POOLS_BY_CODE.get(norm);
  if (direct) return direct;

  const aliasCode = POOLS_BY_NATIONALITY[norm];
  if (aliasCode) {
    const aliased = POOLS_BY_CODE.get(aliasCode);
    if (aliased) return aliased;
  }

  // Fuzzy: substring match against pool displayName.
  for (const pool of POOLS_BY_CODE.values()) {
    if (norm.includes(pool.displayName.toLowerCase())) return pool;
  }

  const generic = POOLS_BY_CODE.get('generic');
  if (generic) return generic;

  // Final fallback — first registered pool.
  const first = POOLS_BY_CODE.values().next().value;
  if (!first) throw new Error('No name pools registered');
  return first;
}

export interface NameGenInput {
  rng: Rng;
  /** Explicit pool to draw names from. Takes precedence over nationality alias lookup. */
  poolCode?: string;
  /** Free-text nationality (used as fallback when poolCode is unset). */
  nationality?: string;
}

export interface FullName {
  firstName: string;
  lastName: string;
}

/** Resolve a pool from poolCode (preferred) or nationality alias (fallback). */
export function pickPool(opts: { poolCode?: string; nationality?: string }): NamePool {
  if (opts.poolCode) {
    const direct = getPool(opts.poolCode);
    if (direct) return direct;
  }
  return resolvePool(opts.nationality ?? '');
}

export function generateFullName(input: NameGenInput): FullName {
  const pool = pickPool(input);
  return {
    firstName: input.rng.pick(pool.firstNames),
    lastName: input.rng.pick(pool.lastNames),
  };
}

export interface ClubIdentityName {
  name: string;
  shortName: string;
  city: string;
}

/** Pick a city + apply a club template. e.g. "Hamburg" + "{city} FC" → "Hamburg FC". */
export function generateClubName(
  rng: Rng,
  opts: { poolCode?: string; nationality?: string },
): ClubIdentityName {
  const pool = pickPool(opts);
  const city = rng.pick(pool.cities);
  const template = rng.pick(pool.clubTemplates);
  const name = template.replace('{city}', city);
  const shortName = makeShortName(city);
  return { name, shortName, city };
}

function makeShortName(city: string): string {
  const tokens = city.split(/[\s-]+/).filter(Boolean);
  if (tokens.length >= 2) {
    return tokens
      .slice(0, 3)
      .map((t) => t.charAt(0).toUpperCase())
      .join('');
  }
  const first = tokens[0] ?? city;
  return first.slice(0, 3).toUpperCase();
}

function normalizeNationality(s: string): string {
  return s.trim().toLowerCase();
}
