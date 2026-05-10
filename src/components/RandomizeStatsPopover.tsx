import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { NumberInput } from './NumberInput';
import { t } from '../lang';
import { sampleStatBlock } from '../generation/statSampler';
import { createRng, newSeedString } from '../generation/prng';
import type { GameStatBlock, Position } from '../domain/player';
import type { Rng } from '../generation/prng';

interface RandomizeStatsPopoverProps {
  position: Position;
  currentOvr: number;
  onApply: (next: { stats: GameStatBlock; consistency: number; workRate: number; injuryProneness: number; potential: number }) => void;
}

export function RandomizeStatsPopover({
  position,
  currentOvr,
  onApply,
}: RandomizeStatsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(currentOvr || 70);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const apply = () => {
    const rng: Rng = createRng(newSeedString());
    const stats = sampleStatBlock(rng, position, target);
    onApply({
      stats,
      consistency: clampStat(rng.normal(60, 14)),
      workRate: clampStat(rng.normal(60, 14)),
      injuryProneness: clampStat(rng.normal(30, 18)),
      potential: clampStat(target + rng.int(0, 8)),
    });
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button size="sm" onClick={() => setOpen((v) => !v)}>
        {t('randomize.button')}
      </Button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 14,
            width: 260,
            zIndex: 10,
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="form-section__heading" style={{ marginBottom: 4 }}>
            {t('randomize.title')}
          </div>
          <div className="text-dim" style={{ fontSize: 12, marginBottom: 10 }}>
            {t('randomize.body')}
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label">{t('randomize.targetOvr')}</label>
            <NumberInput
              className="input mono"
              min={30}
              max={95}
              value={target}
              onCommit={setTarget}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <Button size="sm" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={apply}>
              {t('randomize.submit')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clampStat(v: number): number {
  if (Number.isNaN(v)) return 50;
  return Math.max(1, Math.min(100, Math.round(v)));
}
