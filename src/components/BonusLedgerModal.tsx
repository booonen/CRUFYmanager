import { useState } from 'react';
import type { Entry } from '../domain/spine';
import type { EventRef } from '../engine/mutate';
import { t } from '../lang';
import { removeBonusAction, upsertBonusAction } from '../stores/competitions';
import { Button } from './Button';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';

interface BonusLedgerModalProps {
  open: boolean;
  entry: Entry | null;
  entryName: string;
  eventRef: EventRef;
  matchdaysPerSeason: number;
  onClose: () => void;
}

export function BonusLedgerModal({
  open,
  entry,
  entryName,
  eventRef,
  matchdaysPerSeason,
  onClose,
}: BonusLedgerModalProps) {
  const [newMd, setNewMd] = useState(1);
  const [newValue, setNewValue] = useState(0);

  if (!entry) return null;
  const sorted = [...entry.bonus].sort((a, b) => (a.matchday ?? -1) - (b.matchday ?? -1));

  return (
    <Modal
      open={open}
      title={t('competitions.cockpit.ledgerTitle', { name: entryName })}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>{t('competitions.cockpit.ledgerMd')}</th>
            <th>{t('competitions.cockpit.ledgerValue')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => (
            <tr key={b.id}>
              <td className="mono">{b.matchday ?? t('competitions.cockpit.ledgerBaseline')}</td>
              <td className="mono">{b.value}</td>
              <td style={{ textAlign: 'right' }}>
                <Button size="sm" onClick={() => removeBonusAction(eventRef, entry.id, b.id)}>
                  ×
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label">{t('competitions.cockpit.ledgerMd')}</label>
          <NumberInput className="input" style={{ width: 70 }} value={newMd} min={1} max={matchdaysPerSeason} onCommit={setNewMd} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label">{t('competitions.cockpit.ledgerValue')}</label>
          <NumberInput
            className="input"
            style={{ width: 90 }}
            value={newValue}
            min={-9999}
            max={9999}
            step={0.01}
            allowFloat
            onCommit={setNewValue}
          />
        </div>
        <Button
          onClick={() => upsertBonusAction(eventRef, entry.id, { matchday: newMd, value: newValue, note: '' })}
        >
          {t('competitions.cockpit.ledgerAdd')}
        </Button>
      </div>
    </Modal>
  );
}
