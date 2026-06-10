import { useEffect, useState } from 'react';
import { t } from '../lang';
import { Button } from './Button';
import { Modal } from './Modal';

interface UnlockResultModalProps {
  open: boolean;
  fixtureLabel: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}

export function UnlockResultModal({ open, fixtureLabel, onCancel, onConfirm }: UnlockResultModalProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  return (
    <Modal
      open={open}
      title={t('competitions.cockpit.unlockTitle')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="danger" disabled={note.trim().length === 0} onClick={() => onConfirm(note)}>
            {t('competitions.cockpit.unlockConfirm')}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>
        {t('competitions.cockpit.unlockBody', { fixture: fixtureLabel })}
      </p>
      <div className="field">
        <label className="field__label">{t('competitions.cockpit.unlockNote')}</label>
        <input
          className="input"
          autoFocus
          value={note}
          placeholder={t('competitions.cockpit.unlockNotePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}
