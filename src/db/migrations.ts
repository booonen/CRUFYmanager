import type { Savefile } from '../domain/savefile';
import { SCHEMA_VERSION } from '../domain/savefile';
import { DEFAULT_SCORINATION } from '../domain/scorination';

export type Migration = (savefile: Savefile) => Savefile;

// No registered migrations yet. Phase 2 is still in active development —
// the schema is mutating freely; in-flight saves don't need to be preserved.
// When CRUFY ships publicly the next breaking change will register the
// first real migration here and bump SCHEMA_VERSION.
const migrations: Record<number, Migration> = {};

/**
 * In-development baseline normalizers (saves are disposable, but cheap fixes
 * keep dev worlds alive):
 * - Entry.seeding changed from `{ mode: 'rank' | 'rating'; value }` to a plain
 *   higher-is-better decimal; old rank-mode values (1 = best) are inverted
 *   within their event.
 * - Round.calendarMatchday added; rounds without it get consecutive matchdays
 *   from 1 per competition.
 */
function normalizeBaseline(savefile: Savefile): Savefile {
  let touched = false;
  // Phase 3 additions: per-save sim params, per-event rating scale max.
  let scorination = savefile.scorination;
  if (!scorination || !scorination.sim) {
    scorination = { sim: { ...DEFAULT_SCORINATION.sim } };
    touched = true;
  } else {
    const merged = { ...DEFAULT_SCORINATION.sim, ...scorination.sim };
    if (Object.keys(merged).some((k) => !(k in scorination.sim))) touched = true;
    scorination = { ...scorination, sim: merged };
  }
  const competitions = savefile.competitions.map((comp) => {
    let md = 1;
    return {
      ...comp,
      sportEvents: comp.sportEvents.map((event) => {
        const legacy = event.entries.filter(
          (e) => typeof (e.seeding as unknown) === 'object' && e.seeding !== null,
        );
        const oldOf = (e: (typeof event.entries)[number]) =>
          e.seeding as unknown as { mode: 'rank' | 'rating'; value: number };
        const maxRank = Math.max(
          0,
          ...legacy.filter((e) => oldOf(e).mode === 'rank').map((e) => oldOf(e).value),
        );
        let entries =
          legacy.length === 0
            ? event.entries
            : event.entries.map((e) => {
                if (typeof (e.seeding as unknown) !== 'object' || e.seeding === null) return e;
                const old = oldOf(e);
                return { ...e, seeding: old.mode === 'rank' ? maxRank + 1 - old.value : old.value };
              });
        if (legacy.length > 0) touched = true;
        if (entries.some((e) => (e as { styleMod?: number }).styleMod === undefined)) {
          touched = true;
          entries = entries.map((e) => ({ ...e, styleMod: (e as { styleMod?: number }).styleMod ?? 0 }));
        }

        const stages = event.stages.map((stage) => ({
          ...stage,
          rounds: stage.rounds.map((round) => {
            const has = (round as { calendarMatchday?: number | null }).calendarMatchday !== undefined;
            const assigned = md <= savefile.calendar.matchdaysPerSeason ? md : null;
            md += 1;
            if (has) return round;
            touched = true;
            return { ...round, calendarMatchday: assigned };
          }),
        }));

        const ratingMax = (event as { ratingMax?: number | null }).ratingMax;
        if (ratingMax === undefined) touched = true;
        return { ...event, ratingMax: ratingMax ?? null, entries, stages };
      }),
    };
  });
  return touched ? { ...savefile, competitions, scorination } : savefile;
}

export function migrate(savefile: Savefile): Savefile {
  let current = normalizeBaseline(savefile);
  let from = current.meta.schemaVersion;

  while (from < SCHEMA_VERSION) {
    const step = migrations[from];
    if (!step) {
      throw new Error(`No migration registered from schemaVersion ${from} to ${from + 1}`);
    }
    current = step(current);
    from = current.meta.schemaVersion;
  }

  if (current.meta.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Savefile schemaVersion ${current.meta.schemaVersion} is newer than supported ${SCHEMA_VERSION}. ` +
        'Open this savefile in a newer build of CRUFYmanager.',
    );
  }

  return current;
}

export function registerMigration(fromVersion: number, step: Migration): void {
  migrations[fromVersion] = step;
}
