import type {
  ForeignClub,
  ForeignLeague,
  ForeignWorld,
} from '../domain/foreignWorld';
import { newId } from '../utils/ids';
import { useSavefileStore } from './savefile';

export interface ForeignLeagueInput {
  name: string;
  countryName: string;
  tier: number;
}

export interface ForeignClubInput {
  name: string;
  leagueId: string;
  countryName: string;
  ovr: number;
  logoUrl: string | null;
}

export function useForeignWorld(): ForeignWorld | null {
  return useSavefileStore((s) => s.savefile?.foreignWorld ?? null);
}

export function useForeignLeagues(): ForeignLeague[] {
  return useSavefileStore((s) => s.savefile?.foreignWorld.leagues ?? []);
}

export function useForeignClubs(): ForeignClub[] {
  return useSavefileStore((s) => s.savefile?.foreignWorld.clubs ?? []);
}

export function useForeignClubsForLeague(leagueId: string | null | undefined): ForeignClub[] {
  return useSavefileStore((s) => {
    if (!leagueId) return [];
    return (s.savefile?.foreignWorld.clubs ?? []).filter((c) => c.leagueId === leagueId);
  });
}

export function addForeignLeague(input: ForeignLeagueInput): string {
  const id = newId();
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    foreignWorld: {
      ...sf.foreignWorld,
      leagues: [
        ...sf.foreignWorld.leagues,
        {
          id,
          name: input.name.trim(),
          countryName: input.countryName.trim(),
          tier: input.tier,
        },
      ],
    },
  }));
  return id;
}

export function updateForeignLeague(id: string, patch: Partial<ForeignLeagueInput>): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    foreignWorld: {
      ...sf.foreignWorld,
      leagues: sf.foreignWorld.leagues.map((l) =>
        l.id === id
          ? {
              ...l,
              name: patch.name?.trim() ?? l.name,
              countryName: patch.countryName?.trim() ?? l.countryName,
              tier: patch.tier ?? l.tier,
            }
          : l,
      ),
    },
  }));
}

export function deleteForeignLeague(id: string): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    foreignWorld: {
      ...sf.foreignWorld,
      leagues: sf.foreignWorld.leagues.filter((l) => l.id !== id),
      clubs: sf.foreignWorld.clubs.filter((c) => c.leagueId !== id),
    },
  }));
}

export function addForeignClub(input: ForeignClubInput): string {
  const id = newId();
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    foreignWorld: {
      ...sf.foreignWorld,
      clubs: [
        ...sf.foreignWorld.clubs,
        {
          id,
          name: input.name.trim(),
          leagueId: input.leagueId,
          countryName: input.countryName.trim(),
          ovr: input.ovr,
          logoUrl: input.logoUrl,
        },
      ],
    },
  }));
  return id;
}

export function updateForeignClub(id: string, patch: Partial<ForeignClubInput>): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    foreignWorld: {
      ...sf.foreignWorld,
      clubs: sf.foreignWorld.clubs.map((c) =>
        c.id === id
          ? {
              ...c,
              name: patch.name?.trim() ?? c.name,
              leagueId: patch.leagueId ?? c.leagueId,
              countryName: patch.countryName?.trim() ?? c.countryName,
              ovr: patch.ovr ?? c.ovr,
              logoUrl: patch.logoUrl !== undefined ? patch.logoUrl : c.logoUrl,
            }
          : c,
      ),
    },
  }));
}

export function deleteForeignClub(id: string): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    foreignWorld: {
      ...sf.foreignWorld,
      clubs: sf.foreignWorld.clubs.filter((c) => c.id !== id),
    },
  }));
}
