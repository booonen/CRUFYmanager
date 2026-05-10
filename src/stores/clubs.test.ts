import { beforeEach, describe, expect, it } from 'vitest';
import { useSavefileStore } from './savefile';
import { addClub, deleteClub, updateClub, assignManager, unassignManager } from './clubs';
import { addManager } from './managers';
import { addDomesticPlayer } from './players';
import { newPlayerFormInput } from '../utils/playerForm';
import { FREE_AGENTS_CLUB_ID } from '../domain/club';

beforeEach(() => {
  useSavefileStore.setState({
    status: 'idle',
    errorMessage: null,
    activeSaveId: null,
    savefile: null,
    slots: [],
  });
});

async function withFreshSave() {
  await useSavefileStore.getState().createSavefile({
    countryName: 'Testland',
    countryShortCode: 'TST',
    matchdaysPerSeason: 52,
  });
}

const blankClubInput = (overrides: Partial<Parameters<typeof addClub>[0]> = {}) => ({
  name: 'Foo FC',
  shortName: 'FOO',
  city: 'Foo',
  founded: 1900,
  colors: { primary: '#ffffff', secondary: '#000000' },
  stadium: { name: 'Foo Park', capacity: 10000 },
  finances: { balance: 0 },
  managerId: null,
  ...overrides,
});

describe('clubs store', () => {
  it('savefile starts with the Free Agents club', async () => {
    await withFreshSave();
    const sf = useSavefileStore.getState().savefile!;
    expect(sf.clubs).toHaveLength(1);
    expect(sf.clubs[0]?.kind).toBe('free-agents');
    expect(sf.clubs[0]?.id).toBe(FREE_AGENTS_CLUB_ID);
  });

  it('addClub adds a real club', async () => {
    await withFreshSave();
    const id = addClub(blankClubInput());
    const sf = useSavefileStore.getState().savefile!;
    const found = sf.clubs.find((c) => c.id === id);
    expect(found?.kind).toBe('club');
    expect(found?.name).toBe('Foo FC');
  });

  it('updateClub patches fields', async () => {
    await withFreshSave();
    const id = addClub(blankClubInput());
    updateClub(id, { name: 'Renamed FC' });
    const found = useSavefileStore.getState().savefile!.clubs.find((c) => c.id === id);
    expect(found?.name).toBe('Renamed FC');
  });

  it('deleteClub demotes its players to Free Agents and removes the club', async () => {
    await withFreshSave();
    const clubId = addClub(blankClubInput());
    const cal = useSavefileStore.getState().savefile!.calendar;
    const playerId = addDomesticPlayer(newPlayerFormInput(cal, clubId));

    deleteClub(clubId);

    const sf = useSavefileStore.getState().savefile!;
    expect(sf.clubs.find((c) => c.id === clubId)).toBeUndefined();
    const player = sf.players.find((p) => p.id === playerId);
    expect(player?.tier === 'domestic' && player.clubId).toBe(FREE_AGENTS_CLUB_ID);
    const fa = sf.clubs.find((c) => c.id === FREE_AGENTS_CLUB_ID)!;
    expect(fa.squadPlayerIds).toContain(playerId);
  });

  it('Free Agents club cannot be deleted', async () => {
    await withFreshSave();
    deleteClub(FREE_AGENTS_CLUB_ID);
    const sf = useSavefileStore.getState().savefile!;
    expect(sf.clubs.some((c) => c.id === FREE_AGENTS_CLUB_ID)).toBe(true);
  });

  it('assignManager updates both club and manager links', async () => {
    await withFreshSave();
    const clubId = addClub(blankClubInput());
    const managerId = addManager({
      name: 'Bob',
      nationality: 'XX',
      age: 50,
      stats: { tactical: 60, motivation: 60, development: 60, discipline: 60, adaptability: 60 },
      preferredFormation: '4-3-3',
      preferredStyle: 'balanced',
    });
    assignManager(clubId, managerId);

    const sf = useSavefileStore.getState().savefile!;
    const club = sf.clubs.find((c) => c.id === clubId);
    const mgr = sf.managers.find((m) => m.id === managerId);
    expect(club?.managerId).toBe(managerId);
    expect(mgr?.contractClubId).toBe(clubId);
  });

  it('reassigning a manager removes them from their previous club', async () => {
    await withFreshSave();
    const clubA = addClub(blankClubInput({ name: 'A' }));
    const clubB = addClub(blankClubInput({ name: 'B' }));
    const managerId = addManager({
      name: 'Bob',
      nationality: 'XX',
      age: 50,
      stats: { tactical: 60, motivation: 60, development: 60, discipline: 60, adaptability: 60 },
      preferredFormation: '4-3-3',
      preferredStyle: 'balanced',
    });
    assignManager(clubA, managerId);
    assignManager(clubB, managerId);

    const sf = useSavefileStore.getState().savefile!;
    expect(sf.clubs.find((c) => c.id === clubA)?.managerId).toBeNull();
    expect(sf.clubs.find((c) => c.id === clubB)?.managerId).toBe(managerId);
  });

  it('unassignManager clears both sides', async () => {
    await withFreshSave();
    const clubId = addClub(blankClubInput());
    const managerId = addManager({
      name: 'Bob',
      nationality: 'XX',
      age: 50,
      stats: { tactical: 60, motivation: 60, development: 60, discipline: 60, adaptability: 60 },
      preferredFormation: '4-3-3',
      preferredStyle: 'balanced',
    });
    assignManager(clubId, managerId);
    unassignManager(clubId);

    const sf = useSavefileStore.getState().savefile!;
    expect(sf.clubs.find((c) => c.id === clubId)?.managerId).toBeNull();
    expect(sf.managers.find((m) => m.id === managerId)?.contractClubId).toBeNull();
  });
});
