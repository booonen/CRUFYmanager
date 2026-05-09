import type { CalendarDate } from './calendar';

export type Position =
  | 'GK'
  | 'DEF-CB'
  | 'DEF-FB'
  | 'MID-DM'
  | 'MID-CM'
  | 'MID-AM'
  | 'FWD-W'
  | 'FWD-ST';

export type PreferredFoot = 'L' | 'R' | 'Both';

export type PersonalityTag =
  | 'Professional'
  | 'Mercurial'
  | 'Loyal'
  | 'Ambitious'
  | 'Hothead'
  | 'Leader'
  | 'Quiet'
  | 'Showboat';

export type PlayerTier = 'domestic' | 'foreign-resident' | 'foreign-nt-stub';

export interface FullPlayerStats {
  pace: number;
  finishing: number;
  passing: number;
  dribbling: number;
  defending: number;
  heading: number;
  goalkeeping: number;
  vision: number;
  physicality: number;
  technique: number;

  injuryProneness: number;
  potential: number;
  personality: PersonalityTag;
  consistency: number;
  workRate: number;

  ovr: number;
}

export interface Injury {
  description: string;
  startedSeason: number;
  startedMatchday: number;
  expectedReturnMatchday: number;
}

export interface CareerEntry {
  season: number;
  clubId: string;
  competitionId: string | null;
  appearances: number;
  goals: number;
  assists: number;
  averageRating: number;
}

interface PlayerCommon {
  id: string;
  tier: PlayerTier;
  name: string;
  nationality: string;
  position: Position;
  preferredFoot: PreferredFoot;
  dateOfBirth: CalendarDate;
}

export interface DomesticPlayer extends PlayerCommon {
  tier: 'domestic';
  stats: FullPlayerStats;
  clubId: string;
  contractUntilSeason: number;
  squadNumber: number | null;
  currentForm: number;
  currentMorale: number;
  currentFitness: number;
  injury: Injury | null;
  careerHistory: CareerEntry[];
}

export interface ForeignResidentPlayer extends PlayerCommon {
  tier: 'foreign-resident';
  stats: FullPlayerStats;
  foreignClubId: string;
  contractUntilSeason: number;
  careerHistory: CareerEntry[];
}

export interface ForeignNTStubPlayer extends PlayerCommon {
  tier: 'foreign-nt-stub';
  foreignNTId: string;
  linkedPlayerId: string | null;
}

export type Player = DomesticPlayer | ForeignResidentPlayer | ForeignNTStubPlayer;
