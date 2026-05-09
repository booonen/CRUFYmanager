export type CompetitionTemplate =
  | 'league-double-rr'
  | 'league-single-rr'
  | 'knockout-single'
  | 'knockout-two-leg'
  | 'group-then-knockout'
  | 'super-cup';

export interface PromotionRelegationLink {
  promoteCount: number;
  relegateCount: number;
  linkedCompetitionId: string;
}

export interface CompetitionConfig {
  participantClubIds: string[];
  promotionRelegation?: PromotionRelegationLink;
  templateParams: Record<string, unknown>;
}

export interface CompetitionTableRow {
  clubId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface CompetitionState {
  season: number;
  internalMatchdays: InternalMatchday[];
  table: CompetitionTableRow[];
  status: 'pending' | 'in-progress' | 'completed';
}

export interface InternalMatchday {
  index: number;
  fixtureIds: string[];
  played: boolean;
}

export interface CompetitionPastSeason {
  season: number;
  winnerClubId: string | null;
  runnerUpClubId: string | null;
  finalTable: CompetitionTableRow[];
  topScorerPlayerId: string | null;
}

export interface CompetitionHistory {
  pastSeasons: CompetitionPastSeason[];
}

export interface Competition {
  id: string;
  name: string;
  shortName: string;
  template: CompetitionTemplate;
  config: CompetitionConfig;
  state: CompetitionState;
  history: CompetitionHistory;
}
