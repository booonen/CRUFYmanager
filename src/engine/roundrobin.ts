export interface RoundRobinPairing {
  home: string;
  away: string;
}

/**
 * Circle-method round robin. Odd entry counts get a bye (the paired-with-null
 * fixture is simply dropped from that round). legs=2 appends the mirrored
 * second half with home/away swapped.
 */
export function generateRoundRobin(entryIds: string[], legs: 1 | 2): RoundRobinPairing[][] {
  if (entryIds.length < 2) return [];
  const ids: (string | null)[] = [...entryIds];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const roundsPerLeg = n - 1;

  const firstLeg: RoundRobinPairing[][] = [];
  const rotation = [...ids];
  for (let r = 0; r < roundsPerLeg; r++) {
    const pairings: RoundRobinPairing[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a == null || b == null) continue;
      // Alternate orientation per round so home/away counts stay roughly even.
      pairings.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    firstLeg.push(pairings);
    // Rotate all positions except the first.
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    const last = rest.pop();
    rotation.splice(0, rotation.length, fixed ?? null, ...(last !== undefined ? [last] : []), ...rest);
  }

  if (legs === 1) return firstLeg;
  const secondLeg = firstLeg.map((round) =>
    round.map((p) => ({ home: p.away, away: p.home })),
  );
  return [...firstLeg, ...secondLeg];
}
