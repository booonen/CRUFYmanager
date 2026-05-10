import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';
import {
  type ClubInput,
  addClub,
  deleteClub,
  updateClub,
  useClub,
  useClubs,
} from '../stores/clubs';
import { useManagers } from '../stores/managers';
import { usePlayersForClub } from '../stores/players';
import { ClubFormModal } from '../components/ClubFormModal';
import { ClubDetail } from '../components/ClubDetail';
import { isFreeAgentsClub, isRealClub } from '../utils/freeAgents';
import type { Club } from '../domain/club';
import { OvrBadge } from '../components/OvrBadge';

export function ClubsRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);
  const allClubs = useClubs();
  const managers = useManagers();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useClub(selectedId);
  const selectedSquad = usePlayersForClub(selectedId);

  const [editing, setEditing] = useState<Club | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Club | null>(null);
  const [search, setSearch] = useState('');

  const realClubs = useMemo(() => allClubs.filter(isRealClub), [allClubs]);
  const freeAgents = allClubs.find(isFreeAgentsClub) ?? null;

  const filteredReal = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return realClubs;
    return realClubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q),
    );
  }, [realClubs, search]);

  useEffect(() => {
    if (selectedId && !allClubs.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    }
  }, [allClubs, selectedId]);

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

  const handleSubmit = async (input: ClubInput) => {
    if (editing) {
      updateClub(editing.id, input);
    } else {
      const id = addClub(input);
      setSelectedId(id);
    }
    setEditing(null);
    setCreating(false);
  };

  return (
    <>
      <PageHeading
        title={t('clubs.title')}
        sub={t('clubs.sub', { country: savefile.meta.countryName })}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t('clubs.new')}
          </Button>
        }
      />

      <div className="two-pane">
        <div className="two-pane__list">
          <div className="filter-bar">
            <input
              className="input"
              placeholder={t('players.filters.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
          </div>

          {realClubs.length === 0 ? (
            <EmptyState
              glyph="◎"
              title={t('clubs.empty.title')}
              body={t('clubs.empty.body')}
              action={
                <Button variant="primary" onClick={() => setCreating(true)}>
                  {t('clubs.new')}
                </Button>
              }
            />
          ) : (
            filteredReal.map((c) => (
              <ClubListRow
                key={c.id}
                club={c}
                managerName={managers.find((m) => m.id === c.managerId)?.name ?? null}
                squadSize={c.squadPlayerIds.length}
                active={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
              />
            ))
          )}

          {freeAgents ? (
            <ClubListRow
              club={freeAgents}
              managerName={null}
              squadSize={freeAgents.squadPlayerIds.length}
              active={freeAgents.id === selectedId}
              onClick={() => setSelectedId(freeAgents.id)}
              isFreeAgents
            />
          ) : null}
        </div>

        <div className="two-pane__detail">
          {selected ? (
            <ClubDetail
              club={selected}
              squad={selectedSquad}
              onEdit={() => setEditing(selected)}
              onDelete={() => setDeleting(selected)}
            />
          ) : (
            <div className="panel">
              <div className="text-dim" style={{ textAlign: 'center', padding: 32 }}>
                Select a club from the list, or create a new one.
              </div>
            </div>
          )}
        </div>
      </div>

      <ClubFormModal
        open={creating || editing !== null}
        initial={editing ?? null}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {deleting ? (
        <ConfirmModal
          open={true}
          title={t('clubs.deleteTitle')}
          variant="danger"
          confirmLabel={t('clubs.delete')}
          body={t('clubs.deleteWarning', {
            name: deleting.name,
            count: deleting.squadPlayerIds.length,
          })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteClub(deleting.id);
            if (selectedId === deleting.id) setSelectedId(null);
            setDeleting(null);
          }}
        />
      ) : null}
    </>
  );
}

interface ClubListRowProps {
  club: Club;
  managerName: string | null;
  squadSize: number;
  active: boolean;
  isFreeAgents?: boolean;
  onClick: () => void;
}

function ClubListRow({
  club,
  managerName,
  squadSize,
  active,
  isFreeAgents,
  onClick,
}: ClubListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'list-row list-row--active' : 'list-row'}
      style={{ width: '100%', textAlign: 'left' }}
    >
      <span className="kit-swatches">
        <span style={{ background: club.colors.primary }} />
        <span style={{ background: club.colors.secondary }} />
      </span>
      <div className="list-row__main">
        <div className="list-row__title">{club.name}</div>
        <div className="list-row__sub">
          {isFreeAgents
            ? `${squadSize} player${squadSize === 1 ? '' : 's'}`
            : `${club.shortName || '—'} · ${club.city || '—'} · ${managerName ?? t('clubs.detail.noManager')}`}
        </div>
      </div>
      <div className="list-row__meta">
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {squadSize}
        </span>
        {!isFreeAgents ? <OvrBadge value={club.ovr} size="sm" /> : null}
      </div>
    </button>
  );
}
