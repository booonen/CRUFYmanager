import { useEffect, useState } from 'react';
import { Button } from './Button';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { Modal } from './Modal';
import { t } from '../lang';
import type { Club } from '../domain/club';
import type { ClubInput } from '../stores/clubs';

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
  balance: number;
}

const blank: FormState = {
  name: '',
  shortName: '',
  city: '',
  founded: 1900,
  primary: '#d4a73c',
  secondary: '#1a1206',
  stadiumName: '',
  stadiumCapacity: 20000,
  balance: 0,
};

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
    balance: c.finances.balance,
  };
}

export function ClubFormModal({ open, initial, onCancel, onSubmit }: ClubFormModalProps) {
  const [form, setForm] = useState<FormState>(blank);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? fromClub(initial) : blank);
      setSubmitting(false);
    }
  }, [open, initial]);

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
        finances: { balance: form.balance },
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
            <input
              type="number"
              className="input mono"
              value={form.founded}
              onChange={(e) =>
                setForm((f) => ({ ...f, founded: Number(e.target.value) || 0 }))
              }
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
            <input
              type="number"
              className="input mono"
              value={form.stadiumCapacity}
              min={0}
              onChange={(e) =>
                setForm((f) => ({ ...f, stadiumCapacity: Math.max(0, Number(e.target.value) || 0) }))
              }
            />
          </div>
          <div className="field">
            <label className="field__label">{t('clubs.fields.balance')}</label>
            <input
              type="number"
              className="input mono"
              value={form.balance}
              onChange={(e) =>
                setForm((f) => ({ ...f, balance: Number(e.target.value) || 0 }))
              }
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
