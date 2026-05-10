import type { CalendarDate } from './calendar';

export const POSITIONS = [
  'GK',
  'DEF-CB',
  'DEF-LB',
  'DEF-RB',
  'MID-CDM',
  'MID-CM',
  'MID-CAM',
  'MID-LM',
  'MID-RM',
  'FWD-LW',
  'FWD-RW',
  'FWD-ST',
] as const;

export type Position = (typeof POSITIONS)[number];

export const POSITION_GROUPS = {
  GK: ['GK'],
  DEF: ['DEF-CB', 'DEF-LB', 'DEF-RB'],
  MID: ['MID-CDM', 'MID-CM', 'MID-CAM', 'MID-LM', 'MID-RM'],
  FWD: ['FWD-LW', 'FWD-RW', 'FWD-ST'],
} as const satisfies Record<string, readonly Position[]>;

export const PERSONALITY_TAGS = [
  'Professional',
  'Mercurial',
  'Loyal',
  'Ambitious',
  'Hothead',
  'Leader',
  'Quiet',
  'Showboat',
  'Selfish',
  'Dedicated',
  'Casual',
  'Influential',
] as const;

export type PersonalityTag = (typeof PERSONALITY_TAGS)[number];

export type PlayerTier = 'domestic' | 'foreign-resident' | 'foreign-nt-stub';

export const OUTFIELD_GAME_STATS = [
  'pace',
  'finishing',
  'passing',
  'dribbling',
  'defending',
  'heading',
  'vision',
  'physicality',
  'technique',
] as const;

export const GK_GAME_STATS = ['handling', 'reflexes', 'kicking'] as const;

export const ALL_GAME_STATS = [...OUTFIELD_GAME_STATS, ...GK_GAME_STATS] as const;

export type GameStat = (typeof ALL_GAME_STATS)[number];

export type GameStatBlock = Record<GameStat, number>;

export interface FullPlayerStats extends GameStatBlock {
  injuryProneness: number;
  potential: number;
  personalities: PersonalityTag[];
  consistency: number;
  workRate: number;

  ovr: number;
}

export const MIN_PERSONALITIES = 1;
export const MAX_PERSONALITIES = 3;

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
  firstName: string;
  lastName: string;
  nationality: string;
  position: Position;
  dateOfBirth: CalendarDate;
}

export function displayName(player: { firstName: string; lastName: string }): string {
  const f = player.firstName.trim();
  const l = player.lastName.trim();
  if (!f) return l;
  if (!l) return f;
  return `${f} ${l}`;
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
