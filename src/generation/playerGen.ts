import type { Calendar } from '../domain/calendar';
import type {
  DomesticPlayer,
  PersonalityTag,
  Position,
} from '../domain/player';
import { PERSONALITY_TAGS } from '../domain/player';
import { computeOvr } from '../utils/ovr';
import { newId } from '../utils/ids';
import { dobForAge } from '../utils/age';
import { sampleStatBlock } from './statSampler';
import { generateFullName } from './nameGen';
import type { Rng } from './prng';

export interface GeneratePlayerInput {
  rng: Rng;
  calendar: Calendar;
  position: Position;
  age: number;
  targetOvr: number;
  nationality: string;
  clubId: string;
  squadNumber?: number | null;
}

export function generatePlayer(input: GeneratePlayerInput): DomesticPlayer {
  const { rng, calendar, position, age, targetOvr, nationality, clubId } = input;
  const stats = sampleStatBlock(rng, position, targetOvr);
  const ovr = computeOvr(position, stats);
  const { firstName, lastName } = generateFullName({ nationality, rng });

  const personalities = samplePersonalities(rng);
  const potential = samplePotential(rng, age, ovr);
  const consistency = clamp1to100(rng.normal(60, 14));
  const workRate = clamp1to100(rng.normal(60, 14));
  const injuryProneness = clamp1to100(rng.normal(30, 18));
  const currentForm = clamp1to100(rng.normal(60, 12));
  const currentMorale = clamp1to100(rng.normal(75, 10));
  const currentFitness = 100;

  return {
    id: newId(),
    tier: 'domestic',
    firstName,
    lastName,
    nationality,
    position,
    dateOfBirth: dobForAge(age, calendar),
    stats: {
      ...stats,
      injuryProneness,
      potential,
      personalities,
      consistency,
      workRate,
      ovr,
    },
    clubId,
    contractUntilSeason: calendar.currentSeason + 1 + Math.floor(rng.range(0, 4)),
    squadNumber: input.squadNumber ?? null,
    currentForm,
    currentMorale,
    currentFitness,
    injury: null,
    careerHistory: [],
  };
}

function samplePersonalities(rng: Rng): PersonalityTag[] {
  const r = rng.next();
  const count = r < 0.7 ? 1 : r < 0.95 ? 2 : 3;
  const pool = [...PERSONALITY_TAGS];
  const out: PersonalityTag[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = rng.int(0, pool.length - 1);
    const [picked] = pool.splice(idx, 1);
    if (picked) out.push(picked);
  }
  return out;
}

function samplePotential(rng: Rng, age: number, currentOvr: number): number {
  // Younger = more headroom. Floor at currentOvr.
  let bump = 0;
  if (age < 19) bump = rng.int(10, 20);
  else if (age < 23) bump = rng.int(5, 12);
  else if (age < 27) bump = rng.int(0, 6);
  else if (age < 31) bump = rng.int(-2, 3);
  else bump = rng.int(-5, 0);
  return clamp1to100(currentOvr + bump);
}

function clamp1to100(v: number): number {
  if (Number.isNaN(v)) return 50;
  return Math.max(1, Math.min(100, Math.round(v)));
}
