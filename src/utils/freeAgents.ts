import type { Club } from '../domain/club';
import { FREE_AGENTS_CLUB_ID } from '../domain/club';
import type { Savefile } from '../domain/savefile';

export function makeFreeAgentsClub(): Club {
  return {
    id: FREE_AGENTS_CLUB_ID,
    kind: 'free-agents',
    name: 'Free Agents',
    shortName: 'FA',
    city: '',
    founded: 0,
    colors: { primary: '#5c5f73', secondary: '#2a2d3e' },
    stadium: { name: '', capacity: 0 },
    logoUrl: null,
    managerId: null,
    squadPlayerIds: [],
    ovr: 0,
    finances: { balance: 0 },
    history: [],
  };
}

export function ensureFreeAgentsClub(sf: Savefile): Savefile {
  const exists = sf.clubs.some((c) => c.id === FREE_AGENTS_CLUB_ID);
  if (exists) return sf;
  return { ...sf, clubs: [makeFreeAgentsClub(), ...sf.clubs] };
}

export function isRealClub(c: Club): boolean {
  return c.kind !== 'free-agents';
}

export function isFreeAgentsClub(c: Club): boolean {
  return c.kind === 'free-agents';
}

export function getFreeAgentsClub(sf: Savefile): Club {
  const c = sf.clubs.find((x) => x.id === FREE_AGENTS_CLUB_ID);
  if (!c) {
    throw new Error('Free Agents club is missing from savefile (migration bug?)');
  }
  return c;
}
