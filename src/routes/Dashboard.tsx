import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';
import { isRealClub } from '../utils/freeAgents';

const SQUAD_MIN = 11;
const SQUAD_MAX = 30;

export function DashboardRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);

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

  type Warning = { kind: 'under' | 'over' | 'noManager'; clubName: string; count: number };
  const warnings: Warning[] = [];
  for (const club of realClubs) {
    const squadSize = club.squadPlayerIds.length;
    if (squadSize < SQUAD_MIN) {
      warnings.push({ kind: 'under', clubName: club.name, count: squadSize });
    }
    if (squadSize > SQUAD_MAX) {
      warnings.push({ kind: 'over', clubName: club.name, count: squadSize });
    }
    if (!club.managerId) {
      warnings.push({ kind: 'noManager', clubName: club.name, count: 0 });
    }
  }

  return (
    <>
      <PageHeading
        title={t('dashboard.welcome', { country: savefile.meta.countryName })}
        sub={t('dashboard.sub')}
      />
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      {warnings.length > 0 ? (
        <div className="warning-panel">
          <strong style={{ display: 'block', marginBottom: 6 }}>
            {t('dashboard.coverage.title')}
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {warnings.map((w, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                {t(`dashboard.coverage.${w.kind}`, { name: w.clubName, count: w.count })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
