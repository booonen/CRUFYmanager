import type { SimParams } from '../domain/scorination';
import { t } from '../lang';
import { updateSimParams } from '../stores/competitions';
import { Button } from './Button';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';

interface ScorinationSettingsModalProps {
  open: boolean;
  params: SimParams;
  onClose: () => void;
}

export function ScorinationSettingsModal({ open, params, onClose }: ScorinationSettingsModalProps) {
  const field = (key: keyof SimParams, label: string, min: number, max: number) => (
    <div className="field" style={{ flex: 1, minWidth: 140 }}>
      <label className="field__label">{label}</label>
      <NumberInput
        className="input"
        value={params[key]}
        min={min}
        max={max}
        step={0.01}
        allowFloat
        onCommit={(v) => updateSimParams({ [key]: v })}
      />
    </div>
  );

  return (
    <Modal
      open={open}
      title={t('competitions.cockpit.settings')}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      <p style={{ marginTop: 0, color: 'var(--text-dim)', fontSize: 13 }}>
        {t('competitions.cockpit.settingsHint')}
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {field('goalsPerMatch', t('competitions.cockpit.goalsPerMatch'), 0.2, 12)}
        {field('chaos', t('competitions.cockpit.chaosLabel'), 0, 1)}
        {field('favoritism', t('competitions.cockpit.favoritismLabel'), 0.5, 12)}
        {field('homeEdge', t('competitions.cockpit.homeEdgeLabel'), -0.5, 0.5)}
        {field('styleImpact', t('competitions.cockpit.styleImpactLabel'), 0, 2)}
      </div>
    </Modal>
  );
}
