import { useEffect, useState } from 'react';
import type { Savefile } from '../domain/savefile';
import type { SportEvent, Stage } from '../domain/spine';
import type { StageRef } from '../engine/mutate';
import { pottedDraw } from '../engine/generate';
import { orderEntriesBySeeding } from '../engine/qualification';
import { t } from '../lang';
import { applyGroups } from '../stores/competitions';
import { entryDisplay } from '../utils/participants';
import { Button } from './Button';
import { Modal } from './Modal';

interface GroupDrawModalProps {
  open: boolean;
  sf: Savefile;
  event: SportEvent;
  stage: Stage;
  stageRef: StageRef;
  onClose: () => void;
}

export function GroupDrawModal({ open, sf, event, stage, stageRef, onClose }: GroupDrawModalProps) {
  const [drawn, setDrawn] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDrawn(null);
      setError(null);
    }
  }, [open]);

  const groupCount = stage.groups.length;
  const ordered = orderEntriesBySeeding(event.entries);
  const pots: string[][] = [];
  for (let i = 0; i < ordered.length; i += groupCount) {
    pots.push(ordered.slice(i, i + groupCount).map((e) => e.id));
  }

  const doDraw = () => setDrawn(pottedDraw(event.entries, groupCount));

  const accept = () => {
    if (!drawn) return;
    const result = applyGroups(stageRef, drawn);
    if (result.ok) {
      onClose();
    } else {
      setError(result.message);
    }
  };

  const name = (id: string) => entryDisplay(sf, event, id).name;

  return (
    <Modal
      open={open}
      title={t('competitions.cockpit.drawTitle')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={doDraw}>{drawn ? t('competitions.cockpit.redraw') : t('competitions.cockpit.drawGroups')}</Button>
          <Button variant="primary" disabled={!drawn} onClick={accept}>
            {t('competitions.cockpit.acceptDraw')}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>{t('competitions.cockpit.drawBody')}</p>
      {error ? (
        <p className="mono" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
      {!drawn ? (
        <div className="standings-grid">
          {pots.map((pot, i) => (
            <div key={i} className="panel" style={{ padding: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('competitions.cockpit.pot', { n: i + 1 })}</div>
              {pot.map((id) => (
                <div key={id} style={{ fontSize: 13, padding: '2px 0' }}>
                  {name(id)}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="standings-grid">
          {drawn.map((group, i) => (
            <div key={i} className="panel" style={{ padding: 10, borderColor: 'var(--accent)' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {t('spine.group', { letter: String.fromCharCode(65 + i) })}
              </div>
              {group.map((id) => (
                <div key={id} style={{ fontSize: 13, padding: '2px 0' }}>
                  {name(id)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
