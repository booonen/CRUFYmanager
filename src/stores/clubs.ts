import type { Club, ClubColors, ClubFinances, ClubStadium } from '../domain/club';
import { FREE_AGENTS_CLUB_ID } from '../domain/club';
import type { DomesticPlayer, Player } from '../domain/player';
import type { Savefile } from '../domain/savefile';
import { newId } from '../utils/ids';
import { useSavefileStore } from './savefile';

export interface ClubInput {
  name: string;
  shortName: string;
  city: string;
  founded: number;
  colors: ClubColors;
  stadium: ClubStadium;
  finances: ClubFinances;
  managerId: string | null;
}

export function useClubs(): Club[] {
  return useSavefileStore((s) => s.savefile?.clubs ?? []);
}

export function useRealClubs(): Club[] {
  return useSavefileStore((s) => (s.savefile?.clubs ?? []).filter((c) => c.kind === 'club'));
}

export function useClub(id: string | null | undefined): Club | null {
  return useSavefileStore((s) => {
    if (!id) return null;
    return s.savefile?.clubs.find((c) => c.id === id) ?? null;
  });
}

export function addClub(input: ClubInput): string {
  const id = newId();
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    clubs: [
      ...sf.clubs,
      {
        id,
        kind: 'club',
        name: input.name.trim(),
        shortName: input.shortName.trim(),
        city: input.city.trim(),
        founded: input.founded,
        colors: input.colors,
        stadium: input.stadium,
        managerId: input.managerId,
        squadPlayerIds: [],
        ovr: 0,
        finances: input.finances,
        history: [],
      },
    ],
  }));
  if (input.managerId) {
    assignManager(id, input.managerId);
  }
  return id;
}

export function updateClub(id: string, patch: Partial<ClubInput>): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    clubs: sf.clubs.map((c) => {
      if (c.id !== id) return c;
      return {
        ...c,
        name: patch.name?.trim() ?? c.name,
        shortName: patch.shortName?.trim() ?? c.shortName,
        city: patch.city?.trim() ?? c.city,
        founded: patch.founded ?? c.founded,
        colors: patch.colors ?? c.colors,
        stadium: patch.stadium ?? c.stadium,
        finances: patch.finances ?? c.finances,
      };
    }),
  }));
}

export function deleteClub(id: string): void {
  if (id === FREE_AGENTS_CLUB_ID) return;
  useSavefileStore.getState().updateSavefile((sf) => {
    const targetClub = sf.clubs.find((c) => c.id === id);
    if (!targetClub) return sf;

    const playerIdsToMove = new Set(targetClub.squadPlayerIds);
    const players: Player[] = sf.players.map((p) => {
      if (p.tier !== 'domestic') return p;
      if (p.clubId !== id) return p;
      return { ...p, clubId: FREE_AGENTS_CLUB_ID, squadNumber: null };
    });

    const clubs = sf.clubs
      .filter((c) => c.id !== id)
      .map((c) => {
        if (c.id !== FREE_AGENTS_CLUB_ID) return c;
        return {
          ...c,
          squadPlayerIds: [...c.squadPlayerIds, ...playerIdsToMove],
        };
      });

    return {
      ...sf,
      clubs,
      players,
    };
  });
}

export function assignManager(clubId: string, managerId: string): void {
  useSavefileStore.getState().updateSavefile((sf) => {
    const previousClubId = sf.managers.find((m) => m.id === managerId)?.contractClubId ?? null;
    return {
      ...sf,
      clubs: sf.clubs.map((c) => {
        if (c.id === clubId) return { ...c, managerId };
        if (previousClubId && c.id === previousClubId) return { ...c, managerId: null };
        if (c.managerId === managerId && c.id !== clubId) return { ...c, managerId: null };
        return c;
      }),
      managers: sf.managers.map((m) =>
        m.id === managerId
          ? { ...m, contractClubId: clubId, contractUntilSeason: m.contractUntilSeason ?? sf.calendar.currentSeason + 2 }
          : m,
      ),
    };
  });
}

export function unassignManager(clubId: string): void {
  useSavefileStore.getState().updateSavefile((sf) => {
    const club = sf.clubs.find((c) => c.id === clubId);
    if (!club || !club.managerId) return sf;
    const removedManagerId = club.managerId;
    return {
      ...sf,
      clubs: sf.clubs.map((c) => (c.id === clubId ? { ...c, managerId: null } : c)),
      managers: sf.managers.map((m) =>
        m.id === removedManagerId ? { ...m, contractClubId: null, contractUntilSeason: null } : m,
      ),
    };
  });
}

export function setPlayerSquadNumber(playerId: string, number: number | null): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    players: sf.players.map((p) => {
      if (p.tier !== 'domestic' || p.id !== playerId) return p;
      return { ...p, squadNumber: number };
    }),
  }));
}

export function recomputeClubOvrs(sf: Savefile): Savefile {
  return {
    ...sf,
    clubs: sf.clubs.map((c) => {
      if (c.kind === 'free-agents') return { ...c, ovr: 0 };
      const squad = sf.players.filter(
        (p): p is DomesticPlayer => p.tier === 'domestic' && p.clubId === c.id,
      );
      if (squad.length === 0) return { ...c, ovr: 0 };
      const sorted = [...squad].sort((a, b) => b.stats.ovr - a.stats.ovr).slice(0, 18);
      const avg = sorted.reduce((s, p) => s + p.stats.ovr, 0) / sorted.length;
      return { ...c, ovr: Math.round(avg) };
    }),
  };
}
