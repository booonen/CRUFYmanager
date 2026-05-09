export interface MatchEvent {
  minute: number;
  type:
    | 'kickoff'
    | 'shot'
    | 'goal'
    | 'foul'
    | 'yellow-card'
    | 'red-card'
    | 'substitution'
    | 'injury'
    | 'half-time'
    | 'full-time'
    | 'commentary';
  description: string;
  involvedPlayerIds: string[];
  reasonStats: Record<string, number>;
}

export interface NarrativeSummary {
  momentumSwings: number;
  siegeMinutes: number;
  openMinutes: number;
  finalTilt: 'home' | 'away' | 'even';
  headlinePlayerId: string | null;
}

export interface MatchStatsBox {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  offsides: { home: number; away: number };
}

export interface MatchResult {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  playerRatings: Record<string, number>;
  narrative: NarrativeSummary;
  statsBox: MatchStatsBox;
  seed: string;
}
