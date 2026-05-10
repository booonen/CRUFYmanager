import { useEffect, useState } from 'react';
import { Button } from './Button';
import { FormationPicker } from './FormationPicker';
import { Modal } from './Modal';
import { StatSlider } from './StatSlider';
import { TacticalProfilePicker } from './TacticalProfilePicker';
import { t } from '../lang';
import type { Manager, ManagerStats } from '../domain/manager';
import type { ManagerInput } from '../stores/managers';
import { defaultManagerStats } from '../stores/managers';

interface ManagerFormModalProps {
  open: boolean;
  initial: Manager | null;
  onCancel: () => void;
  onSubmit: (input: ManagerInput) => void | Promise<void>;
}

const blankInput = (): ManagerInput => ({
  name: '',
  nationality: '',
  age: 45,
  stats: defaultManagerStats(),
  preferredFormation: '4-3-3',
  preferredStyle: 'balanced',
});

const fromManager = (m: Manager): ManagerInput => ({
  name: m.name,
  nationality: m.nationality,
  age: m.age,
  stats: { ...m.stats },
  preferredFormation: m.preferredFormation,
  preferredStyle: m.preferredStyle,
});

export function ManagerFormModal({ open, initial, onCancel, onSubmit }: ManagerFormModalProps) {
  const [form, setForm] = useState<ManagerInput>(blankInput);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? fromManager(initial) : blankInput());
      setSubmitting(false);
    }
  }, [open, initial]);

  const canSubmit = form.name.trim().length > 0 && form.age >= 18 && form.age <= 90 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  const setStat = (key: keyof ManagerStats, value: number) => {
    setForm((f) => ({ ...f, stats: { ...f.stats, [key]: value } }));
  };

  return (
    <Modal
      open={open}
      title={initial ? t('managers.edit') : t('managers.new')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {initial ? t('common.save') : t('managers.new')}
          </Button>
        </>
      }
    >
      <div className="form-section">
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('managers.fields.name')}</label>
            <input
              className="input"
              value={form.name}
              autoFocus
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('managers.fields.nationality')}</label>
            <input
              className="input"
              value={form.nationality}
              onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('managers.fields.age')}</label>
            <input
              type="number"
              className="input mono"
              min={18}
              max={90}
              value={form.age}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  age: Math.max(18, Math.min(90, Number(e.target.value) || 18)),
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('managers.fields.formation')}</label>
            <FormationPicker
              value={form.preferredFormation}
              onChange={(v) => setForm((f) => ({ ...f, preferredFormation: v }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('managers.fields.style')}</label>
            <TacticalProfilePicker
              value={form.preferredStyle}
              onChange={(v) => setForm((f) => ({ ...f, preferredStyle: v }))}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-grid">
          <StatSlider
            label={t('managers.fields.tactical')}
            value={form.stats.tactical}
            onChange={(v) => setStat('tactical', v)}
          />
          <StatSlider
            label={t('managers.fields.motivation')}
            value={form.stats.motivation}
            onChange={(v) => setStat('motivation', v)}
          />
          <StatSlider
            label={t('managers.fields.development')}
            value={form.stats.development}
            onChange={(v) => setStat('development', v)}
          />
          <StatSlider
            label={t('managers.fields.discipline')}
            value={form.stats.discipline}
            onChange={(v) => setStat('discipline', v)}
          />
          <StatSlider
            label={t('managers.fields.adaptability')}
            value={form.stats.adaptability}
            onChange={(v) => setStat('adaptability', v)}
          />
        </div>
      </div>
    </Modal>
  );
}
