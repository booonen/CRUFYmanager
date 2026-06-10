import { describe, expect, it } from 'vitest';
import type { Fixture, ResultEnvelope } from '../domain/spine';
import { DEFAULT_POINTS, DEFAULT_TIEBREAKERS } from '../domain/spine';
import { computeTable, type TableConfig } from './table';

let n = 0;
function fx(home: string, away: string, hg: number, ag: number, shootout?: [number, number]): Fixture {
  n += 1;
  const result: ResultEnvelope = {
    id: `r${n}`,
    competitors: [home, away],
    payload: {
      family: 'score',
      score: [hg, ag],
      decidedBy: shootout ? 'shootout' : 'regulation',
      shootout: shootout ?? null,
      detail: null,
    },
    provenance: { method: 'manual', seed: null, engineVersion: null, inputsDigest: null },
    lifecycle: { status: 'draft', publishedAt: null, unlocks: [] },
    modifiedAt: new Date().toISOString(),
  };
  return {
    id: `f${n}`,
    homeEntryId: home,
    awayEntryId: away,
    groupId: null,
    tieId: null,
    leg: null,
    isBye: false,
    result,
  };
}

const cfg = (over?: Partial<TableConfig>): TableConfig => ({
  points: { ...DEFAULT_POINTS },
  tiebreakers: { order: [...DEFAULT_TIEBREAKERS.order] },
  manualTieOrder: [],
  ...over,
});

describe('computeTable', () => {
  it('points, W/D/L and GD accumulate; order by points then GD', () => {
    const rows = computeTable(
      ['A', 'B', 'C'],
      [fx('A', 'B', 3, 0), fx('B', 'C', 1, 1), fx('C', 'A', 0, 1)],
      cfg(),
    );
    expect(rows.map((r) => r.entryId)).toEqual(['A', 'C', 'B']);
    expect(rows[0]).toMatchObject({ played: 2, won: 2, drawn: 0, lost: 0, points: 6, gf: 4, ga: 0, gd: 4 });
    expect(rows[1]).toMatchObject({ entryId: 'C', points: 1, gd: -1 });
    expect(rows[2]).toMatchObject({ entryId: 'B', points: 1, gd: -3 });
  });

  it('GD tiebreak orders points-tied teams', () => {
    const rows = computeTable(['A', 'B', 'C', 'D'], [fx('A', 'B', 2, 0), fx('C', 'D', 1, 0)], cfg());
    expect(rows.map((r) => r.entryId)).toEqual(['A', 'C', 'D', 'B']);
    expect(rows.every((r) => !r.unresolved)).toBe(true);
  });

  it('head-to-head resolves after GD; GF is never consulted by default', () => {
    // X and Y both finish on 6 pts, +5 GD; Y has more GF (8 vs 7) but X won the
    // head-to-head — so X must rank above Y under the NS default.
    const rows = computeTable(
      ['X', 'Y', 'Z', 'W'],
      [
        fx('X', 'Y', 1, 0), // h2h: X over Y
        fx('X', 'W', 5, 0),
        fx('Z', 'X', 2, 1),
        fx('Y', 'Z', 6, 1),
        fx('Y', 'W', 2, 1),
      ],
      cfg(),
    );
    const x = rows.find((r) => r.entryId === 'X');
    const y = rows.find((r) => r.entryId === 'Y');
    expect(x?.points).toBe(y?.points);
    expect(x?.gd).toBe(y?.gd);
    expect(x?.gf).toBeLessThan(y?.gf ?? 0);
    expect(x?.position).toBeLessThan(y?.position ?? 0); // h2h wins despite lower GF
    expect(x?.unresolved).toBe(false);
  });

  it('truly tied pair is unresolved by default but ordered when gf is opted in', () => {
    const fixtures = [
      fx('A', 'C', 2, 0),
      fx('B', 'D', 3, 1), // same W, same GD, B has more GF
      fx('A', 'B', 0, 0), // h2h level
      fx('C', 'D', 0, 0),
    ];
    const def = computeTable(['A', 'B', 'C', 'D'], fixtures, cfg());
    const a1 = def.find((r) => r.entryId === 'A');
    const b1 = def.find((r) => r.entryId === 'B');
    expect(a1?.unresolved).toBe(true);
    expect(b1?.unresolved).toBe(true);

    const withGf = computeTable(
      ['A', 'B', 'C', 'D'],
      fixtures,
      cfg({ tiebreakers: { order: ['gd', 'gf', 'h2h'] } }),
    );
    expect(withGf.find((r) => r.entryId === 'B')?.position).toBeLessThan(
      withGf.find((r) => r.entryId === 'A')?.position ?? 0,
    );
    expect(withGf.find((r) => r.entryId === 'B')?.unresolved).toBe(false);
  });

  it('manualTieOrder is the final word (the drawing of lots)', () => {
    const fixtures = [fx('A', 'B', 0, 0), fx('A', 'B', 0, 0)];
    const unresolved = computeTable(['A', 'B'], fixtures, cfg());
    expect(unresolved.every((r) => r.unresolved)).toBe(true);

    const decided = computeTable(['A', 'B'], fixtures, cfg({ manualTieOrder: [['B', 'A']] }));
    expect(decided.map((r) => r.entryId)).toEqual(['B', 'A']);
    expect(decided.every((r) => !r.unresolved)).toBe(true);
  });

  it('shootout decides W/L but its goals never count toward GF/GA', () => {
    const rows = computeTable(['A', 'B'], [fx('A', 'B', 1, 1, [5, 4])], cfg());
    const a = rows.find((r) => r.entryId === 'A');
    const b = rows.find((r) => r.entryId === 'B');
    expect(a).toMatchObject({ won: 1, drawn: 0, points: 3, gf: 1, ga: 1 });
    expect(b).toMatchObject({ lost: 1, points: 0, gf: 1 });
  });
});
