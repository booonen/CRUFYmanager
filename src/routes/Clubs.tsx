import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { ClubFormModal } from '../components/ClubFormModal';
import { ClubLogo } from '../components/ClubLogo';
import { EmptyState } from '../components/EmptyState';
import { OvrBadge } from '../components/OvrBadge';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { type ClubInput, addClub, useClubs } from '../stores/clubs';
import { useManagers } from '../stores/managers';
import { useSavefileStore } from '../stores/savefile';
import { isFreeAgentsClub, isRealClub } from '../utils/freeAgents';
import type { Club } from '../domain/club';

export function ClubsRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);
  const allClubs = useClubs();
  const managers = useManagers();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
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
    // no-op kept to mirror Players list pattern
  }, [allClubs]);

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

  const handleCreate = async (input: ClubInput) => {
    const id = addClub(input);
    setCreating(false);
    navigate(`/clubs/${id}`);
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

      <div className="filter-bar">
        <input
          className="input"
          placeholder={t('players.filters.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredReal.map((c) => (
            <ClubListRow
              key={c.id}
              club={c}
              managerName={managers.find((m) => m.id === c.managerId)?.name ?? null}
              squadSize={c.squadPlayerIds.length}
              onClick={() => navigate(`/clubs/${c.id}`)}
            />
          ))}

          {freeAgents ? (
            <ClubListRow
              club={freeAgents}
              managerName={null}
              squadSize={freeAgents.squadPlayerIds.length}
              onClick={() => navigate(`/clubs/${freeAgents.id}`)}
              isFreeAgents
            />
          ) : null}
        </div>
      )}

      <ClubFormModal
        open={creating}
        initial={null}
        onCancel={() => setCreating(false)}
        onSubmit={handleCreate}
      />
    </>
  );
}

interface ClubListRowProps {
  club: Club;
  managerName: string | null;
  squadSize: number;
  isFreeAgents?: boolean;
  onClick: () => void;
}

function ClubListRow({
  club,
  managerName,
  squadSize,
  isFreeAgents,
  onClick,
}: ClubListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="list-row"
      style={{ width: '100%', textAlign: 'left' }}
    >
      <ClubLogo
        logoUrl={club.logoUrl}
        primary={club.colors.primary}
        secondary={club.colors.secondary}
        size="md"
        alt={club.name}
      />
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
