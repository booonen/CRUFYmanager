import type { Savefile } from '../domain/savefile';
import { SCHEMA_VERSION } from '../domain/savefile';
import { ensureFreeAgentsClub } from '../utils/freeAgents';
import type { Club } from '../domain/club';
import type { Player } from '../domain/player';

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
  2: (sf) => {
    const players: Player[] = sf.players.map((p) => {
      if (p.tier === 'foreign-nt-stub') return p;
      const stats = p.stats as typeof p.stats & { personality?: string };
      const existing = (stats as { personalities?: string[] }).personalities;
      const seed: string[] = Array.isArray(existing) && existing.length > 0
        ? existing
        : stats.personality
        ? [stats.personality]
        : ['Professional'];
      const cleaned = { ...stats } as unknown as Record<string, unknown>;
      delete cleaned.personality;
      cleaned.personalities = seed;
      return { ...p, stats: cleaned as unknown as typeof p.stats };
    });
    return {
      ...sf,
      players,
      meta: { ...sf.meta, schemaVersion: 3 },
    };
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
