import type { Formation, TacticalProfile } from './manager';

export interface ForeignLeague {
  id: string;
  name: string;
  countryName: string;
  tier: number;
}

export interface ForeignClub {
  id: string;
  name: string;
  leagueId: string;
  countryName: string;
  ovr: number;
  logoUrl: string | null;
}

export interface ForeignNT {
  id: string;
  countryName: string;
  rosterPlayerIds: string[];
  ovr: number;
  formation: Formation;
  tactics: TacticalProfile;
  flagUrl: string | null;
}

export interface ForeignWorld {
  leagues: ForeignLeague[];
  clubs: ForeignClub[];
  nationalTeams: ForeignNT[];
}
