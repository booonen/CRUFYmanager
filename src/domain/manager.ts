export type Formation =
  | '4-4-2'
  | '4-3-3'
  | '4-2-3-1'
  | '3-5-2'
  | '3-4-3'
  | '5-3-2'
  | '4-5-1'
  | '4-1-4-1';

export type TacticalProfile =
  | 'defensive'
  | 'counter-attack'
  | 'balanced'
  | 'possession'
  | 'pressing'
  | 'attacking';

export interface ManagerStats {
  tactical: number;
  motivation: number;
  development: number;
  discipline: number;
  adaptability: number;
}

export interface ManagerStint {
  clubId: string;
  fromSeason: number;
  toSeason: number | null;
  trophiesWon: number;
}

export interface Manager {
  id: string;
  name: string;
  nationality: string;
  age: number;
  stats: ManagerStats;
  preferredFormation: Formation;
  preferredStyle: TacticalProfile;
  contractClubId: string | null;
  contractUntilSeason: number | null;
  history: ManagerStint[];
}
