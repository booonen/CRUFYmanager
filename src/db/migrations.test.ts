import { describe, expect, it } from 'vitest';
import { migrate } from './migrations';
import type { Savefile } from '../domain/savefile';
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

  it('bumps the schemaVersion to 2', () => {
    const result = migrate(v1Savefile());
    expect(result.meta.schemaVersion).toBe(2);
  });

  it('is a no-op on an already-current savefile', () => {
    const v1 = v1Savefile();
    const v2 = migrate(v1);
    const v2Again = migrate(v2);
    expect(v2Again.clubs.length).toBe(v2.clubs.length);
    expect(v2Again.meta.schemaVersion).toBe(2);
  });
});
