import type { MatchResult } from './match';

export type TeamRefKind = 'club' | 'foreign-club' | 'national-team' | 'foreign-nt';

export interface TeamRef {
  kind: TeamRefKind;
  id: string;
}

export interface ManualResult {
  homeScore: number;
  awayScore: number;
  notes: string;
  scorers: { playerId: string; minute: number; isOwnGoal: boolean }[];
}

export interface SimMatchResult {
  matchResult: MatchResult;
}

export type OtherMatchOutcome =
  | { mode: 'manual'; manual: ManualResult }
  | { mode: 'sim'; sim: SimMatchResult };

export interface OtherMatch {
  id: string;
  name: string;
  homeTeamRef: TeamRef;
  awayTeamRef: TeamRef;
  scheduledMatchday: number | null;
  outcome: OtherMatchOutcome | null;
}
