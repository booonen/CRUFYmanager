import type { Savefile } from '../domain/savefile';
import type { SportEvent } from '../domain/spine';
import { t } from '../lang';
import { entryDisplay } from '../utils/participants';
import { Button } from './Button';
import { Modal } from './Modal';

interface AssignSlotModalProps {
  open: boolean;
  sf: Savefile;
  event: SportEvent;
  onCancel: () => void;
  onAssign: (entryId: string | null) => void;
}

export function AssignSlotModal({ open, sf, event, onCancel, onAssign }: AssignSlotModalProps) {
  return (
    <Modal
      open={open}
      title={t('competitions.cockpit.assignTitle')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={() => onAssign(null)}>{t('competitions.cockpit.clearSlot')}</Button>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>{t('competitions.cockpit.assignBody')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
        {event.entries.map((entry) => {
          const d = entryDisplay(sf, event, entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              className="list-row"
              style={{ cursor: 'pointer', textAlign: 'left' }}
              onClick={() => onAssign(entry.id)}
            >
              <span className="mono" style={{ fontSize: 11, width: 42 }}>
                {d.code}
              </span>
              <div className="list-row__main">
                <div className="list-row__title">{d.name}</div>
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {entry.seeding.mode === 'rank' ? `#${entry.seeding.value}` : entry.seeding.value}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
