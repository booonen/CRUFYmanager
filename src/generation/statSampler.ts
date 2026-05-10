import type { GameStat, GameStatBlock, Position } from '../domain/player';
import { ALL_GAME_STATS } from '../domain/player';
import { OVR_WEIGHTS, computeOvr } from '../utils/ovr';
import { STAT_VALUE_MAX, STAT_VALUE_MIN } from './shapes';
import type { Rng } from './prng';

/**
 * Sample a 12-stat block whose computeOvr() lands close to `target` for `position`.
 *
 * Strategy:
 *  - For each stat, pull from a normal centred at `target + bias` where `bias`
 *    is +Δ for stats this position cares about and −Δ for stats it doesn't.
 *  - Then run up to N calibration passes that nudge weighted stats up/down 1
 *    point toward the target until we're within ±2 OVR.
 */
export function sampleStatBlock(
  rng: Rng,
  position: Position,
  target: number,
  opts: { maxCalibrationPasses?: number; spread?: number } = {},
): GameStatBlock {
  const maxPasses = opts.maxCalibrationPasses ?? 8;
  const spread = opts.spread ?? 8;
  const weights = OVR_WEIGHTS[position];

  const block = {} as GameStatBlock;
  for (const stat of ALL_GAME_STATS) {
    const w = weights[stat];
    let bias: number;
    if (w === 0) {
      // Position doesn't care about this stat at all (e.g. handling for outfield).
      // Random low-medium so the player looks human, but this stat won't move OVR.
      bias = -15;
    } else if (w >= 0.18) {
      bias = 6;
    } else if (w >= 0.1) {
      bias = 2;
    } else {
      bias = -3;
    }
    const mean = target + bias;
    const sd = w === 0 ? 14 : spread;
    block[stat] = clampStat(rng.normal(mean, sd, STAT_VALUE_MIN, STAT_VALUE_MAX));
  }

  // Calibration: nudge top-weighted stats toward target.
  const sortedStats: GameStat[] = [...ALL_GAME_STATS].sort(
    (a, b) => weights[b] - weights[a],
  );

  for (let pass = 0; pass < maxPasses; pass++) {
    const ovr = computeOvr(position, block);
    const diff = target - ovr;
    if (Math.abs(diff) <= 2) break;

    const direction = diff > 0 ? 1 : -1;
    // Nudge the highest-weight stats first, by 1 point each.
    let nudges = Math.min(Math.abs(diff), 4);
    for (const stat of sortedStats) {
      if (nudges === 0) break;
      if (weights[stat] === 0) continue;
      const next = block[stat] + direction;
      if (next < STAT_VALUE_MIN || next > STAT_VALUE_MAX) continue;
      block[stat] = next;
      nudges--;
    }
  }

  return block;
}

function clampStat(v: number): number {
  if (Number.isNaN(v)) return 50;
  return Math.max(STAT_VALUE_MIN, Math.min(STAT_VALUE_MAX, Math.round(v)));
}
