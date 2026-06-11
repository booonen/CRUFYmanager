import type { Entry } from './entry';
import type { Stage } from './stage';

export type SportId = 'football';

export interface SportEvent {
  id: string;
  name: string;
  sport: SportId;
  /**
   * Top of the zero-anchored rating scale for this event (phase-3 Q2).
   * Null = derive from the highest entry seeding.
   */
  ratingMax: number | null;
  entries: Entry[];
  /** Ordered; stage N's qualification feeds stage N+1. */
  stages: Stage[];
}
