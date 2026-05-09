export interface Calendar {
  currentSeason: number;
  currentMatchday: number;
  matchdaysPerSeason: number;
  schedule: ScheduleSlot[];
}

export interface ScheduleSlot {
  matchday: number;
  fixtures: ScheduledFixture[];
}

export type FixtureKind = 'competition' | 'national' | 'other';

export interface ScheduledFixture {
  fixtureId: string;
  kind: FixtureKind;
  competitionId: string | null;
  competitionMatchday: number | null;
}

export interface CalendarDate {
  season: number;
  matchday: number;
}
