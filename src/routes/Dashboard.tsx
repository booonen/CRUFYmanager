import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';
import { isRealClub } from '../utils/freeAgents';

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
    </>
  );
}
