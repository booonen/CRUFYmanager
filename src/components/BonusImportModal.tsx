import { useEffect, useMemo, useState } from 'react';
import type { Savefile } from '../domain/savefile';
import type { SportEvent } from '../domain/spine';
import type { EventRef } from '../engine/mutate';
import { t } from '../lang';
import { importBonusAction } from '../stores/competitions';
import { entryDisplay } from '../utils/participants';
import { Button } from './Button';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';

interface BonusImportModalProps {
  open: boolean;
  sf: Savefile;
  event: SportEvent;
  eventRef: EventRef;
  onClose: () => void;
}

export function BonusImportModal({ open, sf, event, eventRef, onClose }: BonusImportModalProps) {
  const [text, setText] = useState('');
  const [matchday, setMatchday] = useState(sf.calendar.currentMatchday);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setMatchday(sf.calendar.currentMatchday);
      setError(null);
    }
  }, [open, sf.calendar.currentMatchday]);

  const parsed = useMemo(() => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const rows: { entryId: string; value: number }[] = [];
    for (const line of lines) {
      const idx = line.lastIndexOf(',');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = Number(line.slice(idx + 1).trim());
      if (!key || !Number.isFinite(value)) continue;
      const entry = event.entries.find((e) => {
        const d = entryDisplay(sf, event, e.id);
        return d.code.toLowerCase() === key || d.name.toLowerCase() === key;
      });
      if (entry) rows.push({ entryId: entry.id, value });
    }
    return { rows, total: lines.length };
  }, [text, sf, event]);

  const apply = () => {
    const result = importBonusAction(eventRef, matchday, parsed.rows);
    if (result.ok) onClose();
    else setError(result.message);
  };

  return (
    <Modal
      open={open}
      title={t('competitions.cockpit.importBonus')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={parsed.rows.length === 0} onClick={apply}>
            {t('competitions.cockpit.apply')}
          </Button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-dim)', fontSize: 13 }}>
        {t('competitions.cockpit.importBonusBody')}
      </p>
      {error ? (
        <p className="mono" style={{ color: 'var(--danger)', fontSize: 12 }}>
          {error}
        </p>
      ) : null}
      <div className="field">
        <label className="field__label">{t('competitions.cockpit.importBonusMd')}</label>
        <NumberInput
          className="input"
          style={{ width: 90 }}
          value={matchday}
          min={1}
          max={sf.calendar.matchdaysPerSeason}
          onCommit={setMatchday}
        />
      </div>
      <div className="field">
        <textarea
          className="textarea"
          rows={8}
          autoFocus
          placeholder={'QUS, 2.5\nBRX, 1.75\nMirrow, 0.5'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
          {t('competitions.cockpit.importBonusParsed', { count: parsed.rows.length, total: parsed.total })}
        </div>
      </div>
    </Modal>
  );
}
