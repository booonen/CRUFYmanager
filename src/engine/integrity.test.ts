import { describe, expect, it } from 'vitest';
import { spineWarnings } from './integrity';
import { publishRound, setScore } from './mutate';
import { adHocEntries, fillStage, getComp, refFor, setUp } from './testkit';

const score = (home: number, away: number) =>
  ({ home, away, decidedBy: 'regulation', shootout: null }) as const;

describe('integrity warnings', () => {
  it('a cleanly played and published competition raises nothing', () => {
    const { sf, competitionId } = setUp({
      name: 'Clean Cup',
      shortName: 'CL',
      preset: { kind: 'league', legs: 1 },
      entries: adHocEntries(4),
    });
    let current = fillStage(sf, competitionId, 0);
    const stage = getComp(current, competitionId).sportEvents[0]?.stages[0];
    for (const round of stage?.rounds ?? []) {
      const event = getComp(current, competitionId).sportEvents[0];
      if (!event || !stage) continue;
      current = publishRound(current, {
        competitionId,
        eventId: event.id,
        stageId: stage.id,
        roundId: round.id,
      });
    }
    expect(spineWarnings(current)).toEqual([]);
  });

  it('editing an earlier round after a later one was published → stale-upstream', () => {
    const { sf, competitionId } = setUp({
      name: 'League',
      shortName: 'L',
      preset: { kind: 'league', legs: 1 },
      entries: adHocEntries(4),
    });
    let current = fillStage(sf, competitionId, 0);
    const event = () => getComp(current, competitionId).sportEvents[0];
    const stage = () => event()?.stages[0];

    const md2 = stage()?.rounds[1];
    if (!md2) throw new Error('round missing');
    current = publishRound(current, {
      competitionId,
      eventId: event()?.id ?? '',
      stageId: stage()?.id ?? '',
      roundId: md2.id,
    });
    expect(spineWarnings(current)).toEqual([]);

    // Tamper with matchday 1 (draft, so no unlock needed).
    const md1 = stage()?.rounds[0];
    const fx = md1?.fixtures[0];
    if (!stage() || !md1 || !fx) throw new Error('structure missing');
    const s = stage();
    if (!s) throw new Error('no stage');
    current = setScore(current, refFor(current, competitionId, s, md1, fx), score(9, 0));

    const warnings = spineWarnings(current);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.kind).toBe('stale-upstream');
  });

  it('rewriting group results under a published knockout result → bracket-contradiction', () => {
    const { sf, competitionId } = setUp({
      name: 'Mini WC',
      shortName: 'MW',
      preset: {
        kind: 'groups-knockout',
        groupCount: 2,
        legs: 1,
        qualifyPerGroup: 2,
        bestOfPlace: null,
        koLegs: 1,
        thirdPlace: false,
        awayGoals: false,
      },
      entries: adHocEntries(8),
    });
    let current = fillStage(sf, competitionId, 0); // groups done, semis seeded
    const event = () => getComp(current, competitionId).sportEvents[0];
    const ko = () => event()?.stages[1];

    // Publish semifinal 1.
    const semiRound = ko()?.rounds[0];
    const semiFx = semiRound?.fixtures[0];
    const koStage = ko();
    if (!koStage || !semiRound || !semiFx) throw new Error('structure missing');
    current = setScore(current, refFor(current, competitionId, koStage, semiRound, semiFx), score(2, 0));
    current = publishRound(current, {
      competitionId,
      eventId: event()?.id ?? '',
      stageId: koStage.id,
      roundId: semiRound.id,
    });
    expect(spineWarnings(current).filter((w) => w.kind === 'bracket-contradiction')).toEqual([]);

    // Unlock & flip a group game so a different team should have qualified.
    const groups = event()?.stages[0];
    const md = groups?.rounds[0];
    const gfx = md?.fixtures[0];
    if (!groups || !md || !gfx) throw new Error('structure missing');
    const gRef = refFor(current, competitionId, groups, md, gfx);
    current = setScore(current, gRef, score(0, 9)); // upset rewrites the group table
    // Make the upset decisive across the whole group: flip every game touching the old winner.
    const winnerId = gfx.homeEntryId;
    for (const round of groups.rounds) {
      for (const fx2 of round.fixtures) {
        if (fx2.id === gfx.id) continue;
        if (fx2.homeEntryId === winnerId) {
          current = setScore(current, refFor(current, competitionId, groups, round, fx2), score(0, 9));
        } else if (fx2.awayEntryId === winnerId) {
          current = setScore(current, refFor(current, competitionId, groups, round, fx2), score(9, 0));
        }
      }
    }

    const kinds = spineWarnings(current).map((w) => w.kind);
    expect(kinds).toContain('bracket-contradiction');
    expect(kinds).toContain('stale-upstream');
  });
});
