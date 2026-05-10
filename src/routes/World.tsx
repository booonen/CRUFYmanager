import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { ForeignClubFormModal } from '../components/ForeignClubFormModal';
import { ForeignLeagueFormModal } from '../components/ForeignLeagueFormModal';
import { OvrBadge } from '../components/OvrBadge';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';
import {
  type ForeignClubInput,
  type ForeignLeagueInput,
  addForeignClub,
  addForeignLeague,
  deleteForeignClub,
  deleteForeignLeague,
  updateForeignClub,
  updateForeignLeague,
  useForeignClubs,
  useForeignLeagues,
} from '../stores/foreignWorld';
import type { ForeignClub, ForeignLeague } from '../domain/foreignWorld';

type Tab = 'leagues' | 'clubs';

export function WorldRoute() {
  const status = useSavefileStore((s) => s.status);
  const leagues = useForeignLeagues();
  const clubs = useForeignClubs();

  const [tab, setTab] = useState<Tab>('leagues');

  const [creatingLeague, setCreatingLeague] = useState(false);
  const [editingLeague, setEditingLeague] = useState<ForeignLeague | null>(null);
  const [deletingLeague, setDeletingLeague] = useState<ForeignLeague | null>(null);

  const [creatingClub, setCreatingClub] = useState(false);
  const [editingClub, setEditingClub] = useState<ForeignClub | null>(null);
  const [deletingClub, setDeletingClub] = useState<ForeignClub | null>(null);

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

  const handleLeagueSubmit = async (input: ForeignLeagueInput) => {
    if (editingLeague) updateForeignLeague(editingLeague.id, input);
    else addForeignLeague(input);
    setEditingLeague(null);
    setCreatingLeague(false);
  };

  const handleClubSubmit = async (input: ForeignClubInput) => {
    if (editingClub) updateForeignClub(editingClub.id, input);
    else addForeignClub(input);
    setEditingClub(null);
    setCreatingClub(false);
  };

  return (
    <>
      <PageHeading
        title={t('world.title')}
        sub={t('world.sub')}
        actions={
          <Button
            variant="primary"
            onClick={() => (tab === 'leagues' ? setCreatingLeague(true) : setCreatingClub(true))}
            disabled={tab === 'clubs' && leagues.length === 0}
          >
            {tab === 'leagues' ? t('world.newLeague') : t('world.newClub')}
          </Button>
        }
      />

      <div className="filter-bar">
        <button
          type="button"
          className={tab === 'leagues' ? 'chip chip--active' : 'chip'}
          onClick={() => setTab('leagues')}
        >
          {t('world.leaguesTab')} ({leagues.length})
        </button>
        <button
          type="button"
          className={tab === 'clubs' ? 'chip chip--active' : 'chip'}
          onClick={() => setTab('clubs')}
        >
          {t('world.clubsTab')} ({clubs.length})
        </button>
      </div>

      {tab === 'leagues' ? (
        leagues.length === 0 ? (
          <EmptyState glyph="◌" title={t('world.empty.leagues')} />
        ) : (
          <div className="panel" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Tier</th>
                  <th>Clubs</th>
                  <th style={{ width: 1 }}></th>
                </tr>
              </thead>
              <tbody>
                {leagues.map((l) => {
                  const clubCount = clubs.filter((c) => c.leagueId === l.id).length;
                  return (
                    <tr key={l.id} onClick={() => setEditingLeague(l)}>
                      <td style={{ fontWeight: 500 }}>{l.name}</td>
                      <td className="text-dim">{l.countryName}</td>
                      <td className="mono">{l.tier}</td>
                      <td className="mono">{clubCount}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="danger" onClick={() => setDeletingLeague(l)}>
                          {t('common.delete')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'clubs' ? (
        clubs.length === 0 ? (
          <EmptyState glyph="◌" title={t('world.empty.clubs')} />
        ) : (
          <div className="panel" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>League</th>
                  <th>Country</th>
                  <th>OVR</th>
                  <th style={{ width: 1 }}></th>
                </tr>
              </thead>
              <tbody>
                {clubs.map((c) => (
                  <tr key={c.id} onClick={() => setEditingClub(c)}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td className="text-dim">{leagues.find((l) => l.id === c.leagueId)?.name ?? '—'}</td>
                    <td className="text-dim">{c.countryName}</td>
                    <td>
                      <OvrBadge value={c.ovr} size="sm" />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="danger" onClick={() => setDeletingClub(c)}>
                        {t('common.delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      <ForeignLeagueFormModal
        open={creatingLeague || editingLeague !== null}
        initial={editingLeague}
        onCancel={() => {
          setCreatingLeague(false);
          setEditingLeague(null);
        }}
        onSubmit={handleLeagueSubmit}
      />

      <ForeignClubFormModal
        open={creatingClub || editingClub !== null}
        initial={editingClub}
        leagues={leagues}
        onCancel={() => {
          setCreatingClub(false);
          setEditingClub(null);
        }}
        onSubmit={handleClubSubmit}
      />

      {deletingLeague ? (
        <ConfirmModal
          open={true}
          title={t('world.deleteLeagueTitle')}
          confirmLabel={t('world.deleteLeague')}
          variant="danger"
          body={t('world.deleteLeagueWarning', {
            name: deletingLeague.name,
            count: clubs.filter((c) => c.leagueId === deletingLeague.id).length,
          })}
          onCancel={() => setDeletingLeague(null)}
          onConfirm={() => {
            deleteForeignLeague(deletingLeague.id);
            setDeletingLeague(null);
          }}
        />
      ) : null}

      {deletingClub ? (
        <ConfirmModal
          open={true}
          title={t('world.deleteClubTitle')}
          confirmLabel={t('world.deleteClub')}
          variant="danger"
          body={t('world.deleteClubWarning', { name: deletingClub.name })}
          onCancel={() => setDeletingClub(null)}
          onConfirm={() => {
            deleteForeignClub(deletingClub.id);
            setDeletingClub(null);
          }}
        />
      ) : null}
    </>
  );
}
