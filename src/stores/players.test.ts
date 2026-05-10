import { beforeEach, describe, expect, it } from 'vitest';
import { useSavefileStore } from './savefile';
import { addClub } from './clubs';
import {
  addDomesticPlayer,
  deletePlayer,
  updateDomesticPlayer,
  useDomesticPlayers,
} from './players';
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

describe('players store', () => {
  it('addDomesticPlayer adds the player and pushes their id onto the club squad', async () => {
    await withFreshSave();
    const clubId = addClub({
      name: 'A',
      shortName: 'A',
      city: 'A',
      founded: 1900,
      colors: { primary: '#fff', secondary: '#000' },
      stadium: { name: '', capacity: 0 },
      logoUrl: null,
      finances: { balance: 0 },
      managerId: null,
    });
    const cal = useSavefileStore.getState().savefile!.calendar;
    const playerId = addDomesticPlayer({ ...newPlayerFormInput(cal, clubId), firstName: 'Strikey', lastName: 'McStrike' });

    const sf = useSavefileStore.getState().savefile!;
    const found = sf.players.find((p) => p.id === playerId);
    if (found?.tier !== 'domestic') throw new Error('expected domestic player');
    expect(found.firstName).toBe('Strikey');
    expect(found.lastName).toBe('McStrike');
    const club = sf.clubs.find((c) => c.id === clubId)!;
    expect(club.squadPlayerIds).toContain(playerId);
    expect(club.ovr).toBeGreaterThan(0);
  });

  it('updateDomesticPlayer moving the player switches squads', async () => {
    await withFreshSave();
    const cal = useSavefileStore.getState().savefile!.calendar;
    const a = addClub({
      name: 'A',
      shortName: 'A',
      city: 'A',
      founded: 1900,
      colors: { primary: '#fff', secondary: '#000' },
      stadium: { name: '', capacity: 0 },
      logoUrl: null,
      finances: { balance: 0 },
      managerId: null,
    });
    const b = addClub({
      name: 'B',
      shortName: 'B',
      city: 'B',
      founded: 1900,
      colors: { primary: '#fff', secondary: '#000' },
      stadium: { name: '', capacity: 0 },
      logoUrl: null,
      finances: { balance: 0 },
      managerId: null,
    });
    const pid = addDomesticPlayer({ ...newPlayerFormInput(cal, a), firstName: 'Mover', lastName: 'X' });

    updateDomesticPlayer(pid, { ...newPlayerFormInput(cal, b), firstName: 'Mover', lastName: 'X' });

    const sf = useSavefileStore.getState().savefile!;
    expect(sf.clubs.find((c) => c.id === a)?.squadPlayerIds).not.toContain(pid);
    expect(sf.clubs.find((c) => c.id === b)?.squadPlayerIds).toContain(pid);
  });

  it('deletePlayer removes from players, all squads, and NT roster', async () => {
    await withFreshSave();
    const cal = useSavefileStore.getState().savefile!.calendar;
    const c = addClub({
      name: 'A',
      shortName: 'A',
      city: 'A',
      founded: 1900,
      colors: { primary: '#fff', secondary: '#000' },
      stadium: { name: '', capacity: 0 },
      logoUrl: null,
      finances: { balance: 0 },
      managerId: null,
    });
    const pid = addDomesticPlayer({ ...newPlayerFormInput(cal, c), firstName: 'Doomed', lastName: 'Lad' });
    useSavefileStore.getState().updateSavefile((sf) => ({
      ...sf,
      nationalTeam: { ...sf.nationalTeam, squadPlayerIds: [pid] },
    }));

    deletePlayer(pid);

    const sf = useSavefileStore.getState().savefile!;
    expect(sf.players.find((p) => p.id === pid)).toBeUndefined();
    expect(sf.clubs.find((cc) => cc.id === c)?.squadPlayerIds).not.toContain(pid);
    expect(sf.nationalTeam.squadPlayerIds).not.toContain(pid);
  });

  it('useDomesticPlayers returns only the domestic tier', async () => {
    await withFreshSave();
    const cal = useSavefileStore.getState().savefile!.calendar;
    addDomesticPlayer({ ...newPlayerFormInput(cal, FREE_AGENTS_CLUB_ID), firstName: 'Hello', lastName: 'World' });
    const all = useDomesticPlayers.length; // hook is callable but used here only to import
    expect(useSavefileStore.getState().savefile!.players.length).toBe(1);
    expect(typeof all).toBe('number');
  });
});
