import { useEffect, useState } from 'react';
import type { Savefile } from '../domain/savefile';
import type { SportEvent } from '../domain/spine';
import { t } from '../lang';
import { entryDisplay } from '../utils/participants';
import { Button } from './Button';
import { Modal } from './Modal';

interface ManualTieOrderModalProps {
  open: boolean;
  sf: Savefile;
  event: SportEvent;
  tiedEntryIds: string[];
  onCancel: () => void;
  onApply: (ordered: string[]) => void;
}

export function ManualTieOrderModal({
  open,
  sf,
  event,
  tiedEntryIds,
  onCancel,
  onApply,
}: ManualTieOrderModalProps) {
  const [order, setOrder] = useState<string[]>(tiedEntryIds);

  useEffect(() => {
    if (open) setOrder(tiedEntryIds);
  }, [open, tiedEntryIds]);

  const move = (index: number, delta: number) => {
    setOrder((current) => {
      const next = [...current];
      const j = index + delta;
      const a = next[index];
      const b = next[j];
      if (a === undefined || b === undefined) return current;
      next[index] = b;
      next[j] = a;
      return next;
    });
  };

  return (
    <Modal
      open={open}
      title={t('competitions.cockpit.tieOrderTitle')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => onApply(order)}>
            {t('competitions.cockpit.applyOrder')}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>{t('competitions.cockpit.tieOrderBody')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {order.map((entryId, i) => {
          const d = entryDisplay(sf, event, entryId);
          return (
            <div key={entryId} className="list-row">
              <span className="mono" style={{ width: 20, fontSize: 12 }}>
                {i + 1}.
              </span>
              <div className="list-row__main">
                <div className="list-row__title">{d.name}</div>
              </div>
              <Button size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('competitions.cockpit.moveUp')}>
                ↑
              </Button>
              <Button
                size="sm"
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
                aria-label={t('competitions.cockpit.moveDown')}
              >
                ↓
              </Button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
