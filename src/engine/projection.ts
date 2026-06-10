import type { ResultEnvelope } from '../domain/spine';

/**
 * The spine consumes projections; sport modules own payload shapes (plan §4.6).
 * Standings/bracket engines never inspect sport-specific payloads directly.
 */
export interface OutcomeRow {
  entryId: string;
  outcome: 'W' | 'D' | 'L' | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  placing: number | null;
  mark: number | null;
}

export function projectResult(envelope: ResultEnvelope): OutcomeRow[] {
  const { payload, competitors } = envelope;
  switch (payload.family) {
    case 'score': {
      const home = competitors[0];
      const away = competitors[1];
      if (!home || !away) {
        throw new Error('score result requires two competitors');
      }
      const [hg, ag] = payload.score;
      let homeOutcome: 'W' | 'D' | 'L';
      if (hg !== ag) {
        homeOutcome = hg > ag ? 'W' : 'L';
      } else if (payload.decidedBy === 'shootout' && payload.shootout) {
        // Shootout decides the outcome but its goals never count toward GF/GA.
        const [hs, as] = payload.shootout;
        homeOutcome = hs > as ? 'W' : 'L';
      } else {
        homeOutcome = 'D';
      }
      const awayOutcome = homeOutcome === 'W' ? 'L' : homeOutcome === 'L' ? 'W' : 'D';
      return [
        { entryId: home, outcome: homeOutcome, scoreFor: hg, scoreAgainst: ag, placing: null, mark: null },
        { entryId: away, outcome: awayOutcome, scoreFor: ag, scoreAgainst: hg, placing: null, mark: null },
      ];
    }
    case 'sets':
    case 'marks':
    case 'judged':
      throw new Error(`result family '${payload.family}' lands with its sport module (Phase 8)`);
  }
}
