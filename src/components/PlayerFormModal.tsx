import { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';
import { OvrBadge } from './OvrBadge';
import { PersonalityPicker } from './PersonalityPicker';
import { PositionPicker } from './PositionPicker';
import { StatSlider } from './StatSlider';
import { t } from '../lang';
import type { DomesticPlayer, GameStat, PreferredFoot } from '../domain/player';
import { GK_GAME_STATS, OUTFIELD_GAME_STATS } from '../domain/player';
import { computeOvr, defaultStatBlock } from '../utils/ovr';
import {
  type PlayerFormInput,
  domesticPlayerToFormInput,
  newPlayerFormInput,
  nextSquadNumber,
} from '../utils/playerForm';
import { useSavefileStore } from '../stores/savefile';
import { isRealClub } from '../utils/freeAgents';
import { FREE_AGENTS_CLUB_ID } from '../domain/club';

interface PlayerFormModalProps {
  open: boolean;
  initial: DomesticPlayer | null;
  defaults?: PlayerFormInput;
  onCancel: () => void;
  onSubmit: (input: PlayerFormInput) => void | Promise<void>;
}

const FEET: PreferredFoot[] = ['L', 'R', 'Both'];

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

export function PlayerFormModal({
  open,
  initial,
  defaults,
  onCancel,
  onSubmit,
}: PlayerFormModalProps) {
  const calendar = useSavefileStore((s) => s.savefile?.calendar ?? null);
  const countryName = useSavefileStore((s) => s.savefile?.meta.countryName ?? '');
  const allClubs = useSavefileStore((s) => s.savefile?.clubs ?? []);
  const allPlayers = useSavefileStore((s) => s.savefile?.players ?? []);

  const [form, setForm] = useState<PlayerFormInput>(() =>
    makeInitial(initial, defaults, calendar, countryName),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(makeInitial(initial, defaults, calendar, countryName));
      setSubmitting(false);
    }
  }, [open, initial, defaults, calendar, countryName]);

  useEffect(() => {
    if (!open || !initial) return;
    const taken = allPlayers
      .filter((p) => p.tier === 'domestic' && p.clubId === form.clubId && p.id !== initial.id)
      .map((p) => (p.tier === 'domestic' ? p.squadNumber : null));
    if (form.squadNumber === null) {
      setForm((f) => ({ ...f, squadNumber: nextSquadNumber(taken) }));
    }
  }, [open, initial, allPlayers, form.clubId, form.squadNumber]);

  const ovr = useMemo(() => computeOvr(form.position, form.stats), [form.position, form.stats]);
  const isGK = form.position === 'GK';

  const canSubmit = form.name.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? t('players.edit') : t('players.new')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {initial ? t('common.save') : t('players.new')}
          </Button>
        </>
      }
    >
      <div className="form-section">
        <div className="form-section__heading">{t('players.sections.identity')}</div>
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('players.fields.name')}</label>
            <input
              className="input"
              value={form.name}
              autoFocus
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('players.fields.nationality')}</label>
            <input
              className="input"
              value={form.nationality}
              onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('players.fields.age')}</label>
            <NumberInput
              className="input mono"
              value={form.age}
              min={14}
              max={50}
              onCommit={(v) => setForm((f) => ({ ...f, age: v }))}
            />
            <div className="field__hint">{t('players.fields.ageHint')}</div>
          </div>
          <div className="field">
            <label className="field__label">{t('players.fields.preferredFoot')}</label>
            <div className="chip-row">
              {FEET.map((foot) => (
                <button
                  key={foot}
                  type="button"
                  className={form.preferredFoot === foot ? 'chip chip--active' : 'chip'}
                  onClick={() => setForm((f) => ({ ...f, preferredFoot: foot }))}
                >
                  {t(`feet.${foot}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="field">
          <label className="field__label">{t('players.fields.position')}</label>
          <PositionPicker
            value={form.position}
            onChange={(pos) => setForm((f) => ({ ...f, position: pos }))}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('players.fields.club')}</label>
          <select
            className="select"
            value={form.clubId}
            onChange={(e) => setForm((f) => ({ ...f, clubId: e.target.value, squadNumber: null }))}
          >
            <option value={FREE_AGENTS_CLUB_ID}>{t('clubs.freeAgents')}</option>
            {allClubs.filter(isRealClub).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <div className="form-section__heading">{t('players.sections.stats')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-dim mono" style={{ fontSize: 11 }}>
              {t('players.fields.ovr')}
            </span>
            <OvrBadge value={ovr} size="md" />
          </div>
        </div>
        <div className="form-grid">
          {OUTFIELD_GAME_STATS.map((stat) => (
            <StatSlider
              key={stat}
              label={STAT_LABELS[stat]}
              value={form.stats[stat]}
              onChange={(v) => setForm((f) => ({ ...f, stats: { ...f.stats, [stat]: v } }))}
            />
          ))}
        </div>

        <div className="form-section__heading" style={{ marginTop: 16 }}>
          {t('players.sections.gkStats')}
        </div>
        <div className="form-grid">
          {GK_GAME_STATS.map((stat) => (
            <StatSlider
              key={stat}
              label={STAT_LABELS[stat]}
              value={form.stats[stat]}
              disabled={!isGK}
              onChange={(v) => setForm((f) => ({ ...f, stats: { ...f.stats, [stat]: v } }))}
            />
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">{t('players.sections.hidden')}</div>
        <div className="field">
          <label className="field__label">{t('players.fields.personality')}</label>
          <PersonalityPicker
            values={form.personalities}
            min={1}
            max={3}
            onChange={(p) => setForm((f) => ({ ...f, personalities: p }))}
          />
        </div>
        <div className="form-grid">
          <StatSlider
            label={t('players.fields.consistency')}
            value={form.consistency}
            onChange={(v) => setForm((f) => ({ ...f, consistency: v }))}
          />
          <StatSlider
            label={t('players.fields.workRate')}
            value={form.workRate}
            onChange={(v) => setForm((f) => ({ ...f, workRate: v }))}
          />
          <StatSlider
            label={t('players.fields.injuryProneness')}
            value={form.injuryProneness}
            onChange={(v) => setForm((f) => ({ ...f, injuryProneness: v }))}
          />
          <StatSlider
            label={t('players.fields.potential')}
            value={form.potential}
            onChange={(v) => setForm((f) => ({ ...f, potential: v }))}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">{t('players.sections.contract')}</div>
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('players.fields.contractUntil')}</label>
            <NumberInput
              className="input mono"
              value={form.contractUntilSeason}
              onCommit={(v) => setForm((f) => ({ ...f, contractUntilSeason: v }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('players.fields.squadNumber')}</label>
            <NumberInput
              className="input mono"
              min={1}
              max={99}
              value={form.squadNumber ?? 0}
              onCommit={(v) =>
                setForm((f) => ({ ...f, squadNumber: v === 0 ? null : v }))
              }
            />
            <div className="field__hint">{t('players.fields.squadNumberHint')}</div>
          </div>
          <StatSlider
            label={t('players.fields.currentForm')}
            value={form.currentForm}
            onChange={(v) => setForm((f) => ({ ...f, currentForm: v }))}
          />
          <StatSlider
            label={t('players.fields.currentMorale')}
            value={form.currentMorale}
            onChange={(v) => setForm((f) => ({ ...f, currentMorale: v }))}
          />
          <StatSlider
            label={t('players.fields.currentFitness')}
            value={form.currentFitness}
            onChange={(v) => setForm((f) => ({ ...f, currentFitness: v }))}
          />
        </div>
      </div>
    </Modal>
  );
}

function makeInitial(
  player: DomesticPlayer | null,
  defaults: PlayerFormInput | undefined,
  calendar: import('../domain/calendar').Calendar | null,
  countryName: string,
): PlayerFormInput {
  if (player && calendar) return domesticPlayerToFormInput(player, calendar);
  if (defaults) return defaults;
  if (calendar) {
    return newPlayerFormInput(calendar, FREE_AGENTS_CLUB_ID, { nationality: countryName });
  }
  return {
    name: '',
    nationality: countryName,
    position: 'MID-CM',
    preferredFoot: 'R',
    age: 22,
    clubId: FREE_AGENTS_CLUB_ID,
    contractUntilSeason: 4,
    squadNumber: null,
    stats: defaultStatBlock(),
    personalities: ['Professional'],
    consistency: 60,
    workRate: 60,
    injuryProneness: 30,
    potential: 70,
    currentForm: 60,
    currentMorale: 75,
    currentFitness: 100,
  };
}
