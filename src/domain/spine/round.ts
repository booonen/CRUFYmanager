import type { ResultEnvelope } from './result';

export interface Fixture {
  id: string;
  /** Null = TBD bracket slot awaiting qualification/manual assignment (or a bye's empty side). */
  homeEntryId: string | null;
  awayEntryId: string | null;
  groupId: string | null;
  /** Links the legs of a two-leg knockout tie. */
  tieId: string | null;
  leg: 1 | 2 | null;
  /** Generated as a bye: the lone occupant advances without a result. */
  isBye: boolean;
  result: ResultEnvelope | null;
}

export interface Round {
  id: string;
  index: number;
  /** Auto-named at generation ("Matchday 4", "Semifinals · Leg 2"); renamable. */
  name: string;
  fixtures: Fixture[];
}
