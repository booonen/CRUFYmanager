export interface ClubColors {
  primary: string;
  secondary: string;
}

export interface ClubStadium {
  name: string;
  capacity: number;
}

export interface ClubFinances {
  balance: number;
}

export interface ClubSeasonRecord {
  season: number;
  competitionId: string;
  position: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  trophy: 'winner' | 'runner-up' | null;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  city: string;
  founded: number;
  colors: ClubColors;
  stadium: ClubStadium;
  managerId: string | null;
  squadPlayerIds: string[];
  ovr: number;
  finances: ClubFinances;
  history: ClubSeasonRecord[];
}
