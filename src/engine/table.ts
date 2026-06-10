import type { Fixture, TiebreakerConfig } from '../domain/spine';
import { projectResult } from './projection';

export interface TableRow {
  entryId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  /** 1-based, sequential (tied rows still get distinct positions). */
  position: number;
  /** True when tiebreakers + manual order failed to separate this row from a neighbour. */
  unresolved: boolean;
}

export interface TableConfig {
  points: { win: number; draw: number; loss: number };
  tiebreakers: TiebreakerConfig;
  manualTieOrder: string[][];
}

interface Acc {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
}

function accumulate(entryIds: string[], fixtures: Fixture[]): Map<string, Acc> {
  const acc = new Map<string, Acc>();
  for (const id of entryIds) {
    acc.set(id, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 });
  }
  for (const fx of fixtures) {
    if (!fx.result || fx.result.payload.family !== 'score') continue;
    for (const row of projectResult(fx.result)) {
      const a = acc.get(row.entryId);
      if (!a) continue; // result involving an entry outside this table (defensive)
      a.played += 1;
      if (row.outcome === 'W') a.won += 1;
      else if (row.outcome === 'D') a.drawn += 1;
      else if (row.outcome === 'L') a.lost += 1;
      a.gf += row.scoreFor ?? 0;
      a.ga += row.scoreAgainst ?? 0;
    }
  }
  return acc;
}

function points(a: Acc, cfg: TableConfig): number {
  return a.won * cfg.points.win + a.drawn * cfg.points.draw + a.lost * cfg.points.loss;
}

function partitionBy<T>(sorted: T[], key: (t: T) => string): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  let currentKey: string | null = null;
  for (const item of sorted) {
    const k = key(item);
    if (currentKey === null || k !== currentKey) {
      if (current.length > 0) out.push(current);
      current = [item];
      currentKey = k;
    } else {
      current.push(item);
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/**
 * Orders entries by: points, then the configured tiebreakers ('h2h' is a composite
 * mini-table — points then GD among the tied set, never GF), then manualTieOrder
 * ("drawing of lots" by host decision). Whatever is still tied is flagged unresolved.
 */
export function computeTable(
  entryIds: string[],
  fixtures: Fixture[],
  config: TableConfig,
): TableRow[] {
  const acc = accumulate(entryIds, fixtures);
  const baseIndex = new Map(entryIds.map((id, i) => [id, i]));
  const stable = (a: string, b: string) => (baseIndex.get(a) ?? 0) - (baseIndex.get(b) ?? 0);

  const pts = (id: string) => points(acc.get(id) ?? emptyAcc(), config);
  const gd = (id: string) => {
    const a = acc.get(id) ?? emptyAcc();
    return a.gf - a.ga;
  };
  const gf = (id: string) => (acc.get(id) ?? emptyAcc()).gf;

  let partitions: string[][] = partitionBy(
    [...entryIds].sort((a, b) => pts(b) - pts(a) || stable(a, b)),
    (id) => String(pts(id)),
  );

  for (const rule of config.tiebreakers.order) {
    partitions = partitions.flatMap((p) => {
      if (p.length < 2) return [p];
      if (rule === 'gd') {
        return partitionBy([...p].sort((a, b) => gd(b) - gd(a) || stable(a, b)), (id) => String(gd(id)));
      }
      if (rule === 'gf') {
        return partitionBy([...p].sort((a, b) => gf(b) - gf(a) || stable(a, b)), (id) => String(gf(id)));
      }
      // h2h: mini-table among the tied set only — points, then GD (no GF; NS convention).
      const subset = new Set(p);
      const miniFixtures = fixtures.filter(
        (fx) =>
          fx.homeEntryId !== null &&
          fx.awayEntryId !== null &&
          subset.has(fx.homeEntryId) &&
          subset.has(fx.awayEntryId),
      );
      const mini = accumulate(p, miniFixtures);
      const mPts = (id: string) => points(mini.get(id) ?? emptyAcc(), config);
      const mGd = (id: string) => {
        const a = mini.get(id) ?? emptyAcc();
        return a.gf - a.ga;
      };
      return partitionBy(
        [...p].sort((a, b) => mPts(b) - mPts(a) || mGd(b) - mGd(a) || stable(a, b)),
        (id) => `${mPts(id)}|${mGd(id)}`,
      );
    });
  }

  // Manual tie order: a stored set that covers the partition orders it.
  partitions = partitions.flatMap((p) => {
    if (p.length < 2) return [p];
    const manual = config.manualTieOrder.find((order) => p.every((id) => order.includes(id)));
    if (!manual) return [p];
    const sorted = [...p].sort((a, b) => manual.indexOf(a) - manual.indexOf(b));
    return sorted.map((id) => [id]);
  });

  const rows: TableRow[] = [];
  let position = 1;
  for (const p of partitions) {
    for (const id of p) {
      const a = acc.get(id) ?? emptyAcc();
      rows.push({
        entryId: id,
        played: a.played,
        won: a.won,
        drawn: a.drawn,
        lost: a.lost,
        gf: a.gf,
        ga: a.ga,
        gd: a.gf - a.ga,
        points: points(a, config),
        position,
        unresolved: p.length > 1,
      });
      position += 1;
    }
  }
  return rows;
}

function emptyAcc(): Acc {
  return { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
}
