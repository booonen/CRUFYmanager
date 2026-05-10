import { describe, expect, it } from 'vitest';
import { migrate } from './migrations';
import type { Savefile } from '../domain/savefile';
import { SCHEMA_VERSION } from '../domain/savefile';
import { FREE_AGENTS_CLUB_ID } from '../domain/club';

function v1Savefile(): Savefile {
  return {
    meta: {
      schemaVersion: 1,
      createdAt: '2026-01-01T00:00:00Z',
      lastSavedAt: '2026-01-01T00:00:00Z',
      countryName: 'Old',
      countryShortCode: 'OLD',
    },
    calendar: { currentSeason: 1, currentMatchday: 1, matchdaysPerSeason: 52, schedule: [] },
    competitions: [],
    clubs: [
      {
        id: 'old-club',
        name: 'Old FC',
        shortName: 'OLD',
        city: 'Oldtown',
        founded: 1900,
        colors: { primary: '#000', secondary: '#fff' },
        stadium: { name: 'Oldfield', capacity: 100 },
        managerId: null,
        squadPlayerIds: [],
        ovr: 0,
        finances: { balance: 0 },
        history: [],
      },
    ] as unknown as Savefile['clubs'],
    players: [],
    managers: [],
    nationalTeam: {
      managerId: null,
      squadPlayerIds: [],
      formation: '4-3-3',
      tactics: 'balanced',
      fixtures: [],
      history: [],
    },
    foreignWorld: { leagues: [], clubs: [], nationalTeams: [] },
    otherMatches: [],
    history: { pastSeasons: [], dissolvedCompetitions: [], allTimeRecords: [] },
    settings: {
      language: 'en',
      reportFormat: 'bbcode',
      autoAdvance: false,
      notifications: { transferOffers: true, injuries: true },
    },
  };
}

function v2SavefileWithLegacyPlayer(): Savefile {
  const sf = migrate(v1Savefile());
  return {
    ...sf,
    meta: { ...sf.meta, schemaVersion: 2 },
    players: [
      {
        id: 'legacy',
        tier: 'domestic',
        name: 'Legacy P',
        nationality: 'X',
        position: 'MID-CM',
        preferredFoot: 'R',
        dateOfBirth: { season: -23, matchday: 1 },
        clubId: FREE_AGENTS_CLUB_ID,
        contractUntilSeason: 5,
        squadNumber: null,
        currentForm: 60,
        currentMorale: 75,
        currentFitness: 100,
        injury: null,
        careerHistory: [],
        stats: {
          pace: 50,
          finishing: 50,
          passing: 50,
          dribbling: 50,
          defending: 50,
          heading: 50,
          vision: 50,
          physicality: 50,
          technique: 50,
          handling: 50,
          reflexes: 50,
          kicking: 50,
          injuryProneness: 30,
          potential: 70,
          consistency: 60,
          workRate: 60,
          ovr: 50,
          // legacy single personality field
          personality: 'Hothead',
        } as unknown as Savefile['players'][number] extends infer P
          ? P extends { stats: infer S }
            ? S
            : never
          : never,
      },
    ] as unknown as Savefile['players'],
  };
}

describe('migrate v1 -> v2', () => {
  it('adds Club.kind = "club" to existing clubs', () => {
    const result = migrate(v1Savefile());
    const old = result.clubs.find((c) => c.id === 'old-club');
    expect(old?.kind).toBe('club');
  });

  it('adds the Free Agents club', () => {
    const result = migrate(v1Savefile());
    const fa = result.clubs.find((c) => c.id === FREE_AGENTS_CLUB_ID);
    expect(fa).toBeDefined();
    expect(fa?.kind).toBe('free-agents');
  });

  it('bumps the schemaVersion to current', () => {
    const result = migrate(v1Savefile());
    expect(result.meta.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('is a no-op on an already-current savefile', () => {
    const v1 = v1Savefile();
    const current = migrate(v1);
    const again = migrate(current);
    expect(again.clubs.length).toBe(current.clubs.length);
    expect(again.meta.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('migrate v2 -> v3', () => {
  it('wraps a single legacy personality field into the personalities array', () => {
    const v2 = v2SavefileWithLegacyPlayer();
    const v3 = migrate(v2);
    const p = v3.players.find((pp) => pp.id === 'legacy');
    expect(p).toBeDefined();
    if (!p || p.tier !== 'domestic') throw new Error('expected domestic player');
    expect(Array.isArray(p.stats.personalities)).toBe(true);
    expect(p.stats.personalities).toEqual(['Hothead']);
    expect((p.stats as unknown as Record<string, unknown>).personality).toBeUndefined();
  });

  it('falls back to ["Professional"] when neither personality nor personalities exists', () => {
    const v2 = v2SavefileWithLegacyPlayer();
    const broken: Savefile = {
      ...v2,
      players: v2.players.map((p) => {
        if (p.tier !== 'domestic') return p;
        const cleaned = { ...p.stats } as unknown as Record<string, unknown>;
        delete cleaned.personality;
        delete cleaned.personalities;
        return { ...p, stats: cleaned as unknown as typeof p.stats };
      }),
    };
    const v3 = migrate(broken);
    const p = v3.players.find((pp) => pp.id === 'legacy');
    if (!p || p.tier !== 'domestic') throw new Error('expected domestic player');
    expect(p.stats.personalities).toEqual(['Professional']);
  });
});

describe('migrate v3 -> v4', () => {
  it('splits a legacy "First Last" name into firstName + lastName and drops preferredFoot', () => {
    const start = v2SavefileWithLegacyPlayer();
    const result = migrate(start);
    const p = result.players.find((pp) => pp.id === 'legacy');
    if (!p || p.tier !== 'domestic') throw new Error('expected domestic player');
    expect(p.firstName).toBe('Legacy');
    expect(p.lastName).toBe('P');
    expect((p as unknown as Record<string, unknown>).name).toBeUndefined();
    expect((p as unknown as Record<string, unknown>).preferredFoot).toBeUndefined();
  });

  it('handles a single-token name as firstName with empty lastName', () => {
    const start = v2SavefileWithLegacyPlayer();
    const oneTokenStart: Savefile = {
      ...start,
      players: start.players.map((p) =>
        p.id === 'legacy' ? ({ ...p, name: 'Mononym' } as unknown as typeof p) : p,
      ),
    };
    const result = migrate(oneTokenStart);
    const p = result.players.find((pp) => pp.id === 'legacy');
    if (!p || p.tier !== 'domestic') throw new Error('expected domestic player');
    expect(p.firstName).toBe('Mononym');
    expect(p.lastName).toBe('');
  });

  it('adds Club.logoUrl = null to existing clubs and Free Agents', () => {
    const result = migrate(v1Savefile());
    expect(result.clubs.every((c) => 'logoUrl' in c)).toBe(true);
    expect(result.clubs.every((c) => c.logoUrl === null)).toBe(true);
  });
});
