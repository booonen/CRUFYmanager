import type { Club } from '../domain/club';
import { newId } from '../utils/ids';
import { randomColorPair } from '../utils/clubColors';
import { generateClubName } from './nameGen';
import type { Rng } from './prng';

export interface GenerateClubInput {
  rng: Rng;
  nationality: string;
  /** Optional explicit name pool. */
  poolCode?: string;
  /** Defaults to current season - rng.int(20, 130). */
  founded?: number;
}

export function generateClubIdentity(input: GenerateClubInput): Club {
  const { rng, nationality, poolCode } = input;
  const { name, shortName, city } = generateClubName(rng, { poolCode, nationality });
  const colors = randomColorPair();
  const founded = input.founded ?? -rng.int(20, 130);
  const stadiumName = `${city} Stadium`;
  const stadiumCapacity = roundToNearest(
    rng.int(8000, 65000),
    500,
  );

  return {
    id: newId(),
    kind: 'club',
    name,
    shortName,
    city,
    founded,
    colors,
    stadium: { name: stadiumName, capacity: stadiumCapacity },
    logoUrl: null,
    managerId: null,
    squadPlayerIds: [],
    ovr: 0,
    finances: { balance: 0 },
    history: [],
  };
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}
