import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';
import { t } from '../lang';
import type { ForeignClub, ForeignLeague } from '../domain/foreignWorld';
import type { ForeignClubInput } from '../stores/foreignWorld';

interface ForeignClubFormModalProps {
  open: boolean;
  initial: ForeignClub | null;
  leagues: ForeignLeague[];
  onCancel: () => void;
  onSubmit: (input: ForeignClubInput) => void | Promise<void>;
}

const blank = (leagueId: string, countryName: string): ForeignClubInput => ({
  name: '',
  leagueId,
  countryName,
  ovr: 70,
  logoUrl: null,
});

export function ForeignClubFormModal({
  open,
  initial,
  leagues,
  onCancel,
  onSubmit,
}: ForeignClubFormModalProps) {
  const fallbackLeague = leagues[0];
  const [form, setForm] = useState<ForeignClubInput>(() =>
    blank(fallbackLeague?.id ?? '', fallbackLeague?.countryName ?? ''),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name,
          leagueId: initial.leagueId,
          countryName: initial.countryName,
          ovr: initial.ovr,
          logoUrl: initial.logoUrl,
        });
      } else {
        setForm(blank(fallbackLeague?.id ?? '', fallbackLeague?.countryName ?? ''));
      }
      setSubmitting(false);
    }
  }, [open, initial, fallbackLeague]);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.leagueId.length > 0 &&
    form.ovr >= 0 &&
    form.ovr <= 100 &&
    !submitting;

  return (
    <Modal
      open={open}
      title={initial ? t('world.fields.clubName') : t('world.newClub')}
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
            {initial ? t('common.save') : t('world.newClub')}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label className="field__label">{t('world.fields.clubName')}</label>
          <input
            className="input"
            value={form.name}
            autoFocus
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('world.fields.league')}</label>
          <select
            className="select"
            value={form.leagueId}
            onChange={(e) => {
              const lg = leagues.find((l) => l.id === e.target.value);
              setForm((f) => ({
                ...f,
                leagueId: e.target.value,
                countryName: lg?.countryName ?? f.countryName,
              }));
            }}
          >
            {leagues.length === 0 ? <option value="">No leagues</option> : null}
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.countryName})
              </option>
            ))}
          </select>
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
          <label className="field__label">{t('world.fields.ovr')}</label>
          <NumberInput
            min={0}
            max={100}
            className="input mono"
            value={form.ovr}
            onCommit={(v) => setForm((f) => ({ ...f, ovr: v }))}
          />
          <div className="field__hint">{t('world.fields.ovrHint')}</div>
        </div>
      </div>
    </Modal>
  );
}
