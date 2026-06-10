import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import type { Fixture, SportEvent } from '../domain/spine';
import type { Savefile } from '../domain/savefile';
import {
  matchdayIndex,
  roundStatus,
  type CalendarSlotEntry,
} from '../engine/calendar';
import { t } from '../lang';
import { setCurrentMatchday } from '../stores/calendar';
import { useSavefileStore } from '../stores/savefile';
import { entryDisplay } from '../utils/participants';
import { SPORT_ICON } from '../utils/sport';

function FixtureLine({ sf, event, fx }: { sf: Savefile; event: SportEvent; fx: Fixture }) {
  if (fx.isBye) {
    const survivor = entryDisplay(sf, event, fx.homeEntryId ?? fx.awayEntryId);
    return (
      <div className="mdov-row mdov-row--bye">
        <span className="mdov-row__team" style={{ textAlign: 'right' }}>
          {survivor.name}
        </span>
        <span className="mono mdov-row__score">{t('competitions.cockpit.bye')}</span>
        <span className="mdov-row__team" />
      </div>
    );
  }
  const home = entryDisplay(sf, event, fx.homeEntryId);
  const away = entryDisplay(sf, event, fx.awayEntryId);
  const payload = fx.result?.payload.family === 'score' ? fx.result.payload : null;
  let score = '–';
  let suffix = '';
  if (payload) {
    score = `${payload.score[0]}–${payload.score[1]}`;
    if (payload.decidedBy === 'extra-time') suffix = t('competitions.cockpit.aet').toLowerCase();
    if (payload.decidedBy === 'shootout' && payload.shootout) {
      suffix = `${payload.shootout[0]}–${payload.shootout[1]} p`;
    }
  }
  return (
    <div className="mdov-row">
      <span className="mdov-row__team" style={{ textAlign: 'right' }}>
        {fx.homeEntryId ? home.name : t('competitions.cockpit.tbd')}
      </span>
      <span className="mono mdov-row__score">{score}</span>
      <span className="mdov-row__team">
        {fx.awayEntryId ? away.name : t('competitions.cockpit.tbd')}
        {suffix ? <span className="mdov-row__suffix mono"> {suffix}</span> : null}
      </span>
    </div>
  );
}

function MatchdayBlock({ sf, entry }: { sf: Savefile; entry: CalendarSlotEntry }) {
  const navigate = useNavigate();
  const status = roundStatus(entry.round);
  const playable = entry.round.fixtures.filter((fx) => !fx.isBye);
  const done = playable.filter((fx) => fx.result !== null).length;
  const target = `/competitions/${entry.competition.id}?stage=${entry.stage.id}&round=${entry.round.id}`;

  return (
    <div
      className="mdov-block panel"
      role="button"
      tabIndex={0}
      onClick={() => navigate(target)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(target);
      }}
    >
      <div className="mdov-block__head">
        <span>{SPORT_ICON[entry.event.sport]}</span>
        <span style={{ fontWeight: 600 }}>{entry.competition.name}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          {entry.stage.name} · {entry.round.name}
        </span>
        <span className="mdov-block__spacer" />
        <span className={`chip ${status === 'published' ? 'chip--active' : ''}`} style={{ fontSize: 10 }}>
          {t(`calendar.status.${status}`)} · {t('calendar.results', { done, total: playable.length })}
        </span>
      </div>
      <div className="mdov-block__fixtures">
        {entry.round.fixtures.map((fx) => (
          <FixtureLine key={fx.id} sf={sf} event={entry.event} fx={fx} />
        ))}
      </div>
    </div>
  );
}

export function CalendarMatchdayRoute() {
  const { md } = useParams<{ md: string }>();
  const savefile = useSavefileStore((s) => s.savefile);
  const matchday = Number(md);

  const entries = useMemo(
    () => (savefile ? (matchdayIndex(savefile).get(matchday) ?? []) : []),
    [savefile, matchday],
  );

  if (!savefile || !Number.isInteger(matchday) || matchday < 1) {
    return (
      <EmptyState
        glyph="◰"
        title={t('saves.empty.title')}
        action={
          <Link to="/calendar">
            <Button>{t('calendar.back')}</Button>
          </Link>
        }
      />
    );
  }

  const isCurrent = matchday === savefile.calendar.currentMatchday;

  return (
    <>
      <PageHeading
        title={t('calendar.onMatchday', { md: matchday })}
        sub={isCurrent ? t('calendar.current') : undefined}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            {!isCurrent ? (
              <Button size="sm" onClick={() => setCurrentMatchday(matchday)}>
                {t('calendar.setCurrent')}
              </Button>
            ) : null}
            <Link to="/calendar">
              <Button size="sm">{t('calendar.back')}</Button>
            </Link>
          </div>
        }
      />

      {entries.length === 0 ? (
        <div className="panel" style={{ padding: 16, color: 'var(--text-dim)', fontSize: 13 }}>
          {t('calendar.emptyDay')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
          {entries.map((entry) => (
            <MatchdayBlock key={entry.round.id} sf={savefile} entry={entry} />
          ))}
        </div>
      )}
    </>
  );
}
