import { useEffect, useState } from 'react';
import { Button } from './Button';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';
import { t } from '../lang';
import type { Club } from '../domain/club';
import type { ClubInput } from '../stores/clubs';
import { useSavefileStore } from '../stores/savefile';

interface ClubFormModalProps {
  open: boolean;
  initial: Club | null;
  onCancel: () => void;
  onSubmit: (input: ClubInput) => void | Promise<void>;
}

interface FormState {
  name: string;
  shortName: string;
  city: string;
  founded: number;
  primary: string;
  secondary: string;
  stadiumName: string;
  stadiumCapacity: number;
}

function blankFor(currentSeason: number): FormState {
  return {
    name: '',
    shortName: '',
    city: '',
    founded: currentSeason,
    primary: '#d4a73c',
    secondary: '#1a1206',
    stadiumName: '',
    stadiumCapacity: 20000,
  };
}

function fromClub(c: Club): FormState {
  return {
    name: c.name,
    shortName: c.shortName,
    city: c.city,
    founded: c.founded,
    primary: c.colors.primary,
    secondary: c.colors.secondary,
    stadiumName: c.stadium.name,
    stadiumCapacity: c.stadium.capacity,
  };
}

export function ClubFormModal({ open, initial, onCancel, onSubmit }: ClubFormModalProps) {
  const currentSeason = useSavefileStore((s) => s.savefile?.calendar.currentSeason ?? 1);
  const [form, setForm] = useState<FormState>(() => blankFor(currentSeason));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? fromClub(initial) : blankFor(currentSeason));
      setSubmitting(false);
    }
  }, [open, initial, currentSeason]);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.shortName.trim().length > 0 &&
    Number.isFinite(form.founded) &&
    form.stadiumCapacity >= 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
        shortName: form.shortName,
        city: form.city,
        founded: form.founded,
        colors: { primary: form.primary, secondary: form.secondary },
        stadium: { name: form.stadiumName.trim(), capacity: form.stadiumCapacity },
        finances: { balance: initial?.finances.balance ?? 0 },
        managerId: initial?.managerId ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? t('clubs.edit') : t('clubs.new')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {initial ? t('common.save') : t('clubs.new')}
          </Button>
        </>
      }
    >
      <div className="form-section">
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('clubs.fields.name')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field__label">{t('clubs.fields.shortName')}</label>
            <input
              className="input mono"
              value={form.shortName}
              maxLength={6}
              onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
            />
            <div className="field__hint">{t('clubs.fields.shortNameHint')}</div>
          </div>
          <div className="field">
            <label className="field__label">{t('clubs.fields.city')}</label>
            <input
              className="input"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('clubs.fields.founded')}</label>
            <NumberInput
              className="input mono"
              value={form.founded}
              onCommit={(v) => setForm((f) => ({ ...f, founded: v }))}
            />
            <div className="field__hint">{t('clubs.fields.foundedHint')}</div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">{t('clubs.fields.colors')}</div>
        <ColorSwatchPicker
          primary={form.primary}
          secondary={form.secondary}
          onChange={({ primary, secondary }) =>
            setForm((f) => ({ ...f, primary, secondary }))
          }
        />
      </div>

      <div className="form-section">
        <div className="form-section__heading">{t('clubs.detail.stadium')}</div>
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('clubs.fields.stadiumName')}</label>
            <input
              className="input"
              value={form.stadiumName}
              onChange={(e) => setForm((f) => ({ ...f, stadiumName: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('clubs.fields.stadiumCapacity')}</label>
            <NumberInput
              className="input mono"
              value={form.stadiumCapacity}
              min={0}
              onCommit={(v) => setForm((f) => ({ ...f, stadiumCapacity: v }))}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
