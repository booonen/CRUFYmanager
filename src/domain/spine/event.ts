import type { Entry } from './entry';
import type { Stage } from './stage';

export type SportId = 'football';

export interface SportEvent {
  id: string;
  name: string;
  sport: SportId;
  entries: Entry[];
  /** Ordered; stage N's qualification feeds stage N+1. */
  stages: Stage[];
}
