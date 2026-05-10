import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { ClubDetail as ClubDetailPanel } from '../components/ClubDetail';
import { ClubFormModal } from '../components/ClubFormModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { type ClubInput, deleteClub, updateClub, useClub } from '../stores/clubs';
import { usePlayersForClub } from '../stores/players';
import { useSavefileStore } from '../stores/savefile';
import { isFreeAgentsClub } from '../utils/freeAgents';

export function ClubDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const status = useSavefileStore((s) => s.status);
  const club = useClub(id ?? null);
  const squad = usePlayersForClub(id ?? null);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === 'ready' && id && !club) {
      // already deleted; bounce back to list
      navigate('/clubs', { replace: true });
    }
  }, [status, id, club, navigate]);

  if (status !== 'ready') {
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

  if (!club) {
    return (
      <>
        <PageHeading
          title={t('clubs.detail.notFound')}
          actions={
            <Link to="/clubs">
              <Button>{t('clubs.detail.back')}</Button>
            </Link>
          }
        />
        <EmptyState glyph="◎" title={t('clubs.detail.notFound')} body={t('clubs.detail.notFoundBody')} />
      </>
    );
  }

  const handleSubmit = async (input: ClubInput) => {
    updateClub(club.id, input);
    setEditing(false);
  };

  return (
    <>
      <PageHeading
        title={club.name}
        sub={isFreeAgentsClub(club) ? t('clubs.freeAgentsBody') : `${club.shortName} · ${club.city || '—'}`}
        actions={
          <Link to="/clubs">
            <Button>{t('clubs.detail.back')}</Button>
          </Link>
        }
      />

      <ClubDetailPanel
        club={club}
        squad={squad}
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleting(true)}
      />

      <ClubFormModal
        open={editing}
        initial={club}
        onCancel={() => setEditing(false)}
        onSubmit={handleSubmit}
      />

      {deleting ? (
        <ConfirmModal
          open={true}
          title={t('clubs.deleteTitle')}
          variant="danger"
          confirmLabel={t('clubs.delete')}
          body={t('clubs.deleteWarning', {
            name: club.name,
            count: club.squadPlayerIds.length,
          })}
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            deleteClub(club.id);
            navigate('/clubs');
          }}
        />
      ) : null}
    </>
  );
}
