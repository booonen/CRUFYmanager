import type { Calendar } from '../domain/calendar';
import type { DomesticPlayer, Position } from '../domain/player';
import {
  DEFAULT_AGE_BUCKETS,
  DEFAULT_OVR_BUCKETS,
  DEFAULT_SQUAD_SHAPE,
  DEFAULT_SQUAD_SIZE,
} from './shapes';
import { generatePlayer } from './playerGen';
import type { Rng } from './prng';

export interface GenerateSquadInput {
  rng: Rng;
  calendar: Calendar;
  clubId: string;
  /** Stored on each player. */
  nationality: string;
  /** Optional explicit name pool. */
  poolCode?: string;
  /** Target club OVR; the squad's OVR curve is centred here. */
  targetClubOvr: number;
  /** Defaults to DEFAULT_SQUAD_SIZE (25). */
  squadSize?: number;
  /** Override the squad shape (positional distribution). */
  shape?: Record<Position, number>;
  /** Squad numbers already taken by existing squad members (avoids collisions). */
  takenSquadNumbers?: ReadonlySet<number>;
}

export interface GeneratedSquad {
  players: DomesticPlayer[];
}

export function generateSquad(input: GenerateSquadInput): GeneratedSquad {
  const {
    rng,
    calendar,
    clubId,
    nationality,
    poolCode,
    targetClubOvr,
    squadSize = DEFAULT_SQUAD_SIZE,
    shape = DEFAULT_SQUAD_SHAPE,
    takenSquadNumbers = new Set<number>(),
  } = input;

  const positions = shuffle(rng, expandShape(shape, squadSize));
  const ages = shuffle(rng, expandAges(rng, squadSize));
  const targetOvrs = shuffle(rng, expandOvrs(rng, targetClubOvr, squadSize));

  // Build slots, then SORT by position priority so the GK gets first dibs on #1,
  // CBs grab 4/5/6, etc., before the squad-number allocator runs out of preferred picks.
  type Slot = { position: Position; age: number; targetOvr: number; orderIdx: number };
  const slots: Slot[] = [];
  for (let i = 0; i < squadSize; i++) {
    slots.push({
      position: positions[i] ?? 'MID-CM',
      age: ages[i] ?? 25,
      targetOvr: targetOvrs[i] ?? targetClubOvr,
      orderIdx: i,
    });
  }
  // Sort GK first, then DEF, MID, FWD; stable on orderIdx within a tier.
  const TIER_RANK: Record<Position, number> = {
    GK: 0,
    'DEF-CB': 1,
    'DEF-LB': 1,
    'DEF-RB': 1,
    'MID-CDM': 2,
    'MID-CM': 2,
    'MID-CAM': 2,
    'MID-LM': 2,
    'MID-RM': 2,
    'FWD-LW': 3,
    'FWD-RW': 3,
    'FWD-ST': 3,
  };
  slots.sort((a, b) => TIER_RANK[a.position] - TIER_RANK[b.position] || a.orderIdx - b.orderIdx);

  const taken = new Set(takenSquadNumbers);
  const players: DomesticPlayer[] = [];
  for (const slot of slots) {
    const squadNumber = pickPreferredSquadNumber(slot.position, taken);
    if (squadNumber !== null) taken.add(squadNumber);

    players.push(
      generatePlayer({
        rng,
        calendar,
        position: slot.position,
        age: slot.age,
        targetOvr: slot.targetOvr,
        nationality,
        poolCode,
        clubId,
        squadNumber,
      }),
    );
  }
  return { players };
}

/**
 * Loose, footballery preferred-number ordering per position. The allocator tries
 * these in order; falls through to any free number 1-99 if all are taken.
 */
const PREFERRED_NUMBERS: Record<Position, number[]> = {
  GK: [1, 12, 13, 22, 23, 30, 31],
  'DEF-CB': [4, 5, 6, 3, 14, 15, 16, 24, 25],
  'DEF-LB': [3, 13, 18, 26, 28],
  'DEF-RB': [2, 12, 19, 27, 29],
  'MID-CDM': [6, 8, 16, 20, 24],
  'MID-CM': [8, 14, 18, 21, 28],
  'MID-CAM': [10, 17, 21, 23, 26],
  'MID-LM': [7, 11, 15, 17, 19],
  'MID-RM': [7, 11, 15, 17, 19],
  'FWD-LW': [11, 7, 17, 22, 27],
  'FWD-RW': [7, 17, 11, 22, 27],
  'FWD-ST': [9, 19, 20, 25, 32, 99],
};

function pickPreferredSquadNumber(position: Position, taken: Set<number>): number | null {
  for (const n of PREFERRED_NUMBERS[position] ?? []) {
    if (!taken.has(n)) return n;
  }
  for (let n = 1; n <= 99; n++) {
    if (!taken.has(n)) return n;
  }
  return null;
}

function expandShape(
  shape: Record<Position, number>,
  squadSize: number,
): Position[] {
  const out: Position[] = [];
  for (const pos in shape) {
    const n = shape[pos as Position];
    for (let i = 0; i < n; i++) out.push(pos as Position);
  }
  // If the shape doesn't sum to squadSize, top up with MID-CM (most flexible).
  while (out.length < squadSize) out.push('MID-CM');
  if (out.length > squadSize) out.length = squadSize;
  return out;
}

function expandAges(rng: Rng, squadSize: number): number[] {
  const out: number[] = [];
  let target = squadSize;
  for (const bucket of DEFAULT_AGE_BUCKETS) {
    const count = Math.min(bucket.count, target);
    for (let i = 0; i < count; i++) {
      out.push(rng.int(bucket.minAge, bucket.maxAge));
    }
    target -= count;
    if (target <= 0) break;
  }
  while (out.length < squadSize) out.push(rng.int(22, 28));
  return out;
}

function expandOvrs(rng: Rng, target: number, squadSize: number): number[] {
  const out: number[] = [];
  let remaining = squadSize;
  for (const bucket of DEFAULT_OVR_BUCKETS) {
    const count = Math.min(bucket.count, remaining);
    for (let i = 0; i < count; i++) {
      const low = target + bucket.offsetLow;
      const high = target + bucket.offsetHigh;
      out.push(Math.max(20, Math.min(99, rng.int(low, high))));
    }
    remaining -= count;
    if (remaining <= 0) break;
  }
  while (out.length < squadSize) out.push(target);
  return out;
}

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}
