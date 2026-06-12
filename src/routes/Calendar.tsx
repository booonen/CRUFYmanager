import { useLayoutEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import {
  STATUS_GLYPH,
  advanceBlockers,
  compactRoundLabel,
  matchdayIndex,
  roundStatus,
  unscheduledRounds,
  type CalendarSlotEntry,
} from '../engine/calendar';
import type { RoundRef } from '../engine/mutate';
import { t } from '../lang';
import { advanceMatchday } from '../stores/calendar';
import { setRoundMatchdayAction } from '../stores/competitions';
import { useSavefileStore } from '../stores/savefile';
import { SPORT_ICON } from '../utils/sport';

const DRAG_MIME = 'application/x-crufy-round';

// Viewport-adaptive paging: as many whole cells as fit without a scrollbar.
const MIN_CELL_W = 330; // matches .cal-grid minmax
const CELL_H = 197; // .cal-cell min-height + borders
const GRID_GAP = 10;
const RESERVED_BELOW = 120; // unscheduled tray + breathing room
const FALLBACK_PAGE_SIZE = 24; // unmeasurable environments (e.g. jsdom)

interface CalendarLayout {
  cols: number; // 0 = unmeasured, let CSS auto-fill decide
  pageSize: number;
}

function useCalendarLayout(gridRef: RefObject<HTMLDivElement | null>, active: boolean): CalendarLayout {
  const [layout, setLayout] = useState<CalendarLayout>({ cols: 0, pageSize: FALLBACK_PAGE_SIZE });

  useLayoutEffect(() => {
    if (!active) return;
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      if (width < MIN_CELL_W) {
        setLayout((prev) =>
          prev.cols === 0 && prev.pageSize === FALLBACK_PAGE_SIZE
            ? prev
            : { cols: 0, pageSize: FALLBACK_PAGE_SIZE },
        );
        return;
      }
      const cols = Math.max(1, Math.floor((width + GRID_GAP) / (MIN_CELL_W + GRID_GAP)));
      const available = window.innerHeight - el.getBoundingClientRect().top - RESERVED_BELOW;
      const rows = Math.max(1, Math.floor((available + GRID_GAP) / (CELL_H + GRID_GAP)));
      const pageSize = cols * rows;
      setLayout((prev) => (prev.cols === cols && prev.pageSize === pageSize ? prev : { cols, pageSize }));
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [gridRef, active]);

  return layout;
}

function dragPayload(entry: CalendarSlotEntry): string {
  const ref: RoundRef = {
    competitionId: entry.competition.id,
    eventId: entry.event.id,
    stageId: entry.stage.id,
    roundId: entry.round.id,
  };
  return JSON.stringify(ref);
}

function parseDrop(e: DragEvent): RoundRef | null {
  const raw = e.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoundRef;
  } catch {
    return null;
  }
}

function RoundChip({
  entry,
  locked,
  onOpen,
}: {
  entry: CalendarSlotEntry;
  locked: boolean;
  onOpen: () => void;
}) {
  const status = roundStatus(entry.round);
  return (
    <div
      className={`cal-round ${locked ? 'cal-round--locked' : ''}`}
      draggable={!locked}
      title={
        `${entry.competition.name} — ${entry.stage.name} · ${entry.round.name}` +
        (locked ? ` (${t('calendar.pastLocked')})` : '')
      }
      onDragStart={(e) => {
        if (locked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(DRAG_MIME, dragPayload(entry));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span className="cal-round__sport">{SPORT_ICON[entry.event.sport]}</span>
      <span className="mono cal-round__comp">{entry.competition.shortName}</span>
      <span className="cal-round__label">{compactRoundLabel(entry.stage, entry.round)}</span>
      <span className={`cal-round__status round-rail__glyph--${status}`}>{STATUS_GLYPH[status]}</span>
    </div>
  );
}

export function CalendarRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);
  const navigate = useNavigate();
  const [dropTarget, setDropTarget] = useState<number | 'tray' | null>(null);
  const [page, setPage] = useState<number | null>(null); // null = follow current matchday
  const [actionError, setActionError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const { cols, pageSize } = useCalendarLayout(gridRef, status === 'ready' && savefile !== null);

  const index = useMemo(
    () => (savefile ? matchdayIndex(savefile) : new Map<number, CalendarSlotEntry[]>()),
    [savefile],
  );
  const unscheduled = useMemo(() => (savefile ? unscheduledRounds(savefile) : []), [savefile]);
  const blockers = useMemo(() => (savefile ? advanceBlockers(savefile) : []), [savefile]);

  if (status !== 'ready' || !savefile) {
    return (
      <EmptyState
        glyph="◰"
        title={t('saves.empty.title')}
        body={t('saves.empty.body')}
        action={
          <Link to="/saves">
            <Button variant="primary">{t('saves.new')}</Button>
          </Link>
        }
      />
    );
  }

  const calendar = savefile.calendar;
  const totalPages = Math.max(1, Math.ceil(calendar.matchdaysPerSeason / pageSize));
  const pageOf = (md: number) => Math.floor((md - 1) / pageSize);
  const activePage = Math.min(page ?? pageOf(calendar.currentMatchday), totalPages - 1);
  const firstMd = activePage * pageSize + 1;
  const lastMd = Math.min(firstMd + pageSize - 1, calendar.matchdaysPerSeason);
  const days = Array.from({ length: lastMd - firstMd + 1 }, (_, i) => firstMd + i);

  const atSeasonEnd = calendar.currentMatchday >= calendar.matchdaysPerSeason;
  const advanceDisabled = blockers.length > 0 || atSeasonEnd;

  const openCompetition = (entry: CalendarSlotEntry) =>
    navigate(`/competitions/${entry.competition.id}?stage=${entry.stage.id}&round=${entry.round.id}`);

  const handleDrop = (e: DragEvent, target: number | null) => {
    e.preventDefault();
    setDropTarget(null);
    const ref = parseDrop(e);
    if (!ref) return;
    const result = setRoundMatchdayAction(ref, target);
    setActionError(result.ok ? null : result.message);
  };

  const droppable = (md: number) => md >= calendar.currentMatchday;

  return (
    <>
      <PageHeading
        title={t('nav.calendar')}
        sub={t('calendar.sub', { season: calendar.currentSeason, md: calendar.currentMatchday })}
        actions={
          <Button
            size="sm"
            variant="primary"
            disabled={advanceDisabled}
            title={
              blockers.length > 0
                ? t('calendar.advanceBlocked', { count: blockers.length, md: calendar.currentMatchday })
                : atSeasonEnd
                  ? t('calendar.seasonEnd')
                  : undefined
            }
            onClick={() => {
              const result = advanceMatchday();
              setActionError(result.ok ? null : result.message);
              if (result.ok) setPage(null); // follow the new current matchday
            }}
          >
            {t('calendar.advance')}
          </Button>
        }
      />

      {blockers.length > 0 ? (
        <div className="warning-panel" style={{ marginBottom: 10 }}>
          {t('calendar.advanceBlocked', { count: blockers.length, md: calendar.currentMatchday })}
        </div>
      ) : null}
      {actionError ? (
        <div
          className="mono"
          style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10, cursor: 'pointer' }}
          onClick={() => setActionError(null)}
        >
          {actionError}
        </div>
      ) : null}

      {savefile.competitions.length === 0 ? (
        <div className="panel" style={{ padding: 16, color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
          {t('calendar.noSchedule')}
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className="cal-pager">
          <Button size="sm" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>
            ‹
          </Button>
          <span className="mono cal-pager__label">
            {t('calendar.pageLabel', { from: firstMd, to: lastMd, total: calendar.matchdaysPerSeason })}
          </span>
          <Button size="sm" disabled={activePage >= totalPages - 1} onClick={() => setPage(activePage + 1)}>
            ›
          </Button>
          {activePage !== pageOf(calendar.currentMatchday) ? (
            <Button size="sm" onClick={() => setPage(null)}>
              {t('calendar.jumpToCurrent')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className="cal-grid"
        ref={gridRef}
        style={cols > 0 ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
      >
        {days.map((md) => {
          const entries = index.get(md) ?? [];
          const isCurrent = md === calendar.currentMatchday;
          const isPast = md < calendar.currentMatchday;
          return (
            <div
              key={md}
              className={[
                'cal-cell',
                isCurrent ? 'cal-cell--current' : '',
                isPast ? 'cal-cell--past' : '',
                entries.length > 0 ? 'cal-cell--busy' : '',
                dropTarget === md ? 'cal-cell--dropover' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/calendar/${md}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/calendar/${md}`);
              }}
              onDragOver={(e) => {
                if (!droppable(md)) return; // past days refuse drops
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(md);
              }}
              onDragLeave={() => setDropTarget((cur) => (cur === md ? null : cur))}
              onDrop={(e) => {
                if (!droppable(md)) return;
                handleDrop(e, md);
              }}
            >
              <div className="cal-cell__head">
                <span className="mono cal-cell__md">{md}</span>
                {isCurrent ? <span className="cal-cell__now">{t('calendar.current')}</span> : null}
              </div>
              <div className="cal-cell__rounds">
                {entries.map((entry) => (
                  <RoundChip
                    key={entry.round.id}
                    entry={entry}
                    locked={isPast}
                    onOpen={() => openCompetition(entry)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`cal-tray ${dropTarget === 'tray' ? 'cal-tray--dropover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropTarget('tray');
        }}
        onDragLeave={() => setDropTarget((cur) => (cur === 'tray' ? null : cur))}
        onDrop={(e) => handleDrop(e, null)}
      >
        <div className="cal-tray__title">
          {t('calendar.unscheduled')}
          <span className="cal-tray__hint">{t('calendar.trayHint')}</span>
        </div>
        <div className="cal-tray__items">
          {unscheduled.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
          ) : (
            unscheduled.map((entry) => (
              <RoundChip
                key={entry.round.id}
                entry={entry}
                locked={false}
                onOpen={() => openCompetition(entry)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
