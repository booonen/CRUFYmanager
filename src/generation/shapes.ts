import type { Position } from '../domain/player';

export const DEFAULT_SQUAD_SIZE = 25;

/** Positional distribution for a 25-man squad. Plan §10 / Phase 2 §3.5. */
export const DEFAULT_SQUAD_SHAPE: Record<Position, number> = {
  GK: 3,
  'DEF-CB': 4,
  'DEF-LB': 2,
  'DEF-RB': 2,
  'MID-CDM': 2,
  'MID-CM': 3,
  'MID-CAM': 2,
  'MID-LM': 1,
  'MID-RM': 1,
  'FWD-LW': 1,
  'FWD-RW': 1,
  'FWD-ST': 3,
};

export interface AgeBucket {
  count: number;
  minAge: number;
  maxAge: number;
}

/** A 25-man squad's age curve, by bucket. Total == DEFAULT_SQUAD_SIZE. */
export const DEFAULT_AGE_BUCKETS: readonly AgeBucket[] = [
  { count: 1, minAge: 33, maxAge: 37 }, // veteran
  { count: 6, minAge: 28, maxAge: 32 }, // senior
  { count: 12, minAge: 23, maxAge: 27 }, // prime
  { count: 5, minAge: 17, maxAge: 22 }, // youth
  { count: 1, minAge: 18, maxAge: 24 }, // backup keeper bias (slot is age-only; squad shape handles GK count)
];

export interface OvrBucket {
  /** Count of players in this bucket within the 25-man squad. */
  count: number;
  /** Offset (added to club target OVR) for the lower bound. */
  offsetLow: number;
  /** Offset (added to club target OVR) for the upper bound. */
  offsetHigh: number;
}

/** OVR distribution within a 25-man squad targeting club OVR C. Total == DEFAULT_SQUAD_SIZE. */
export const DEFAULT_OVR_BUCKETS: readonly OvrBucket[] = [
  { count: 2, offsetLow: 6, offsetHigh: 10 }, // stars
  { count: 9, offsetLow: 0, offsetHigh: 5 }, // first-team regulars
  { count: 9, offsetLow: -3, offsetHigh: 2 }, // squad players
  { count: 5, offsetLow: -8, offsetHigh: -1 }, // reserves / youth
];

/** Top-tier club-OVR target with a step per tier downward. */
export const TIER_OVR_TOP = 78;
export const TIER_OVR_STEP = 10;
/** Within a tier, club-OVR spread around the tier midpoint. */
export const TIER_OVR_SPREAD = 6;

export const STAT_VALUE_MIN = 1;
export const STAT_VALUE_MAX = 99;
