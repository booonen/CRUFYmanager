import type { ParticipantRef } from './participant';

/**
 * A host-computed bonus value fed in at a matchday (grading systems are the
 * host's business — plan §1.2 / phase-3 Q3). At sim time a team's bonus is the
 * latest value with matchday ≤ the round's matchday (null matchday = baseline).
 * Values are plain rating units, additive on the seeding.
 */
export interface BonusEntry {
  id: string;
  matchday: number | null;
  value: number;
  note: string;
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
  bonus: BonusEntry[];
  /**
   * Style modifier, −5…+5 (decimals fine). The two sides' mods combine to
   * shift goal *volume* only — a +5 pair turns 2–1 into something like 5–4,
   * a −5 pair into 1–0. Winner and goal difference are never affected.
   */
  styleMod: number;
}
