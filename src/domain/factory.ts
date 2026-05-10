import type { Calendar } from './calendar';
import type { ForeignWorld } from './foreignWorld';
import type { HistoryArchive } from './history';
import type { NationalTeam } from './nationalTeam';
import type { Savefile } from './savefile';
import { SCHEMA_VERSION } from './savefile';
import { DEFAULT_SETTINGS } from './settings';
import { makeFreeAgentsClub } from '../utils/freeAgents';

export interface NewSavefileInput {
  countryName: string;
  countryShortCode: string;
  matchdaysPerSeason: number;
}

const emptyCalendar = (matchdaysPerSeason: number): Calendar => ({
  currentSeason: 1,
  currentMatchday: 1,
  matchdaysPerSeason,
  schedule: Array.from({ length: matchdaysPerSeason }, (_, i) => ({
    matchday: i + 1,
    fixtures: [],
  })),
});

const emptyNationalTeam = (): NationalTeam => ({
  managerId: null,
  squadPlayerIds: [],
  formation: '4-3-3',
  tactics: 'balanced',
  fixtures: [],
  history: [],
});

const emptyForeignWorld = (): ForeignWorld => ({
  leagues: [],
  clubs: [],
  nationalTeams: [],
});

const emptyHistory = (): HistoryArchive => ({
  pastSeasons: [],
  dissolvedCompetitions: [],
  allTimeRecords: [],
});

export function createBlankSavefile(input: NewSavefileInput): Savefile {
  const now = new Date().toISOString();
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      lastSavedAt: now,
      countryName: input.countryName,
      countryShortCode: input.countryShortCode.toUpperCase().slice(0, 3),
    },
    calendar: emptyCalendar(input.matchdaysPerSeason),
    competitions: [],
    clubs: [makeFreeAgentsClub()],
    players: [],
    managers: [],
    nationalTeam: emptyNationalTeam(),
    foreignWorld: emptyForeignWorld(),
    otherMatches: [],
    history: emptyHistory(),
    settings: { ...DEFAULT_SETTINGS },
  };
}
