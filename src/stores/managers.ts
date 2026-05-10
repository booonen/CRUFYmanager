import type { Formation, Manager, ManagerStats, TacticalProfile } from '../domain/manager';
import { newId } from '../utils/ids';
import { useSavefileStore } from './savefile';

export interface ManagerInput {
  name: string;
  nationality: string;
  age: number;
  stats: ManagerStats;
  preferredFormation: Formation;
  preferredStyle: TacticalProfile;
}

export function useManagers(): Manager[] {
  return useSavefileStore((s) => s.savefile?.managers ?? []);
}

export function useManager(id: string | null | undefined): Manager | null {
  return useSavefileStore((s) => {
    if (!id) return null;
    return s.savefile?.managers.find((m) => m.id === id) ?? null;
  });
}

export function useUnemployedManagers(): Manager[] {
  return useSavefileStore(
    (s) => (s.savefile?.managers ?? []).filter((m) => m.contractClubId === null),
  );
}

export function addManager(input: ManagerInput): string {
  const id = newId();
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    managers: [
      ...sf.managers,
      {
        id,
        name: input.name.trim(),
        nationality: input.nationality.trim(),
        age: input.age,
        stats: input.stats,
        preferredFormation: input.preferredFormation,
        preferredStyle: input.preferredStyle,
        contractClubId: null,
        contractUntilSeason: null,
        history: [],
      },
    ],
  }));
  return id;
}

export function updateManager(id: string, patch: Partial<ManagerInput>): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    managers: sf.managers.map((m) =>
      m.id === id
        ? {
            ...m,
            name: patch.name?.trim() ?? m.name,
            nationality: patch.nationality?.trim() ?? m.nationality,
            age: patch.age ?? m.age,
            stats: patch.stats ?? m.stats,
            preferredFormation: patch.preferredFormation ?? m.preferredFormation,
            preferredStyle: patch.preferredStyle ?? m.preferredStyle,
          }
        : m,
    ),
  }));
}

export function deleteManager(id: string): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    managers: sf.managers.filter((m) => m.id !== id),
    clubs: sf.clubs.map((c) => (c.managerId === id ? { ...c, managerId: null } : c)),
    nationalTeam:
      sf.nationalTeam.managerId === id
        ? { ...sf.nationalTeam, managerId: null }
        : sf.nationalTeam,
  }));
}

export function sackManager(managerId: string): void {
  useSavefileStore.getState().updateSavefile((sf) => ({
    ...sf,
    clubs: sf.clubs.map((c) => (c.managerId === managerId ? { ...c, managerId: null } : c)),
    managers: sf.managers.map((m) =>
      m.id === managerId ? { ...m, contractClubId: null, contractUntilSeason: null } : m,
    ),
  }));
}

export function defaultManagerStats(): ManagerStats {
  return {
    tactical: 60,
    motivation: 60,
    development: 60,
    discipline: 60,
    adaptability: 60,
  };
}
