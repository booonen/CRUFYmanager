import type { Savefile } from '../domain/savefile';
import { SCHEMA_VERSION } from '../domain/savefile';

export type Migration = (savefile: Savefile) => Savefile;

// No registered migrations yet. Phase 1 is still in active development —
// the schema is mutating freely; in-flight saves don't need to be preserved.
// When CRUFY ships publicly the next breaking change will register the
// first real migration here and bump SCHEMA_VERSION.
const migrations: Record<number, Migration> = {};

export function migrate(savefile: Savefile): Savefile {
  let current = savefile;
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
