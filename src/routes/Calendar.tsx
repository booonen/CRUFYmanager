import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { RoundCard } from '../components/RoundCard';
import { matchdayIndex, unscheduledRounds, type CalendarSlotEntry } from '../engine/calendar';
import { t } from '../lang';
import { advanceMatchday, setCurrentMatchday } from '../stores/calendar';
import { useSavefileStore } from '../stores/savefile';

export function CalendarRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);
  const [selectedMd, setSelectedMd] = useState<number | null>(null);

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
  const selected = selectedMd ?? calendar.currentMatchday;
  const selectedEntries = index.get(selected) ?? [];
  const days = Array.from({ length: calendar.matchdaysPerSeason }, (_, i) => i + 1);

  return (
    <>
      <PageHeading
        title={t('nav.calendar')}
        sub={t('calendar.sub', { season: calendar.currentSeason, md: calendar.currentMatchday })}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => setSelectedMd(calendar.currentMatchday)}>
              {t('calendar.jumpToCurrent')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                advanceMatchday();
                setSelectedMd(null); // selection follows the current matchday
              }}
            >
              {t('calendar.advance')}
            </Button>
          </div>
        }
      />

      <div className="cal-grid">
        {days.map((md) => {
          const entries = index.get(md) ?? [];
          const isCurrent = md === calendar.currentMatchday;
          const isSelected = md === selected;
          const compNames = [...new Set(entries.map((e) => e.competition.shortName))];
          return (
            <button
              key={md}
              type="button"
              className={[
                'cal-cell',
                isCurrent ? 'cal-cell--current' : '',
                isSelected ? 'cal-cell--selected' : '',
                entries.length > 0 ? 'cal-cell--busy' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelectedMd(md)}
              onDoubleClick={() => setCurrentMatchday(md)}
              title={isCurrent ? t('calendar.current') : t('calendar.cellHint')}
            >
              <span className="mono cal-cell__md">{md}</span>
              <span className="cal-cell__chips">
                {compNames.map((name) => (
                  <span key={name} className="cal-cell__chip mono">
                    {name}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          {t('calendar.onMatchday', { md: selected })}
          {selected === calendar.currentMatchday ? (
            <span className="chip chip--active" style={{ marginLeft: 8, fontSize: 10 }}>
              {t('calendar.current')}
            </span>
          ) : null}
        </div>

        {selectedEntries.length === 0 ? (
          <div className="panel" style={{ padding: 16, color: 'var(--text-dim)', fontSize: 13 }}>
            {savefile.competitions.length === 0 ? t('calendar.noSchedule') : t('calendar.emptyDay')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
            {selectedEntries.map((entry) => (
              <div key={entry.round.id}>
                <Link
                  to={`/competitions/${entry.competition.id}`}
                  style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                >
                  {entry.competition.name} — {entry.stage.name}
                </Link>
                <RoundCard
                  sf={savefile}
                  event={entry.event}
                  stage={entry.stage}
                  round={entry.round}
                  stageRef={{
                    competitionId: entry.competition.id,
                    eventId: entry.event.id,
                    stageId: entry.stage.id,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {unscheduled.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13, color: 'var(--warn)' }}>
              {t('calendar.unscheduled')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {unscheduled.map((entry) => (
                <Link
                  key={entry.round.id}
                  to={`/competitions/${entry.competition.id}`}
                  className="list-row"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                    {entry.competition.shortName}
                  </span>
                  <div className="list-row__main">
                    <div className="list-row__title" style={{ color: 'var(--text)', fontSize: 13 }}>
                      {entry.stage.name} · {entry.round.name}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
