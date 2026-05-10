import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { OvrBadge } from '../components/OvrBadge';
import { PageHeading } from '../components/PageHeading';
import { PlayerFormModal } from '../components/PlayerFormModal';
import { PositionPill } from '../components/PositionPill';
import { t } from '../lang';
import {
  PERSONALITY_TAGS,
  POSITIONS,
  type DomesticPlayer,
  type PersonalityTag,
  type Position,
} from '../domain/player';
import { addDomesticPlayer, deletePlayer, updateDomesticPlayer, useDomesticPlayers } from '../stores/players';
import { useClubs } from '../stores/clubs';
import { useSavefileStore } from '../stores/savefile';
import { computeAge } from '../utils/age';
import { isRealClub } from '../utils/freeAgents';
import { FREE_AGENTS_CLUB_ID } from '../domain/club';

type SortKey = 'ovrDesc' | 'ovrAsc' | 'nameAsc' | 'ageAsc' | 'ageDesc';

export function PlayersRoute() {
  const status = useSavefileStore((s) => s.status);
  const calendar = useSavefileStore((s) => s.savefile?.calendar ?? null);
  const players = useDomesticPlayers();
  const clubs = useClubs();

  const [search, setSearch] = useState('');
  const [clubFilter, setClubFilter] = useState<string>('');
  const [posFilter, setPosFilter] = useState<Position | ''>('');
  const [personalityFilter, setPersonalityFilter] = useState<PersonalityTag | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('ovrDesc');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DomesticPlayer | null>(null);
  const [deleting, setDeleting] = useState<DomesticPlayer | null>(null);

  const filtered = useMemo(() => {
    if (!calendar) return [];
    const q = search.trim().toLowerCase();
    let result = players.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (clubFilter && p.clubId !== clubFilter) return false;
      if (posFilter && p.position !== posFilter) return false;
      if (personalityFilter && p.stats.personality !== personalityFilter) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case 'ovrAsc':
          return a.stats.ovr - b.stats.ovr;
        case 'ovrDesc':
          return b.stats.ovr - a.stats.ovr;
        case 'nameAsc':
          return a.name.localeCompare(b.name);
        case 'ageAsc':
          return computeAge(a.dateOfBirth, calendar) - computeAge(b.dateOfBirth, calendar);
        case 'ageDesc':
          return computeAge(b.dateOfBirth, calendar) - computeAge(a.dateOfBirth, calendar);
      }
    });
    return result;
  }, [players, search, clubFilter, posFilter, personalityFilter, sortKey, calendar]);

  useEffect(() => {
    if (editing && !players.some((p) => p.id === editing.id)) setEditing(null);
    if (deleting && !players.some((p) => p.id === deleting.id)) setDeleting(null);
  }, [players, editing, deleting]);

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

  const realClubs = clubs.filter(isRealClub);

  return (
    <>
      <PageHeading
        title={t('players.title')}
        sub={t('players.sub')}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t('players.new')}
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
        <select
          className="select"
          value={clubFilter}
          onChange={(e) => setClubFilter(e.target.value)}
        >
          <option value="">{t('players.filters.anyClub')}</option>
          <option value={FREE_AGENTS_CLUB_ID}>{t('clubs.freeAgents')}</option>
          {realClubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value as Position | '')}
        >
          <option value="">{t('players.filters.anyPosition')}</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={personalityFilter}
          onChange={(e) => setPersonalityFilter(e.target.value as PersonalityTag | '')}
        >
          <option value="">{t('players.filters.anyPersonality')}</option>
          {PERSONALITY_TAGS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="ovrDesc">{t('players.filters.sort.ovrDesc')}</option>
          <option value="ovrAsc">{t('players.filters.sort.ovrAsc')}</option>
          <option value="nameAsc">{t('players.filters.sort.nameAsc')}</option>
          <option value="ageAsc">{t('players.filters.sort.ageAsc')}</option>
          <option value="ageDesc">{t('players.filters.sort.ageDesc')}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          glyph="◐"
          title={players.length === 0 ? t('players.empty.title') : 'No matches'}
          body={players.length === 0 ? t('players.empty.body') : undefined}
          action={
            players.length === 0 ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                {t('players.new')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>Age</th>
                <th>OVR</th>
                <th>Club</th>
                <th>Personality</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const club = clubs.find((c) => c.id === p.clubId);
                return (
                  <tr key={p.id} onClick={() => setEditing(p)}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>
                      <PositionPill position={p.position} />
                    </td>
                    <td className="mono">{computeAge(p.dateOfBirth, calendar)}</td>
                    <td>
                      <OvrBadge value={p.stats.ovr} size="sm" />
                    </td>
                    <td className="text-dim">{club?.name ?? '—'}</td>
                    <td className="text-dim" style={{ fontSize: 12 }}>
                      {p.stats.personality}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleting(p)}
                      >
                        {t('common.delete')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PlayerFormModal
        open={creating || editing !== null}
        initial={editing}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={async (input) => {
          if (editing) {
            updateDomesticPlayer(editing.id, input);
          } else {
            addDomesticPlayer(input);
          }
          setCreating(false);
          setEditing(null);
        }}
      />

      {deleting ? (
        <ConfirmModal
          open={true}
          title={t('players.deleteTitle')}
          confirmLabel={t('players.delete')}
          variant="danger"
          body={t('players.deleteWarning', { name: deleting.name })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deletePlayer(deleting.id);
            setDeleting(null);
          }}
        />
      ) : null}
    </>
  );
}
