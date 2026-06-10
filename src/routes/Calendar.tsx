import { useMemo, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import {
  STATUS_GLYPH,
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

function RoundChip({ entry, onOpen }: { entry: CalendarSlotEntry; onOpen: () => void }) {
  const status = roundStatus(entry.round);
  return (
    <div
      className="cal-round"
      draggable
      title={`${entry.competition.name} — ${entry.stage.name} · ${entry.round.name}`}
      onDragStart={(e) => {
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

  const index = useMemo(
    () => (savefile ? matchdayIndex(savefile) : new Map<number, CalendarSlotEntry[]>()),
    [savefile],
  );
  const unscheduled = useMemo(() => (savefile ? unscheduledRounds(savefile) : []), [savefile]);

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
  const days = Array.from({ length: calendar.matchdaysPerSeason }, (_, i) => i + 1);

  const openCompetition = (entry: CalendarSlotEntry) =>
    navigate(`/competitions/${entry.competition.id}?stage=${entry.stage.id}&round=${entry.round.id}`);

  const handleDrop = (e: DragEvent, target: number | null) => {
    e.preventDefault();
    setDropTarget(null);
    const ref = parseDrop(e);
    if (ref) setRoundMatchdayAction(ref, target);
  };

  return (
    <>
      <PageHeading
        title={t('nav.calendar')}
        sub={t('calendar.sub', { season: calendar.currentSeason, md: calendar.currentMatchday })}
        actions={
          <Button size="sm" variant="primary" onClick={advanceMatchday}>
            {t('calendar.advance')}
          </Button>
        }
      />

      {savefile.competitions.length === 0 ? (
        <div className="panel" style={{ padding: 16, color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
          {t('calendar.noSchedule')}
        </div>
      ) : null}

      <div className="cal-grid">
        {days.map((md) => {
          const entries = index.get(md) ?? [];
          const isCurrent = md === calendar.currentMatchday;
          return (
            <div
              key={md}
              className={[
                'cal-cell',
                isCurrent ? 'cal-cell--current' : '',
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
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(md);
              }}
              onDragLeave={() => setDropTarget((cur) => (cur === md ? null : cur))}
              onDrop={(e) => handleDrop(e, md)}
            >
              <div className="cal-cell__head">
                <span className="mono cal-cell__md">{md}</span>
                {isCurrent ? <span className="cal-cell__now">{t('calendar.current')}</span> : null}
              </div>
              <div className="cal-cell__rounds">
                {entries.map((entry) => (
                  <RoundChip key={entry.round.id} entry={entry} onOpen={() => openCompetition(entry)} />
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
              <RoundChip key={entry.round.id} entry={entry} onOpen={() => openCompetition(entry)} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
