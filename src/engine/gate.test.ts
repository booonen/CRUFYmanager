import { describe, expect, it } from 'vitest';
import { computeOverallTable, stageComplete } from './qualification';
import { matchdayPostBBCode, roundResultsBBCode, stageTablesBBCode } from '../export/bbcode';
import { publishRound } from './mutate';
import { spineWarnings } from './integrity';
import { adHocEntries, fillStage, getComp, setUp } from './testkit';

/**
 * Automated rehearsal of the Phase 2 acceptance gate (docs/phases/phase-2.md §6).
 * The real gate is verified by hand on the deployed site; this keeps the same
 * journey green in CI.
 */
describe('phase 2 gate rehearsal', () => {
  it('runs a 32-nation World Cup from ad-hoc entries end to end', () => {
    const { sf, competitionId } = setUp({
      name: 'World Cup 88',
      shortName: 'WC',
      preset: {
        kind: 'groups-knockout',
        groupCount: 8,
        legs: 1,
        qualifyPerGroup: 2,
        bestOfPlace: null,
        koLegs: 1,
        thirdPlace: true,
        awayGoals: false,
      },
      entries: adHocEntries(32),
    });

    // Group stage: 8 groups of 4 → 3 matchdays of 16 fixtures.
    let current = sf;
    const event = () => getComp(current, competitionId).sportEvents[0];
    const groups = () => event()?.stages[0];
    expect(groups()?.rounds).toHaveLength(3);
    expect(groups()?.rounds.every((r) => r.fixtures.length === 16)).toBe(true);

    current = fillStage(current, competitionId, 0);
    expect(stageComplete(groups() ?? (() => { throw new Error('no stage'); })())).toBe(true);

    // Publish every group round; a clean publish raises no warnings.
    for (const round of groups()?.rounds ?? []) {
      current = publishRound(current, {
        competitionId,
        eventId: event()?.id ?? '',
        stageId: groups()?.id ?? '',
        roundId: round.id,
      });
    }
    expect(spineWarnings(current)).toEqual([]);

    // Knockout: R16 → QF → SF → third place → final, all auto-seeded and playable.
    current = fillStage(current, competitionId, 1);
    const ko = event()?.stages[1];
    expect(ko?.rounds.map((r) => r.fixtures.length)).toEqual([8, 4, 2, 1, 1]);
    expect(ko?.rounds.every((r) => r.fixtures.every((fx) => fx.result !== null))).toBe(true);

    // BBCode exports look like real NS results posts: [box] per group, MD header,
    // plain result lines, cumulative [pre] table.
    const stage0 = groups();
    const ev = event();
    if (!stage0 || !ev) throw new Error('structure missing');
    const tables = stageTablesBBCode(current, ev, stage0);
    expect(tables).toContain('[pre]');
    expect(tables).toContain('Group A');
    expect(tables).toContain('Nation 1');
    expect(tables).toContain('Pts');

    const md1 = stage0.rounds[0];
    const post = md1 ? matchdayPostBBCode(current, ev, stage0, md1) : '';
    expect(post).toContain('[box]');
    expect(post).toContain('[b]MD1[/b]');
    expect(post).toContain('[hr][/hr]');
    expect(post).toMatch(/Nation \d+ \d+–\d+ Nation \d+/);
    expect(post).toContain('[pre]');

    const lastRound = ko?.rounds.at(-1);
    const results = lastRound ? roundResultsBBCode(current, ev, lastRound) : '';
    expect(results).toMatch(/Nation \d+ \d+–\d+ Nation \d+/);
  });

  it('runs a 12-team double round robin league', () => {
    const { sf, competitionId } = setUp({
      name: 'Cherry League',
      shortName: 'CHL',
      preset: { kind: 'league', legs: 2 },
      entries: adHocEntries(12),
    });
    const current = fillStage(sf, competitionId, 0);
    const stage = getComp(current, competitionId).sportEvents[0]?.stages[0];
    expect(stage?.rounds).toHaveLength(22);
    expect(stage?.rounds.every((r) => r.fixtures.length === 6)).toBe(true);

    const table = stage ? computeOverallTable(stage) : [];
    expect(table).toHaveLength(12);
    expect(table[0]?.played).toBe(22);
    // Better rank always wins in fillStage → strict rank order, 22 wins for #1.
    expect(table[0]?.points).toBe(66);
    expect(table.map((r) => r.position)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});
