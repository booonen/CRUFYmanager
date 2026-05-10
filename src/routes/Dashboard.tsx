import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';
import { isRealClub } from '../utils/freeAgents';
import type { Club } from '../domain/club';

const SQUAD_MIN = 11;
const SQUAD_MAX = 30;

type Tab = 'overview' | 'issues';

interface Issue {
  id: string;
  kind: 'under' | 'over' | 'noManager';
  club: Club;
  count: number;
}

export function DashboardRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);
  const [tab, setTab] = useState<Tab>('overview');

  if (status !== 'ready' || !savefile) {
    return (
      <EmptyState
        glyph="◉"
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

  const realClubs = savefile.clubs.filter(isRealClub);
  const fixtureCount = savefile.calendar.schedule.reduce(
    (sum, slot) => sum + slot.fixtures.length,
    0,
  );
  const domesticPlayerCount = savefile.players.filter((p) => p.tier === 'domestic').length;

  const stats: { label: string; value: string | number }[] = [
    { label: t('dashboard.stats.season'), value: savefile.calendar.currentSeason },
    { label: t('dashboard.stats.matchday'), value: savefile.calendar.currentMatchday },
    { label: t('dashboard.stats.clubs'), value: realClubs.length },
    { label: t('dashboard.stats.players'), value: domesticPlayerCount },
    { label: t('dashboard.stats.managers'), value: savefile.managers.length },
    { label: t('dashboard.stats.competitions'), value: savefile.competitions.length },
    { label: t('dashboard.stats.fixtures'), value: fixtureCount },
  ];

  const issues: Issue[] = [];
  for (const club of realClubs) {
    const squadSize = club.squadPlayerIds.length;
    if (squadSize < SQUAD_MIN) {
      issues.push({ id: `${club.id}-under`, kind: 'under', club, count: squadSize });
    }
    if (squadSize > SQUAD_MAX) {
      issues.push({ id: `${club.id}-over`, kind: 'over', club, count: squadSize });
    }
    if (!club.managerId) {
      issues.push({ id: `${club.id}-noMgr`, kind: 'noManager', club, count: 0 });
    }
  }

  return (
    <>
      <PageHeading
        title={t('dashboard.welcome', { country: savefile.meta.countryName })}
        sub={t('dashboard.sub')}
      />

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={tab === 'overview' ? 'chip chip--active' : 'chip'}
          onClick={() => setTab('overview')}
        >
          {t('dashboard.overviewTab')}
        </button>
        <button
          type="button"
          className={tab === 'issues' ? 'chip chip--active' : 'chip'}
          onClick={() => setTab('issues')}
        >
          {t('dashboard.issuesTab')}
          {issues.length > 0 ? (
            <span
              className="mono"
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 999,
                background: 'rgba(224, 168, 85, 0.18)',
                color: 'var(--warn)',
                fontSize: 11,
              }}
            >
              {issues.length}
            </span>
          ) : null}
        </button>
      </div>

      {tab === 'overview' ? (
        <div className="stat-grid">
          {stats.map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-card__value">{s.value}</div>
              <div className="stat-card__label">{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <IssuesPane issues={issues} />
      )}
    </>
  );
}

function IssuesPane({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <div
        className="panel"
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--success)',
          borderColor: 'rgba(85, 192, 122, 0.4)',
        }}
      >
        {t('dashboard.issues.none')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {issues.map((iss) => (
        <Link
          key={iss.id}
          to={`/clubs/${iss.club.id}`}
          className="list-row"
          style={{ textDecoration: 'none' }}
        >
          <span
            className="mono"
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background:
                iss.kind === 'over'
                  ? 'rgba(224, 168, 85, 0.18)'
                  : iss.kind === 'under'
                  ? 'rgba(224, 85, 85, 0.18)'
                  : 'rgba(91, 138, 245, 0.18)',
              color:
                iss.kind === 'over'
                  ? 'var(--warn)'
                  : iss.kind === 'under'
                  ? 'var(--danger)'
                  : '#5b8af5',
            }}
          >
            {iss.kind === 'under' ? 'UNDER' : iss.kind === 'over' ? 'OVER' : 'NO MGR'}
          </span>
          <div className="list-row__main">
            <div className="list-row__title" style={{ color: 'var(--text)' }}>
              {t(`dashboard.issues.${iss.kind}`, {
                name: iss.club.name,
                count: iss.count,
              })}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
