import type { Formation, TacticalProfile } from './manager';

export interface NationalFixture {
  id: string;
  season: number;
  matchday: number;
  opponentForeignNTId: string;
  isHome: boolean;
  resultMatchId: string | null;
}

export interface NationalSeasonRecord {
  season: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface NationalTeam {
  managerId: string | null;
  squadPlayerIds: string[];
  formation: Formation;
  tactics: TacticalProfile;
  fixtures: NationalFixture[];
  history: NationalSeasonRecord[];
}
