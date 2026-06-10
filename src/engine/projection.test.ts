import { describe, expect, it } from 'vitest';
import type { ResultEnvelope } from '../domain/spine';
import { projectResult } from './projection';

const envelope = (payload: ResultEnvelope['payload'], competitors: string[]): ResultEnvelope => ({
  id: 'r1',
  competitors,
  payload,
  provenance: { method: 'manual', seed: null, engineVersion: null, inputsDigest: null },
  lifecycle: { status: 'draft', publishedAt: null, unlocks: [] },
  modifiedAt: new Date().toISOString(),
});

describe('projectResult', () => {
  it('projects a regulation win', () => {
    const rows = projectResult(
      envelope(
        { family: 'score', score: [2, 1], decidedBy: 'regulation', shootout: null, detail: null },
        ['H', 'A'],
      ),
    );
    expect(rows).toEqual([
      { entryId: 'H', outcome: 'W', scoreFor: 2, scoreAgainst: 1, placing: null, mark: null },
      { entryId: 'A', outcome: 'L', scoreFor: 1, scoreAgainst: 2, placing: null, mark: null },
    ]);
  });

  it('shootout decides the outcome; its goals stay out of scoreFor/Against', () => {
    const rows = projectResult(
      envelope(
        { family: 'score', score: [1, 1], decidedBy: 'shootout', shootout: [4, 5], detail: null },
        ['H', 'A'],
      ),
    );
    expect(rows[0]).toMatchObject({ entryId: 'H', outcome: 'L', scoreFor: 1, scoreAgainst: 1 });
    expect(rows[1]).toMatchObject({ entryId: 'A', outcome: 'W' });
  });

  it('future families throw a Phase-8 marker, not silent nonsense', () => {
    expect(() =>
      projectResult(envelope({ family: 'sets', sets: [[6, 4]] }, ['H', 'A'])),
    ).toThrow(/Phase 8/);
  });
});
