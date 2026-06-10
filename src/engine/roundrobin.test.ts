import { describe, expect, it } from 'vitest';
import { generateRoundRobin } from './roundrobin';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe('generateRoundRobin', () => {
  it('even count, single leg: every pair exactly once, nobody twice per round', () => {
    const rounds = generateRoundRobin(ids(6), 1);
    expect(rounds).toHaveLength(5);
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(round).toHaveLength(3);
      const inRound = new Set<string>();
      for (const p of round) {
        expect(inRound.has(p.home)).toBe(false);
        expect(inRound.has(p.away)).toBe(false);
        inRound.add(p.home);
        inRound.add(p.away);
        const key = [p.home, p.away].sort().join('-');
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(15);
  });

  it('odd count gets byes: 5 teams → 5 rounds of 2 pairings, 10 unique pairs', () => {
    const rounds = generateRoundRobin(ids(5), 1);
    expect(rounds).toHaveLength(5);
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(round).toHaveLength(2);
      for (const p of round) seen.add([p.home, p.away].sort().join('-'));
    }
    expect(seen.size).toBe(10);
  });

  it('two legs mirror home/away', () => {
    const rounds = generateRoundRobin(ids(4), 2);
    expect(rounds).toHaveLength(6);
    const first = rounds.slice(0, 3).flat();
    const second = rounds.slice(3).flat();
    for (const p of first) {
      expect(second.some((q) => q.home === p.away && q.away === p.home)).toBe(true);
    }
  });
});
