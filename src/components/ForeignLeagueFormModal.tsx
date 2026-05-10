import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { t } from '../lang';
import type { ForeignLeague } from '../domain/foreignWorld';
import type { ForeignLeagueInput } from '../stores/foreignWorld';

interface ForeignLeagueFormModalProps {
  open: boolean;
  initial: ForeignLeague | null;
  onCancel: () => void;
  onSubmit: (input: ForeignLeagueInput) => void | Promise<void>;
}

const blank = (): ForeignLeagueInput => ({ name: '', countryName: '', tier: 1 });

export function ForeignLeagueFormModal({
  open,
  initial,
  onCancel,
  onSubmit,
}: ForeignLeagueFormModalProps) {
  const [form, setForm] = useState<ForeignLeagueInput>(blank);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { name: initial.name, countryName: initial.countryName, tier: initial.tier } : blank());
      setSubmitting(false);
    }
  }, [open, initial]);

  const canSubmit =
    form.name.trim().length > 0 && form.countryName.trim().length > 0 && form.tier >= 1 && !submitting;

  return (
    <Modal
      open={open}
      title={initial ? t('world.fields.leagueName') : t('world.newLeague')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit(form);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {initial ? t('common.save') : t('world.newLeague')}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label className="field__label">{t('world.fields.leagueName')}</label>
          <input
            className="input"
            value={form.name}
            autoFocus
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('world.fields.countryName')}</label>
          <input
            className="input"
            value={form.countryName}
            onChange={(e) => setForm((f) => ({ ...f, countryName: e.target.value }))}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('world.fields.tier')}</label>
          <input
            type="number"
            className="input mono"
            min={1}
            value={form.tier}
            onChange={(e) =>
              setForm((f) => ({ ...f, tier: Math.max(1, Number(e.target.value) || 1) }))
            }
          />
          <div className="field__hint">{t('world.fields.tierHint')}</div>
        </div>
      </div>
    </Modal>
  );
}
