/**
 * Result taxonomy for all four sport families (plan §1.4 / §4.5).
 * Phase 2 produces only the 'score' family; the other shapes are typed now so
 * later sports are a module, not schema surgery.
 */

export type ScoreDecidedBy = 'regulation' | 'extra-time' | 'shootout';

export type ResultPayload =
  | {
      family: 'score';
      /** Goals after play ends (incl. extra time). Shootout goals never count here. */
      score: [number, number];
      decidedBy: ScoreDecidedBy;
      shootout: [number, number] | null;
      /** Minute-by-minute elaboration; arrives with the Phase 3 engine. */
      detail: null;
    }
  | { family: 'sets'; sets: [number, number][] }
  | {
      family: 'marks';
      marks: { entryId: string; mark: number | null; status: 'ok' | 'dnf' | 'dsq' | 'dns' }[];
    }
  | { family: 'judged'; scores: { entryId: string; total: number }[] };

export type ResultMethod = 'manual' | 'sim' | 'dictated-sim';

export interface ResultProvenance {
  method: ResultMethod;
  /** Fresh-rolled per sim, stored for identical replay (plan §1.3). Null for manual. */
  seed: string | null;
  engineVersion: string | null;
  inputsDigest: string | null;
}

export interface ResultLifecycle {
  status: 'draft' | 'published';
  publishedAt: string | null;
  /** Every unlock is logged (plan §4.7). */
  unlocks: { at: string; note: string }[];
}

export interface ResultEnvelope {
  id: string;
  /** Entry ids, home first for head-to-head fixtures. */
  competitors: string[];
  payload: ResultPayload;
  provenance: ResultProvenance;
  lifecycle: ResultLifecycle;
  /** Drives integrity checks (stale-upstream detection). */
  modifiedAt: string;
}
