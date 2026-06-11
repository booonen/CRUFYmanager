import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { CompetitionWizard } from '../components/CompetitionWizard';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { ScorinationSettingsModal } from '../components/ScorinationSettingsModal';
import type { Competition } from '../domain/spine';
import { t } from '../lang';
import { removeCompetition, useCompetitions } from '../stores/competitions';
import { useSavefileStore } from '../stores/savefile';

function roundProgress(comp: Competition): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const event of comp.sportEvents) {
    for (const stage of event.stages) {
      for (const round of stage.rounds) {
        const playable = round.fixtures.filter((fx) => !fx.isBye);
        if (playable.length === 0) continue;
        total += 1;
        if (playable.every((fx) => fx.result !== null)) done += 1;
      }
    }
  }
  return { done, total };
}

export function CompetitionsRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);
  const competitions = useCompetitions();
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Competition | null>(null);

  if (status !== 'ready' || !savefile) {
    return (
      <EmptyState
        glyph="◇"
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

  return (
    <>
      <PageHeading
        title={t('nav.competitions')}
        sub={t('competitions.sub')}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => setSettingsOpen(true)}>
              ⚙ {t('competitions.cockpit.settings')}
            </Button>
            <Button variant="primary" onClick={() => setWizardOpen(true)}>
              {t('competitions.new')}
            </Button>
          </div>
        }
      />

      {competitions.length === 0 ? (
        <EmptyState
          glyph="◇"
          title={t('competitions.empty.title')}
          body={t('competitions.empty.body')}
          action={
            <Button variant="primary" onClick={() => setWizardOpen(true)}>
              {t('competitions.new')}
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {competitions.map((comp) => {
            const progress = roundProgress(comp);
            const entryCount = comp.sportEvents.reduce((sum, ev) => sum + ev.entries.length, 0);
            return (
              <Link key={comp.id} to={`/competitions/${comp.id}`} className="list-row" style={{ textDecoration: 'none' }}>
                <span className="mono" style={{ fontSize: 11, width: 50, color: 'var(--accent)' }}>
                  {comp.shortName}
                </span>
                <div className="list-row__main">
                  <div className="list-row__title" style={{ color: 'var(--text)' }}>
                    {comp.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {t('competitions.card.entries', { count: entryCount })} ·{' '}
                    {t('competitions.card.rounds', { done: progress.done, total: progress.total })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteTarget(comp);
                  }}
                >
                  {t('common.delete')}
                </Button>
              </Link>
            );
          })}
        </div>
      )}

      <CompetitionWizard
        open={wizardOpen}
        sf={savefile}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => navigate(`/competitions/${id}`)}
      />
      <ScorinationSettingsModal
        open={settingsOpen}
        params={savefile.scorination.sim}
        onClose={() => setSettingsOpen(false)}
      />
      <ConfirmModal
        open={deleteTarget !== null}
        title={t('competitions.deleteTitle')}
        body={t('competitions.deleteWarning', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) removeCompetition(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
