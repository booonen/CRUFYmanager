import type { Round } from './round';

export type StageFormat =
  | { kind: 'league'; legs: 1 | 2 }
  | { kind: 'groups'; legs: 1 | 2 }
  | { kind: 'knockout'; legs: 1 | 2; thirdPlace: boolean; awayGoals: boolean } // final & third place always single-leg
  | { kind: 'single-match' };

export interface Group {
  id: string;
  name: string;
  entryIds: string[];
}

export type QualRule =
  | { kind: 'top-n-overall'; n: number }
  | { kind: 'top-n-per-group'; n: number }
  | { kind: 'best-of-place'; place: number; count: number };

export type PairingPattern = 'standard-cross' | 'ranked' | 'manual';

/**
 * Tiebreakers applied after points, in order. 'h2h' is a composite head-to-head
 * mini-table (points, then GD — never GF). House default ['gd', 'h2h']; 'gf' is
 * opt-in only: it is explicitly not used in NS RP competitions (question round Q3).
 */
export type TiebreakerRule = 'gd' | 'gf' | 'h2h';

export interface TiebreakerConfig {
  order: TiebreakerRule[];
}

export const DEFAULT_TIEBREAKERS: TiebreakerConfig = { order: ['gd', 'h2h'] };
export const DEFAULT_POINTS = { win: 3, draw: 1, loss: 0 };

/** How a knockout tie's slots are fed. Resolved entry ids are written onto fixtures. */
export type TieFeed =
  | { kind: 'tbd' }
  | { kind: 'entry'; entryId: string }
  | { kind: 'winner-of'; tieId: string }
  | { kind: 'loser-of'; tieId: string }
  | { kind: 'group-qualifier'; groupIndex: number; place: number }
  | { kind: 'seed'; position: number }
  | { kind: 'bye' };

export interface BracketTie {
  id: string;
  /** 0-based knockout phase (0 = first knockout round). Third place & final share the last phase. */
  phase: number;
  slot: number;
  home: TieFeed;
  away: TieFeed;
  isThirdPlace: boolean;
  isFinal: boolean;
}

export interface BracketStructure {
  ties: BracketTie[];
}

export interface Stage {
  id: string;
  name: string;
  format: StageFormat;
  /** Participants of this stage. First stage: all entries; later stages: fed by qualification. */
  entryIds: string[];
  groups: Group[];
  rounds: Round[];
  /** How THIS stage feeds the next one. */
  qualification: QualRule[];
  /** How qualifiers are seeded into the next stage. */
  pairing: PairingPattern;
  points: { win: number; draw: number; loss: number };
  tiebreakers: TiebreakerConfig;
  /** Host-resolved ties: each inner array is a tied set in chosen order (the "drawing of lots"). */
  manualTieOrder: string[][];
  /** Knockout wiring; null for non-knockout stages. */
  bracket: BracketStructure | null;
}
