import type { DomesticPlayer, Player } from '../domain/player';
import type { Savefile } from '../domain/savefile';
import { type PlayerFormInput, playerFormToDomain } from '../utils/playerForm';
import { computeOvr } from '../utils/ovr';
import { useSavefileStore } from './savefile';
import { recomputeClubOvrs } from './clubs';

export function usePlayers(): Player[] {
  return useSavefileStore((s) => s.savefile?.players ?? []);
}

export function useDomesticPlayers(): DomesticPlayer[] {
  return useSavefileStore(
    (s) =>
      ((s.savefile?.players ?? []).filter(
        (p) => p.tier === 'domestic',
      ) as DomesticPlayer[]),
  );
}

export function usePlayer(id: string | null | undefined): Player | null {
  return useSavefileStore((s) => {
    if (!id) return null;
    return s.savefile?.players.find((p) => p.id === id) ?? null;
  });
}

export function usePlayersForClub(clubId: string | null | undefined): DomesticPlayer[] {
  return useSavefileStore((s) => {
    if (!clubId) return [];
    return ((s.savefile?.players ?? []).filter(
      (p) => p.tier === 'domestic' && p.clubId === clubId,
    ) as DomesticPlayer[]);
  });
}

export function addDomesticPlayer(input: PlayerFormInput): string {
  let createdId = '';
  useSavefileStore.getState().updateSavefile((sf) => {
    const player = playerFormToDomain(input, sf.calendar);
    createdId = player.id;
    const next: Savefile = {
      ...sf,
      players: [...sf.players, player],
      clubs: sf.clubs.map((c) =>
        c.id === player.clubId
          ? { ...c, squadPlayerIds: [...c.squadPlayerIds, player.id] }
          : c,
      ),
    };
    return recomputeClubOvrs(next);
  });
  return createdId;
}

export function updateDomesticPlayer(id: string, input: PlayerFormInput): void {
  useSavefileStore.getState().updateSavefile((sf) => {
    const existing = sf.players.find((p) => p.id === id);
    if (!existing || existing.tier !== 'domestic') return sf;
    const updated = playerFormToDomain(input, sf.calendar);
    const merged: DomesticPlayer = {
      ...updated,
      id,
      careerHistory: existing.careerHistory,
      injury: existing.injury,
    };

    let clubs = sf.clubs;
    if (existing.clubId !== updated.clubId) {
      clubs = clubs.map((c) => {
        if (c.id === existing.clubId) {
          return { ...c, squadPlayerIds: c.squadPlayerIds.filter((pid) => pid !== id) };
        }
        if (c.id === updated.clubId) {
          return { ...c, squadPlayerIds: [...c.squadPlayerIds, id] };
        }
        return c;
      });
    }

    const next: Savefile = {
      ...sf,
      players: sf.players.map((p) => (p.id === id ? merged : p)),
      clubs,
    };
    return recomputeClubOvrs(next);
  });
}

export function deletePlayer(id: string): void {
  useSavefileStore.getState().updateSavefile((sf) => {
    const next: Savefile = {
      ...sf,
      players: sf.players.filter((p) => p.id !== id),
      clubs: sf.clubs.map((c) => ({
        ...c,
        squadPlayerIds: c.squadPlayerIds.filter((pid) => pid !== id),
      })),
      nationalTeam: {
        ...sf.nationalTeam,
        squadPlayerIds: sf.nationalTeam.squadPlayerIds.filter((pid) => pid !== id),
      },
    };
    return recomputeClubOvrs(next);
  });
}

export function recomputePlayerOvr(playerId: string): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    players: sf.players.map((p) => {
      if (p.id !== playerId) return p;
      if (p.tier === 'foreign-nt-stub') return p;
      return {
        ...p,
        stats: { ...p.stats, ovr: computeOvr(p.position, p.stats) },
      };
    }),
  }));
}
