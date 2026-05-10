import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { ClubLogo } from './ClubLogo';
import { ConfirmModal } from './ConfirmModal';
import { GenerateSquadModal } from './GenerateSquadModal';
import { ManagerAssignModal } from './ManagerAssignModal';
import { OvrBadge } from './OvrBadge';
import { PositionPill } from './PositionPill';
import { PlayerFormModal } from './PlayerFormModal';
import { t } from '../lang';
import type { Club } from '../domain/club';
import { displayName, type DomesticPlayer } from '../domain/player';
import { isFreeAgentsClub } from '../utils/freeAgents';
import { computeAge } from '../utils/age';
import { useSavefileStore } from '../stores/savefile';
import { unassignManager } from '../stores/clubs';
import { addDomesticPlayer } from '../stores/players';
import { useManager } from '../stores/managers';
import { newPlayerFormInput } from '../utils/playerForm';

interface ClubDetailProps {
  club: Club;
  squad: DomesticPlayer[];
  onEdit: () => void;
  onDelete: () => void;
}

export function ClubDetail({ club, squad, onEdit, onDelete }: ClubDetailProps) {
  const navigate = useNavigate();
  const calendar = useSavefileStore((s) => s.savefile?.calendar ?? null);
  const countryName = useSavefileStore((s) => s.savefile?.meta.countryName ?? '');
  const manager = useManager(club.managerId);
  const isFreeAgents = isFreeAgentsClub(club);
  const [assigningManager, setAssigningManager] = useState(false);
  const [sacking, setSacking] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [generatingSquad, setGeneratingSquad] = useState(false);

  if (!calendar) return null;

  const sortedSquad = [...squad].sort((a, b) => {
    const an = a.squadNumber ?? 999;
    const bn = b.squadNumber ?? 999;
    if (an !== bn) return an - bn;
    return b.stats.ovr - a.stats.ovr;
  });

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <ClubLogo
          logoUrl={club.logoUrl}
          primary={club.colors.primary}
          secondary={club.colors.secondary}
          size="lg"
          alt={club.name}
        />
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: 2 }}>{club.name}</h2>
          <div className="text-dim" style={{ fontSize: 13 }}>
            {isFreeAgents ? t('clubs.freeAgentsBody') : `${club.shortName} · ${club.city || '—'}`}
          </div>
        </div>
        {!isFreeAgents ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={onEdit}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="danger" onClick={onDelete}>
              {t('common.delete')}
            </Button>
          </div>
        ) : null}
      </div>

      {!isFreeAgents ? (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <Stat label={t('clubs.detail.ovr')} value={club.ovr} />
          <Stat label={t('clubs.detail.squad')} value={squad.length} />
          <Stat label={t('clubs.detail.capacity')} value={club.stadium.capacity.toLocaleString()} />
          <Stat label={t('clubs.detail.founded')} value={club.founded} />
        </div>
      ) : null}

      {!isFreeAgents ? (
        <div className="form-section" style={{ marginBottom: 20 }}>
          <div className="form-section__heading">{t('clubs.detail.manager')}</div>
          {manager ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{manager.name}</div>
                <div className="text-dim mono" style={{ fontSize: 11 }}>
                  {manager.preferredFormation} · {t(`styles.${manager.preferredStyle}`)} ·{' '}
                  {manager.nationality || '—'}
                </div>
              </div>
              <Button size="sm" onClick={() => setAssigningManager(true)}>
                {t('clubs.detail.assign')}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setSacking(true)}>
                {t('clubs.detail.sack')}
              </Button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius)',
              }}
            >
              <div className="text-dim" style={{ flex: 1 }}>
                {t('clubs.detail.noManager')}
              </div>
              <Button size="sm" variant="primary" onClick={() => setAssigningManager(true)}>
                {t('clubs.detail.assign')}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <div className="form-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div className="form-section__heading">
            {t('clubs.detail.squad')} ({sortedSquad.length})
          </div>
          {!isFreeAgents ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={() => setGeneratingSquad(true)}>
                {t('generateSquad.button')}
              </Button>
              <Button size="sm" onClick={() => setAddingPlayer(true)}>
                {t('clubs.detail.addPlayer')}
              </Button>
            </div>
          ) : null}
        </div>

        {sortedSquad.length === 0 ? (
          <div className="text-dim" style={{ padding: 16, fontSize: 13 }}>
            {t('clubs.detail.squadEmpty')}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Name</th>
                <th>Pos</th>
                <th>Age</th>
                <th>OVR</th>
              </tr>
            </thead>
            <tbody>
              {sortedSquad.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/players/${p.id}`)}>
                  <td className="mono text-dim">{p.squadNumber ?? '—'}</td>
                  <td>{displayName(p)}</td>
                  <td>
                    <PositionPill position={p.position} />
                  </td>
                  <td className="mono">{computeAge(p.dateOfBirth, calendar)}</td>
                  <td>
                    <OvrBadge value={p.stats.ovr} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ManagerAssignModal
        open={assigningManager}
        clubId={club.id}
        currentManagerId={club.managerId}
        onClose={() => setAssigningManager(false)}
      />

      {sacking && manager ? (
        <ConfirmModal
          open={true}
          title={t('managers.sackTitle')}
          variant="danger"
          confirmLabel={t('clubs.detail.sack')}
          body={t('managers.sackWarning', { name: manager.name, club: club.name })}
          onCancel={() => setSacking(false)}
          onConfirm={() => {
            unassignManager(club.id);
            setSacking(false);
          }}
        />
      ) : null}

      <GenerateSquadModal
        open={generatingSquad}
        club={club}
        onClose={() => setGeneratingSquad(false)}
      />

      <PlayerFormModal
        open={addingPlayer}
        initial={null}
        defaults={
          isFreeAgents
            ? undefined
            : newPlayerFormInput(calendar, club.id, { nationality: countryName })
        }
        onCancel={() => setAddingPlayer(false)}
        onSubmit={async (input) => {
          addDomesticPlayer(input);
          setAddingPlayer(false);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}
