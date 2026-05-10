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
  nationality: string;
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
    targetClubOvr,
    squadSize = DEFAULT_SQUAD_SIZE,
    shape = DEFAULT_SQUAD_SHAPE,
    takenSquadNumbers = new Set<number>(),
  } = input;

  const positions = shuffle(rng, expandShape(shape, squadSize));
  const ages = shuffle(rng, expandAges(rng, squadSize));
  const targetOvrs = shuffle(rng, expandOvrs(rng, targetClubOvr, squadSize));

  const taken = new Set(takenSquadNumbers);
  const players: DomesticPlayer[] = [];
  for (let i = 0; i < squadSize; i++) {
    const position = positions[i] ?? 'MID-CM';
    const age = ages[i] ?? 25;
    const targetOvr = targetOvrs[i] ?? targetClubOvr;
    const squadNumber = nextSquadNumber(taken);
    if (squadNumber !== null) taken.add(squadNumber);

    players.push(
      generatePlayer({
        rng,
        calendar,
        position,
        age,
        targetOvr,
        nationality,
        clubId,
        squadNumber,
      }),
    );
  }
  return { players };
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

function nextSquadNumber(taken: Set<number>): number | null {
  for (let n = 1; n <= 99; n++) {
    if (!taken.has(n)) return n;
  }
  return null;
}
