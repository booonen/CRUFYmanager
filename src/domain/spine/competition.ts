import type { SportEvent } from './event';

/**
 * A hosted property: league, cup, or (later) a multi-event Games.
 * Free-running by nature (question round Q2): the schedule IS the stages/rounds,
 * advanced at the host's own pace. No real-world-date mapping exists.
 */
export interface Competition {
  id: string;
  name: string;
  shortName: string;
  sportEvents: SportEvent[];
}
