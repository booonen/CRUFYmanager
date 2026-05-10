import type { Savefile } from '../domain/savefile';
import { SCHEMA_VERSION } from '../domain/savefile';
import { ensureFreeAgentsClub } from '../utils/freeAgents';
import type { Club } from '../domain/club';

export type Migration = (savefile: Savefile) => Savefile;

const migrations: Record<number, Migration> = {
  1: (sf) => {
    const clubs: Club[] = sf.clubs.map((c) => ({
      ...c,
      kind: c.kind ?? 'club',
    }));
    const next: Savefile = {
      ...sf,
      clubs,
      meta: { ...sf.meta, schemaVersion: 2 },
    };
    return ensureFreeAgentsClub(next);
  },
};

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
