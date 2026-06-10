/**
 * Smoke-mounts the stage cockpit for every stage of a half-played World Cup.
 * Regression for the Knockout-tab freeze: GroupDrawModal used to compute pots
 * while closed, and a knockout stage's zero group count made that loop forever.
 */
import { describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { CompetitionStageView } from '../components/CompetitionStageView';
import { adHocEntries, fillStage, getComp, setUp } from '../engine/testkit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function worldCup(playedRounds: 'none' | 'partial' | 'groups-done') {
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
  const current = playedRounds === 'none' ? sf : fillStage(sf, competitionId, 0);
  return { sf: current, competitionId };
}

function mountStage(sfId: ReturnType<typeof worldCup>, stageIndex: number): string {
  const comp = getComp(sfId.sf, sfId.competitionId);
  const event = comp.sportEvents[0];
  const stage = event?.stages[stageIndex];
  if (!event || !stage) throw new Error('structure missing');

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(CompetitionStageView, {
        sf: sfId.sf,
        competition: comp,
        event,
        stage,
        stageIndex,
      }),
    );
  });
  const html = container.innerHTML;
  act(() => root.unmount());
  container.remove();
  return html;
}

describe('stage cockpit smoke', () => {
  it('groups tab renders with no results', () => {
    const html = mountStage(worldCup('none'), 0);
    expect(html).toContain('Group A');
  });

  it('knockout tab renders while the group stage is incomplete (regression: froze)', () => {
    const html = mountStage(worldCup('none'), 1);
    expect(html.length).toBeGreaterThan(0);
  });

  it('knockout tab renders with a seeded bracket', () => {
    const html = mountStage(worldCup('groups-done'), 1);
    expect(html).toContain('Nation 1');
  });
});
