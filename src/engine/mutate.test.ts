import { describe, expect, it } from 'vitest';
import {
  SpineGuardError,
  clearResult,
  publishRound,
  setScore,
  unlockResult,
  type FixtureRef,
} from './mutate';
import { adHocEntries, getComp, refFor, setUp } from './testkit';

function leagueSetup() {
  const { sf, competitionId } = setUp({
    name: 'Test League',
    shortName: 'TL',
    preset: { kind: 'league', legs: 1 },
    entries: adHocEntries(4),
  });
  const stage = getComp(sf, competitionId).sportEvents[0]?.stages[0];
  const round = stage?.rounds[0];
  const fixture = round?.fixtures[0];
  if (!stage || !round || !fixture) throw new Error('structure missing');
  const ref: FixtureRef = refFor(sf, competitionId, stage, round, fixture);
  return { sf, competitionId, ref, roundRef: { ...ref } };
}

const score = (home: number, away: number) =>
  ({ home, away, decidedBy: 'regulation', shootout: null }) as const;

describe('result lifecycle (lock on publish)', () => {
  it('draft results are freely editable and clearable', () => {
    const { sf, ref } = leagueSetup();
    let current = setScore(sf, ref, score(1, 0));
    current = setScore(current, ref, score(3, 2));
    const fx = findFx(current, ref);
    expect(fx.result?.payload.family === 'score' && fx.result.payload.score).toEqual([3, 2]);
    current = clearResult(current, ref);
    expect(findFx(current, ref).result).toBeNull();
  });

  it('publishing locks at the data layer: edits and clears throw', () => {
    const { sf, ref, roundRef } = leagueSetup();
    let current = setScore(sf, ref, score(2, 1));
    current = publishRound(current, roundRef);
    const fx = findFx(current, ref);
    expect(fx.result?.lifecycle.status).toBe('published');
    expect(fx.result?.lifecycle.publishedAt).toBeTruthy();
    expect(() => setScore(current, ref, score(0, 0))).toThrow(SpineGuardError);
    expect(() => clearResult(current, ref)).toThrow(SpineGuardError);
  });

  it('unlock requires a note, reopens editing, and the unlock log grows', () => {
    const { sf, ref, roundRef } = leagueSetup();
    let current = setScore(sf, ref, score(2, 1));
    current = publishRound(current, roundRef);
    expect(() => unlockResult(current, ref, '   ')).toThrow(SpineGuardError);

    current = unlockResult(current, ref, 'forgot the Bonus for Nation 2');
    expect(findFx(current, ref).result?.lifecycle.status).toBe('draft');
    current = setScore(current, ref, score(1, 1));
    current = publishRound(current, roundRef);
    current = unlockResult(current, ref, 'second thoughts');
    const unlocks = findFx(current, ref).result?.lifecycle.unlocks ?? [];
    expect(unlocks.map((u) => u.note)).toEqual(['forgot the Bonus for Nation 2', 'second thoughts']);
  });

  it('publishRound only touches fixtures that have results', () => {
    const { sf, ref, roundRef } = leagueSetup();
    let current = setScore(sf, ref, score(1, 0));
    current = publishRound(current, roundRef);
    const round = getComp(current, ref.competitionId)
      .sportEvents[0]?.stages.find((s) => s.id === ref.stageId)
      ?.rounds.find((r) => r.id === ref.roundId);
    const others = (round?.fixtures ?? []).filter((fx) => fx.id !== ref.fixtureId);
    expect(others.every((fx) => fx.result === null)).toBe(true);
  });
});

function findFx(sf: ReturnType<typeof leagueSetup>['sf'], ref: FixtureRef) {
  const fx = getComp(sf, ref.competitionId)
    .sportEvents.find((e) => e.id === ref.eventId)
    ?.stages.find((s) => s.id === ref.stageId)
    ?.rounds.find((r) => r.id === ref.roundId)
    ?.fixtures.find((f) => f.id === ref.fixtureId);
  if (!fx) throw new Error('fixture not found');
  return fx;
}
