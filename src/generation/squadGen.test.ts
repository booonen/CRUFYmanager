import { describe, expect, it, beforeAll } from 'vitest';
import { generateSquad } from './squadGen';
import { createRng } from './prng';
import { registerAllNamePools } from './registerPools';
import { DEFAULT_SQUAD_SHAPE, DEFAULT_SQUAD_SIZE } from './shapes';
import type { Calendar } from '../domain/calendar';

beforeAll(() => {
  registerAllNamePools();
});

const cal = (): Calendar => ({
  currentSeason: 1,
  currentMatchday: 1,
  matchdaysPerSeason: 52,
  schedule: [],
});

describe('generateSquad', () => {
  it('produces exactly DEFAULT_SQUAD_SIZE players with the right positional distribution', () => {
    const result = generateSquad({
      rng: createRng('sq-1'),
      calendar: cal(),
      clubId: 'C',
      nationality: 'Italy',
      targetClubOvr: 75,
    });
    expect(result.players).toHaveLength(DEFAULT_SQUAD_SIZE);

    const counts = countByPosition(result.players);
    for (const pos in DEFAULT_SQUAD_SHAPE) {
      expect(counts[pos] ?? 0).toBe(
        DEFAULT_SQUAD_SHAPE[pos as keyof typeof DEFAULT_SQUAD_SHAPE],
      );
    }
  });

  it('all players link to the requested clubId', () => {
    const result = generateSquad({
      rng: createRng('sq-2'),
      calendar: cal(),
      clubId: 'club-77',
      nationality: 'Germany',
      targetClubOvr: 60,
    });
    expect(result.players.every((p) => p.clubId === 'club-77')).toBe(true);
  });

  it('squad numbers are unique within the generated squad', () => {
    const result = generateSquad({
      rng: createRng('sq-3'),
      calendar: cal(),
      clubId: 'C',
      nationality: 'England',
      targetClubOvr: 70,
    });
    const numbers = result.players
      .map((p) => p.squadNumber)
      .filter((n): n is number => typeof n === 'number');
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('respects taken squad numbers', () => {
    const taken = new Set([1, 2, 3, 4, 5]);
    const result = generateSquad({
      rng: createRng('sq-4'),
      calendar: cal(),
      clubId: 'C',
      nationality: 'England',
      targetClubOvr: 70,
      takenSquadNumbers: taken,
    });
    const newNumbers = result.players
      .map((p) => p.squadNumber)
      .filter((n): n is number => typeof n === 'number');
    for (const n of newNumbers) {
      expect(taken.has(n)).toBe(false);
    }
  });

  it('mean squad OVR is reasonably close to target', () => {
    const target = 70;
    const result = generateSquad({
      rng: createRng('sq-5'),
      calendar: cal(),
      clubId: 'C',
      nationality: 'France',
      targetClubOvr: target,
    });
    const mean =
      result.players.reduce((s, p) => s + p.stats.ovr, 0) / result.players.length;
    expect(Math.abs(mean - target)).toBeLessThanOrEqual(5);
  });
});

function countByPosition(players: { position: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of players) out[p.position] = (out[p.position] ?? 0) + 1;
  return out;
}
