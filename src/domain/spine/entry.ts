import type { ParticipantRef } from './participant';

/** A graded RP. Schema ships in Phase 2; grading UI and Bonus math arrive in Phase 3. */
export interface RpGrade {
  id: string;
  roundId: string | null;
  label: string;
  grade: number;
}

export interface EntrySeeding {
  /** 'rating' = 0–100 strength scale; 'rank' = 1-is-best classic scorinator input. */
  mode: 'rating' | 'rank';
  value: number;
}

export interface Entry {
  id: string;
  participant: ParticipantRef;
  seeding: EntrySeeding;
  bonus: RpGrade[];
}
