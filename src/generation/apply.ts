import type { Manager } from '../domain/manager';
import { recomputeClubOvrs } from '../stores/clubs';
import { useSavefileStore } from '../stores/savefile';
import type { GeneratedLeague } from './leagueGen';
import type { GeneratedSquad } from './squadGen';

/** Splice a generated league (clubs + players + managers) into the active savefile. */
export function applyGeneratedLeague(league: GeneratedLeague): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    clubs: [...sf.clubs, ...league.clubs],
    players: [...sf.players, ...league.players],
    managers: [...sf.managers, ...league.managers],
  }));
}

/** Add a generated squad's players to a club, updating squadPlayerIds and club OVR. */
export function applyGeneratedSquad(
  squad: GeneratedSquad,
  clubId: string,
  options: { replaceExisting?: boolean } = {},
): void {
  useSavefileStore.getState().updateSavefile((sf) => {
    const newPlayerIds = squad.players.map((p) => p.id);

    let players = sf.players;
    let clubs = sf.clubs;

    if (options.replaceExisting) {
      const existingIds = new Set(
        sf.clubs.find((c) => c.id === clubId)?.squadPlayerIds ?? [],
      );
      players = players.filter((p) => !existingIds.has(p.id));
      clubs = clubs.map((c) => (c.id === clubId ? { ...c, squadPlayerIds: [] } : c));
    }

    players = [...players, ...squad.players];
    clubs = clubs.map((c) =>
      c.id === clubId
        ? { ...c, squadPlayerIds: [...c.squadPlayerIds, ...newPlayerIds] }
        : c,
    );

    return recomputeClubOvrs({ ...sf, clubs, players });
  });
}

export function applyGeneratedManagers(managers: Manager[]): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    managers: [...sf.managers, ...managers],
  }));
}
