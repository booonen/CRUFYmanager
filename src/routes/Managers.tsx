import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { ManagerFormModal } from '../components/ManagerFormModal';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { useClubs } from '../stores/clubs';
import {
  type ManagerInput,
  addManager,
  deleteManager,
  sackManager,
  updateManager,
  useManagers,
} from '../stores/managers';
import { useSavefileStore } from '../stores/savefile';
import type { Manager } from '../domain/manager';

export function ManagersRoute() {
  const status = useSavefileStore((s) => s.status);
  const managers = useManagers();
  const clubs = useClubs();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Manager | null>(null);
  const [deleting, setDeleting] = useState<Manager | null>(null);
  const [sackingTarget, setSackingTarget] = useState<Manager | null>(null);

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

  const employed = managers.filter((m) => m.contractClubId !== null);
  const pool = managers.filter((m) => m.contractClubId === null);

  const handleSubmit = async (input: ManagerInput) => {
    if (editing) {
      updateManager(editing.id, input);
    } else {
      addManager(input);
    }
    setEditing(null);
    setCreating(false);
  };

  return (
    <>
      <PageHeading
        title={t('managers.title')}
        sub={t('managers.sub')}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t('managers.new')}
          </Button>
        }
      />

      <div className="form-section" style={{ marginTop: 0 }}>
        <div className="form-section__heading">{t('managers.employed')}</div>
        {employed.length === 0 ? (
          <div className="text-dim" style={{ padding: 16, fontSize: 13 }}>
            {t('managers.employedEmpty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {employed.map((m) => {
              const clubName =
                clubs.find((c) => c.id === m.contractClubId)?.name ?? 'Unknown club';
              return (
                <ManagerRow
                  key={m.id}
                  m={m}
                  rightLabel={clubName}
                  onEdit={() => setEditing(m)}
                  onDelete={() => setDeleting(m)}
                  onSack={() => setSackingTarget(m)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="form-section__heading">{t('managers.pool')}</div>
        {pool.length === 0 ? (
          <div className="text-dim" style={{ padding: 16, fontSize: 13 }}>
            {t('managers.poolEmpty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pool.map((m) => (
              <ManagerRow
                key={m.id}
                m={m}
                rightLabel="Unemployed"
                onEdit={() => setEditing(m)}
                onDelete={() => setDeleting(m)}
              />
            ))}
          </div>
        )}
      </div>

      <ManagerFormModal
        open={creating || editing !== null}
        initial={editing}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {deleting ? (
        <ConfirmModal
          open={true}
          title={t('managers.deleteTitle')}
          confirmLabel={t('managers.delete')}
          variant="danger"
          body={t('managers.deleteWarning', { name: deleting.name })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteManager(deleting.id);
            setDeleting(null);
          }}
        />
      ) : null}

      {sackingTarget ? (
        <ConfirmModal
          open={true}
          title={t('managers.sackTitle')}
          confirmLabel={t('clubs.detail.sack')}
          variant="danger"
          body={t('managers.sackWarning', {
            name: sackingTarget.name,
            club: clubs.find((c) => c.id === sackingTarget.contractClubId)?.name ?? '—',
          })}
          onCancel={() => setSackingTarget(null)}
          onConfirm={() => {
            sackManager(sackingTarget.id);
            setSackingTarget(null);
          }}
        />
      ) : null}
    </>
  );
}

interface ManagerRowProps {
  m: Manager;
  rightLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onSack?: () => void;
}

function ManagerRow({ m, rightLabel, onEdit, onDelete, onSack }: ManagerRowProps) {
  return (
    <div className="list-row" style={{ cursor: 'default' }}>
      <div className="list-row__main">
        <div className="list-row__title">{m.name}</div>
        <div className="list-row__sub">
          {m.preferredFormation} · {t(`styles.${m.preferredStyle}`)} · {m.nationality || '—'} ·{' '}
          {m.age}y
        </div>
      </div>
      <div className="list-row__meta">
        <span className="text-dim" style={{ fontSize: 12 }}>
          {rightLabel}
        </span>
        <Button size="sm" onClick={onEdit}>
          {t('common.edit')}
        </Button>
        {onSack ? (
          <Button size="sm" variant="danger" onClick={onSack}>
            {t('clubs.detail.sack')}
          </Button>
        ) : null}
        <Button size="sm" variant="danger" onClick={onDelete}>
          {t('common.delete')}
        </Button>
      </div>
    </div>
  );
}
