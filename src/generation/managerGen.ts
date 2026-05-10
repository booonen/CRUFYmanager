import type { Formation, Manager, ManagerStats, TacticalProfile } from '../domain/manager';
import { newId } from '../utils/ids';
import { generateFullName } from './nameGen';
import type { Rng } from './prng';

const FORMATIONS: Formation[] = [
  '4-4-2',
  '4-3-3',
  '4-2-3-1',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '4-5-1',
  '4-1-4-1',
];

const STYLES: TacticalProfile[] = [
  'defensive',
  'counter-attack',
  'balanced',
  'possession',
  'pressing',
  'attacking',
];

export interface GenerateManagerInput {
  rng: Rng;
  /** Stored on the manager. */
  nationality: string;
  /** Optional explicit name pool. */
  poolCode?: string;
  /** Mean of the stat curve (0-100). Default 65. */
  targetMean?: number;
}

export function generateManager(input: GenerateManagerInput): Manager {
  const { rng, nationality, poolCode } = input;
  const mean = input.targetMean ?? 65;
  const { firstName, lastName } = generateFullName({ rng, poolCode, nationality });

  const stats = sampleManagerStats(rng, mean);
  return {
    id: newId(),
    name: `${firstName} ${lastName}`.trim(),
    nationality,
    age: rng.int(35, 65),
    stats,
    preferredFormation: rng.pick(FORMATIONS),
    preferredStyle: rng.pick(STYLES),
    contractClubId: null,
    contractUntilSeason: null,
    history: [],
  };
}

function sampleManagerStats(rng: Rng, mean: number): ManagerStats {
  // Most stats around mean ± spread; one or two stats peaking higher.
  const baseSd = 10;
  const all: (keyof ManagerStats)[] = [
    'tactical',
    'motivation',
    'development',
    'discipline',
    'adaptability',
  ];
  const out = {} as ManagerStats;
  for (const k of all) {
    out[k] = clamp1to100(rng.normal(mean, baseSd, 20, 95));
  }
  // Boost 1-2 stats by 8-15.
  const peakCount = rng.chance(0.5) ? 2 : 1;
  for (let i = 0; i < peakCount; i++) {
    const stat = rng.pick(all);
    out[stat] = clamp1to100(out[stat] + rng.int(8, 15));
  }
  return out;
}

function clamp1to100(v: number): number {
  if (Number.isNaN(v)) return 50;
  return Math.max(1, Math.min(100, Math.round(v)));
}
