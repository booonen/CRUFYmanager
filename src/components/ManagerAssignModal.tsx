import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { t } from '../lang';
import { assignManager } from '../stores/clubs';
import { useManagers } from '../stores/managers';
import { useSavefileStore } from '../stores/savefile';

interface ManagerAssignModalProps {
  open: boolean;
  clubId: string;
  currentManagerId: string | null;
  onClose: () => void;
}

export function ManagerAssignModal({
  open,
  clubId,
  currentManagerId,
  onClose,
}: ManagerAssignModalProps) {
  const managers = useManagers();
  const clubs = useSavefileStore((s) => s.savefile?.clubs ?? []);
  const [showAll, setShowAll] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(currentManagerId);

  const visible = showAll
    ? managers
    : managers.filter((m) => m.contractClubId === null || m.id === currentManagerId);

  const handleAssign = () => {
    if (!pickedId) return;
    assignManager(clubId, pickedId);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t('managers.assign.title')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!pickedId || pickedId === currentManagerId}
            onClick={handleAssign}
          >
            {t('managers.assign.pick')}
          </Button>
        </>
      }
    >
      <p className="text-dim" style={{ marginBottom: 12, fontSize: 13 }}>
        {t('managers.assign.body')}
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          <span className="text-dim">Show employed managers too</span>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="text-dim" style={{ fontSize: 13, padding: 16, textAlign: 'center' }}>
          {t('managers.assign.noChoices')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map((m) => {
            const employer =
              m.contractClubId && m.contractClubId !== clubId
                ? clubs.find((c) => c.id === m.contractClubId)?.name
                : null;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPickedId(m.id)}
                className={
                  pickedId === m.id ? 'list-row list-row--active' : 'list-row'
                }
                style={{ width: '100%', textAlign: 'left' }}
              >
                <div className="list-row__main">
                  <div className="list-row__title">{m.name}</div>
                  <div className="list-row__sub">
                    {m.preferredFormation} · {t(`styles.${m.preferredStyle}`)} ·{' '}
                    {employer ? `Employed by ${employer}` : 'Unemployed'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
