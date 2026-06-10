import type { Entry, SportEvent, Stage, TieFeed } from '../domain/spine';
import { propagateBracket, type ExternalFeedResolver } from './bracket';
import { computeTable, type TableConfig, type TableRow } from './table';

export function tableConfigOf(stage: Stage): TableConfig {
  return {
    points: stage.points,
    tiebreakers: stage.tiebreakers,
    manualTieOrder: stage.manualTieOrder,
  };
}

/** Better seed first: higher rating wins; ties keep entry-list order (stable). */
export function orderEntriesBySeeding(entries: Entry[]): Entry[] {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.seeding - a.entry.seeding || a.index - b.index)
    .map((x) => x.entry);
}

export function stageGroupFixtures(stage: Stage, groupId: string) {
  return stage.rounds.flatMap((r) => r.fixtures.filter((fx) => fx.groupId === groupId));
}

export function stageAllFixtures(stage: Stage) {
  return stage.rounds.flatMap((r) => r.fixtures);
}

/** Group tables in group order; for league stages use computeOverallTable. */
export function computeGroupTables(stage: Stage): Map<string, TableRow[]> {
  const out = new Map<string, TableRow[]>();
  for (const group of stage.groups) {
    out.set(group.id, computeTable(group.entryIds, stageGroupFixtures(stage, group.id), tableConfigOf(stage)));
  }
  return out;
}

export function computeOverallTable(stage: Stage): TableRow[] {
  return computeTable(stage.entryIds, stageAllFixtures(stage), tableConfigOf(stage));
}

/** Cumulative standings as of a matchday: only rounds with index ≤ roundIndex count. */
export function computeGroupTablesThrough(stage: Stage, roundIndex: number): Map<string, TableRow[]> {
  const fixtures = stage.rounds.filter((r) => r.index <= roundIndex).flatMap((r) => r.fixtures);
  const out = new Map<string, TableRow[]>();
  for (const group of stage.groups) {
    out.set(
      group.id,
      computeTable(
        group.entryIds,
        fixtures.filter((fx) => fx.groupId === group.id),
        tableConfigOf(stage),
      ),
    );
  }
  return out;
}

export function computeOverallTableThrough(stage: Stage, roundIndex: number): TableRow[] {
  const fixtures = stage.rounds.filter((r) => r.index <= roundIndex).flatMap((r) => r.fixtures);
  return computeTable(stage.entryIds, fixtures, tableConfigOf(stage));
}

/** Every non-bye fixture has a result (occupants included — TBD slots fail this). */
export function stageComplete(stage: Stage): boolean {
  for (const round of stage.rounds) {
    for (const fx of round.fixtures) {
      if (fx.isBye) continue;
      if (!fx.homeEntryId || !fx.awayEntryId || !fx.result) return false;
    }
  }
  return true;
}

export interface Qualifier {
  entryId: string;
  groupIndex: number; // -1 for overall-table qualifiers
  place: number;
  points: number;
  gd: number;
}

/** Evaluates the stage's qualification rules over current standings. */
export function computeQualifiers(stage: Stage): Qualifier[] {
  const out: Qualifier[] = [];
  const groupTables = stage.groups.length > 0 ? computeGroupTables(stage) : null;

  for (const rule of stage.qualification) {
    if (rule.kind === 'top-n-per-group' && groupTables) {
      stage.groups.forEach((group, groupIndex) => {
        const rows = groupTables.get(group.id) ?? [];
        for (let place = 1; place <= rule.n; place++) {
          const row = rows[place - 1];
          if (row) out.push({ entryId: row.entryId, groupIndex, place, points: row.points, gd: row.gd });
        }
      });
    } else if (rule.kind === 'best-of-place' && groupTables) {
      const candidates: Qualifier[] = [];
      stage.groups.forEach((group, groupIndex) => {
        const row = (groupTables.get(group.id) ?? [])[rule.place - 1];
        if (row) candidates.push({ entryId: row.entryId, groupIndex, place: rule.place, points: row.points, gd: row.gd });
      });
      // Rank by points then GD — never GF (NS convention), then stable by group order.
      candidates.sort((a, b) => b.points - a.points || b.gd - a.gd || a.groupIndex - b.groupIndex);
      out.push(...candidates.slice(0, rule.count));
    } else if (rule.kind === 'top-n-overall') {
      const rows = computeOverallTable(stage);
      for (let place = 1; place <= rule.n; place++) {
        const row = rows[place - 1];
        if (row) out.push({ entryId: row.entryId, groupIndex: -1, place, points: row.points, gd: row.gd });
      }
    }
  }
  return out;
}

/** Qualifiers in seeding order for 'ranked' pairing: place, then points, then GD. */
export function rankQualifiers(qualifiers: Qualifier[]): Qualifier[] {
  return [...qualifiers].sort(
    (a, b) => a.place - b.place || b.points - a.points || b.gd - a.gd || a.groupIndex - b.groupIndex,
  );
}

/**
 * Resolver for a knockout stage's external feeds ('seed' / 'group-qualifier'),
 * backed by the previous stage's standings. Gated on source-stage completion
 * unless forced (the "Seed next stage now" God-mode button).
 */
export function externalResolverFor(event: SportEvent, stageIndex: number, force: boolean): ExternalFeedResolver {
  const source = stageIndex > 0 ? event.stages[stageIndex - 1] : undefined;
  if (!source) return () => null;
  const ready = force || stageComplete(source);
  if (!ready) return () => null;

  const groupTables = source.groups.length > 0 ? computeGroupTables(source) : null;
  const ranked = rankQualifiers(computeQualifiers(source));

  return (feed: TieFeed): string | null => {
    if (feed.kind === 'group-qualifier' && groupTables) {
      const group = source.groups[feed.groupIndex];
      if (!group) return null;
      const row = (groupTables.get(group.id) ?? [])[feed.place - 1];
      return row?.entryId ?? null;
    }
    if (feed.kind === 'seed') {
      return ranked[feed.position - 1]?.entryId ?? null;
    }
    return null;
  };
}

/**
 * Reflow: re-propagate every knockout stage from its feeds (auto-filling slots as
 * source stages complete) and refresh derived entry lists. Pure; run after any
 * spine mutation.
 */
export function reflowEvent(event: SportEvent, options?: { forceStageIndex?: number }): SportEvent {
  let current = event;
  current.stages.forEach((_, i) => {
    const stage = current.stages[i];
    if (!stage || stage.format.kind !== 'knockout' || !stage.bracket) return;
    const force = options?.forceStageIndex === i;
    const awayGoals = stage.format.awayGoals;
    const { stage: next } = propagateBracket(stage, awayGoals, externalResolverFor(current, i, force));
    const occupantIds = new Set<string>();
    for (const round of next.rounds) {
      for (const fx of round.fixtures) {
        if (fx.homeEntryId) occupantIds.add(fx.homeEntryId);
        if (fx.awayEntryId) occupantIds.add(fx.awayEntryId);
      }
    }
    const withEntries: Stage = { ...next, entryIds: [...occupantIds] };
    current = { ...current, stages: current.stages.map((s, j) => (j === i ? withEntries : s)) };
  });
  return current;
}
