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
  3: (sf) => {
    const clubs = sf.clubs.map((c) => ({ ...c, logoUrl: c.logoUrl ?? null }));

    const players = sf.players.map((p) => {
      const legacy = p as unknown as {
        name?: string;
        firstName?: string;
        lastName?: string;
        preferredFoot?: unknown;
      };
      const cleaned = { ...p } as unknown as Record<string, unknown>;
      delete cleaned.preferredFoot;
      if (typeof legacy.firstName === 'string' && typeof legacy.lastName === 'string') {
        delete cleaned.name;
        return cleaned as unknown as Player;
      }
      const raw = (legacy.name ?? '').trim();
      const tokens = raw ? raw.split(/\s+/) : [];
      let firstName = '';
      let lastName = '';
      if (tokens.length >= 2) {
        firstName = tokens.slice(0, -1).join(' ');
        lastName = tokens[tokens.length - 1] ?? '';
      } else {
        firstName = tokens[0] ?? '';
        lastName = '';
      }
      cleaned.firstName = firstName;
      cleaned.lastName = lastName;
      delete cleaned.name;
      return cleaned as unknown as Player;
    });

    const foreignWorld = {
      ...sf.foreignWorld,
      clubs: sf.foreignWorld.clubs.map((c) => ({ ...c, logoUrl: c.logoUrl ?? null })),
      nationalTeams: sf.foreignWorld.nationalTeams.map((nt) => ({
        ...nt,
        flagUrl: nt.flagUrl ?? null,
      })),
    };

    return {
      ...sf,
      clubs,
      players,
      foreignWorld,
      meta: { ...sf.meta, schemaVersion: 4 },
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
