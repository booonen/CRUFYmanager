import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { OvrBadge } from '../components/OvrBadge';
import { PageHeading } from '../components/PageHeading';
import { PlayerFormModal } from '../components/PlayerFormModal';
import { PositionPill } from '../components/PositionPill';
import { StatBar } from '../components/StatBar';
import { t } from '../lang';
import {
  GK_GAME_STATS,
  OUTFIELD_GAME_STATS,
  type DomesticPlayer,
  type GameStat,
} from '../domain/player';
import { useClubs } from '../stores/clubs';
import { deletePlayer, updateDomesticPlayer, usePlayer } from '../stores/players';
import { useSavefileStore } from '../stores/savefile';
import { computeAge } from '../utils/age';

const STAT_LABELS: Record<GameStat, string> = {
  pace: 'Pace',
  finishing: 'Finishing',
  passing: 'Passing',
  dribbling: 'Dribbling',
  defending: 'Defending',
  heading: 'Heading',
  vision: 'Vision',
  physicality: 'Physicality',
  technique: 'Technique',
  handling: 'Handling',
  reflexes: 'Reflexes',
  kicking: 'Kicking',
};

export function PlayerDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const status = useSavefileStore((s) => s.status);
  const calendar = useSavefileStore((s) => s.savefile?.calendar ?? null);
  const player = usePlayer(id ?? null);
  const clubs = useClubs();

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const domestic = player?.tier === 'domestic' ? (player as DomesticPlayer) : null;
  const club = useMemo(
    () => (domestic ? clubs.find((c) => c.id === domestic.clubId) ?? null : null),
    [clubs, domestic],
  );

  if (status !== 'ready' || !calendar) {
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

  if (!domestic) {
    return (
      <>
        <PageHeading
          title={t('players.profile.notFound')}
          actions={
            <Link to="/players">
              <Button>{t('players.profile.back')}</Button>
            </Link>
          }
        />
        <EmptyState glyph="◐" title={t('players.profile.notFound')} body={t('players.profile.notFoundBody')} />
      </>
    );
  }

  const isGK = domestic.position === 'GK';
  const age = computeAge(domestic.dateOfBirth, calendar);

  return (
    <>
      <PageHeading
        title={domestic.name}
        sub={`${club?.name ?? '—'} · ${domestic.nationality || '—'}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/players">
              <Button>{t('players.profile.back')}</Button>
            </Link>
            <Button variant="primary" onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              {t('common.delete')}
            </Button>
          </div>
        }
      />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <OvrBadge value={domestic.stats.ovr} size="lg" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <PositionPill position={domestic.position} />
              <span className="mono text-dim" style={{ fontSize: 12 }}>
                #{domestic.squadNumber ?? '—'} · {age}y · {domestic.preferredFoot}-foot
              </span>
            </div>
            <div className="chip-row" style={{ marginTop: 4 }}>
              {domestic.stats.personalities.map((p) => (
                <span key={p} className="chip chip--active" style={{ cursor: 'default' }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="form-section" style={{ marginTop: 0 }}>
        <div className="form-section__heading">{t('players.sections.stats')}</div>
        <div className="form-grid">
          {OUTFIELD_GAME_STATS.map((stat) => (
            <StatBar key={stat} label={STAT_LABELS[stat]} value={domestic.stats[stat]} />
          ))}
        </div>

        <div className="form-section__heading" style={{ marginTop: 16 }}>
          {t('players.sections.gkStats')}{' '}
          {!isGK ? (
            <span className="text-muted" style={{ fontSize: 11, marginLeft: 6 }}>
              {t('players.profile.gkOnlyHidden')}
            </span>
          ) : null}
        </div>
        <div className="form-grid">
          {GK_GAME_STATS.map((stat) => (
            <StatBar
              key={stat}
              label={STAT_LABELS[stat]}
              value={domestic.stats[stat]}
              dim={!isGK}
            />
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">{t('players.sections.hidden')}</div>
        <div className="form-grid">
          <StatBar label={t('players.fields.consistency')} value={domestic.stats.consistency} />
          <StatBar label={t('players.fields.workRate')} value={domestic.stats.workRate} />
          <StatBar
            label={t('players.fields.injuryProneness')}
            value={domestic.stats.injuryProneness}
          />
          <StatBar label={t('players.fields.potential')} value={domestic.stats.potential} />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">{t('players.profile.condition')}</div>
        <div className="form-grid">
          <StatBar label={t('players.fields.currentForm')} value={domestic.currentForm} />
          <StatBar label={t('players.fields.currentMorale')} value={domestic.currentMorale} />
          <StatBar label={t('players.fields.currentFitness')} value={domestic.currentFitness} />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">{t('players.sections.career')}</div>
        {domestic.careerHistory.length === 0 ? (
          <div className="text-dim" style={{ fontSize: 13, padding: 12 }}>
            {t('players.sections.careerEmpty')}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Club</th>
                <th>Apps</th>
                <th>Goals</th>
                <th>Assists</th>
                <th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {[...domestic.careerHistory]
                .sort((a, b) => a.season - b.season)
                .map((row, i) => (
                  <tr key={`${row.season}-${row.clubId}-${i}`}>
                    <td className="mono">{row.season}</td>
                    <td>{clubs.find((c) => c.id === row.clubId)?.name ?? row.clubId}</td>
                    <td className="mono">{row.appearances}</td>
                    <td className="mono">{row.goals}</td>
                    <td className="mono">{row.assists}</td>
                    <td className="mono">{row.averageRating.toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <PlayerFormModal
        open={editing}
        initial={domestic}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          updateDomesticPlayer(domestic.id, input);
          setEditing(false);
        }}
      />

      {deleting ? (
        <ConfirmModal
          open={true}
          title={t('players.deleteTitle')}
          confirmLabel={t('players.delete')}
          variant="danger"
          body={t('players.deleteWarning', { name: domestic.name })}
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            deletePlayer(domestic.id);
            navigate('/players');
          }}
        />
      ) : null}
    </>
  );
}
