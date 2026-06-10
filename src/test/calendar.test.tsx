/**
 * Smoke-mounts the planning calendar (grid) and the read-only matchday
 * overview with a live store. The overview must contain no inputs — the
 * calendar is for overview & planning, never score entry.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CalendarRoute } from '../routes/Calendar';
import { CalendarMatchdayRoute } from '../routes/CalendarMatchday';
import { adHocEntries, fillStage, setUp } from '../engine/testkit';
import { useSavefileStore } from '../stores/savefile';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  useSavefileStore.setState({ status: 'idle', savefile: null, activeSaveId: null, slots: [] });
});

function mountAt(path: string): HTMLElement {
  const { sf, competitionId } = setUp({
    name: 'World Cup 88',
    shortName: 'WC',
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
  const played = fillStage(sf, competitionId, 0);
  useSavefileStore.setState({ status: 'ready', savefile: played, activeSaveId: 'test', slots: [] });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/calendar', element: createElement(CalendarRoute) }),
          createElement(Route, { path: '/calendar/:md', element: createElement(CalendarMatchdayRoute) }),
        ),
      ),
    );
  });
  return container;
}

describe('calendar smoke', () => {
  it('grid shows draggable round chips with sport, competition, and status', () => {
    const el = mountAt('/calendar');
    expect(el.innerHTML).toContain('WC');
    expect(el.innerHTML).toContain('⚽');
    expect(el.querySelectorAll('.cal-round[draggable="true"]').length).toBeGreaterThan(0);
    expect(el.querySelectorAll('.cal-cell').length).toBe(10); // mkSave: 10 matchdays
  });

  it('matchday overview lists fixtures read-only — zero inputs', () => {
    const el = mountAt('/calendar/1');
    expect(el.innerHTML).toContain('World Cup 88');
    expect(el.innerHTML).toContain('2–0'); // played scores shown
    expect(el.querySelectorAll('input').length).toBe(0);
    expect(el.querySelectorAll('.mdov-block').length).toBe(1);
  });
});
