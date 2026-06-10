import type { ParticipantRef } from './participant';

/** A graded RP. Schema ships in Phase 2; grading UI and Bonus math arrive in Phase 3. */
export interface RpGrade {
  id: string;
  roundId: string | null;
  label: string;
  grade: number;
}

/**
 * Seeding rating: a plain decimal, higher = better, scale-free — hosts bring
 * their own convention (football ranks run ~0–30 with two decimals, Olympics
 * events use 0–100). Only internal consistency within an event matters;
 * the Phase 3 engine treats the scale per the same invariance principle as
 * the Bonus (plan §1.2).
 */
export type EntrySeeding = number;

export interface Entry {
  id: string;
  participant: ParticipantRef;
  seeding: EntrySeeding;
  bonus: RpGrade[];
}
