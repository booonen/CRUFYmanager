/**
 * Per-savefile scorination parameters (ratified plan §1.3: randomness is
 * per-save). Gaps are normalized against each event's zero-anchored rating
 * scale, so these knobs are scale-free.
 */
export interface SimParams {
  /** Expected total goals in a match between equals. */
  goalsPerMatch: number;
  /** Per-match form noise, in normalized-gap units (0..1 scale). The upset knob. */
  chaos: number;
  /** Slope of the logistic curve mapping normalized gap → goal share. */
  favoritism: number;
  /** Home advantage as a fraction of the rating scale (0 = neutral venues). */
  homeEdge: number;
  /** Mutual goals added/removed per point of combined style mod (volume only). */
  styleImpact: number;
}

export interface ScorinationSettings {
  sim: SimParams;
}

export const DEFAULT_SIM_PARAMS: SimParams = {
  goalsPerMatch: 2.7,
  chaos: 0.1,
  favoritism: 4.5,
  homeEdge: 0,
  styleImpact: 0.35,
};

export const DEFAULT_SCORINATION: ScorinationSettings = {
  sim: { ...DEFAULT_SIM_PARAMS },
};
