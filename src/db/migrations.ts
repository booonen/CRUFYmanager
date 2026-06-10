import type { Savefile } from '../domain/savefile';
import { SCHEMA_VERSION } from '../domain/savefile';

export type Migration = (savefile: Savefile) => Savefile;

// No registered migrations yet. Phase 2 is still in active development —
// the schema is mutating freely; in-flight saves don't need to be preserved.
// When CRUFY ships publicly the next breaking change will register the
// first real migration here and bump SCHEMA_VERSION.
const migrations: Record<number, Migration> = {};

/**
 * In-development baseline normalizer. Entry.seeding changed from
 * `{ mode: 'rank' | 'rating'; value }` to a plain higher-is-better decimal.
 * Old rank-mode values (1 = best) are inverted within their event so existing
 * dev saves keep a sensible order.
 */
function normalizeSeeding(savefile: Savefile): Savefile {
  let touched = false;
  const competitions = savefile.competitions.map((comp) => ({
    ...comp,
    sportEvents: comp.sportEvents.map((event) => {
      const legacy = event.entries.filter(
        (e) => typeof (e.seeding as unknown) === 'object' && e.seeding !== null,
      );
      if (legacy.length === 0) return event;
      touched = true;
      const oldOf = (e: (typeof event.entries)[number]) =>
        e.seeding as unknown as { mode: 'rank' | 'rating'; value: number };
      const maxRank = Math.max(
        0,
        ...legacy.filter((e) => oldOf(e).mode === 'rank').map((e) => oldOf(e).value),
      );
      return {
        ...event,
        entries: event.entries.map((e) => {
          if (typeof (e.seeding as unknown) !== 'object' || e.seeding === null) return e;
          const old = oldOf(e);
          return { ...e, seeding: old.mode === 'rank' ? maxRank + 1 - old.value : old.value };
        }),
      };
    }),
  }));
  return touched ? { ...savefile, competitions } : savefile;
}

export function migrate(savefile: Savefile): Savefile {
  let current = normalizeSeeding(savefile);
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
