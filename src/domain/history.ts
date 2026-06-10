import type { Competition } from './spine';

export interface SeasonRecord {
  season: number;
  competitionWinners: { competitionId: string; clubId: string | null }[];
  topScorers: { playerId: string; goals: number }[];
}

export interface PastSeason {
  season: number;
  archivedAt: string;
  records: SeasonRecord;
}

export interface AllTimeRecord {
  category: string;
  entries: AllTimeEntry[];
}

export interface AllTimeEntry {
  label: string;
  value: number;
  refKind: 'player' | 'club' | 'manager' | 'competition';
  refId: string;
}

export interface HistoryArchive {
  pastSeasons: PastSeason[];
  dissolvedCompetitions: Competition[];
  allTimeRecords: AllTimeRecord[];
}
