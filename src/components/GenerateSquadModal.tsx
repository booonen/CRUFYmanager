import { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { NamePoolPicker } from './NamePoolPicker';
import { NumberInput } from './NumberInput';
import { t } from '../lang';
import { applyGeneratedSquad } from '../generation/apply';
import { generateSquad } from '../generation/squadGen';
import { listPools, resolvePool } from '../generation/nameGen';
import { createRng, newSeedString } from '../generation/prng';
import { DEFAULT_SQUAD_SIZE } from '../generation/shapes';
import { useSavefileStore } from '../stores/savefile';
import type { Club } from '../domain/club';

interface GenerateSquadModalProps {
  open: boolean;
  club: Club;
  onClose: () => void;
}

export function GenerateSquadModal({ open, club, onClose }: GenerateSquadModalProps) {
  const calendar = useSavefileStore((s) => s.savefile?.calendar ?? null);
  const countryName = useSavefileStore((s) => s.savefile?.meta.countryName ?? '');
  const flushNow = useSavefileStore((s) => s.flushNow);

  const initialPool = useMemo(
    () => resolvePool(countryName)?.code ?? listPools()[0]?.code ?? 'english',
    [countryName],
  );

  const [targetOvr, setTargetOvr] = useState(club.ovr || 70);
  const [squadSize, setSquadSize] = useState(DEFAULT_SQUAD_SIZE);
  const [nationality, setNationality] = useState(countryName);
  const [poolCode, setPoolCode] = useState(initialPool);
  const [replace, setReplace] = useState(false);
  const [seed, setSeed] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTargetOvr(club.ovr || 70);
      setSquadSize(DEFAULT_SQUAD_SIZE);
      setNationality(countryName);
      setPoolCode(initialPool);
      setReplace(false);
      setSeed('');
      setBusy(false);
    }
  }, [open, club, countryName, initialPool]);

  if (!calendar) return null;

  const currentSize = club.squadPlayerIds.length;
  const toGenerate = replace ? squadSize : Math.max(0, squadSize - currentSize);

  const handleSubmit = async () => {
    if (toGenerate === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const rng = createRng(seed.trim() || newSeedString());
      const taken = new Set<number>();
      if (!replace) {
        const existing = useSavefileStore
          .getState()
          .savefile?.players.filter(
            (p) => p.tier === 'domestic' && p.clubId === club.id,
          ) ?? [];
        for (const p of existing) {
          if (p.tier === 'domestic' && typeof p.squadNumber === 'number') {
            taken.add(p.squadNumber);
          }
        }
      }
      const result = generateSquad({
        rng,
        calendar,
        clubId: club.id,
        nationality: nationality.trim(),
        poolCode,
        targetClubOvr: targetOvr,
        squadSize: toGenerate,
        takenSquadNumbers: taken,
      });
      applyGeneratedSquad(result, club.id, { replaceExisting: replace });
      await flushNow();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('generateSquad.title')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={busy} onClick={() => void handleSubmit()}>
            {busy ? t('generator.busy') : t('generateSquad.submit')}
          </Button>
        </>
      }
    >
      <div className="text-dim" style={{ fontSize: 13, marginBottom: 12 }}>
        {t('generateSquad.body')}
      </div>
      <div className="form-grid">
        <div className="field">
          <label className="field__label">{t('generateSquad.targetOvr')}</label>
          <NumberInput
            className="input mono"
            min={30}
            max={95}
            value={targetOvr}
            onCommit={setTargetOvr}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('generateSquad.squadSize')}</label>
          <NumberInput
            className="input mono"
            min={11}
            max={60}
            value={squadSize}
            onCommit={setSquadSize}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('generateSquad.nationality')}</label>
          <input
            className="input"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('generator.namebase')}</label>
          <NamePoolPicker value={poolCode} onChange={setPoolCode} />
        </div>
      </div>

      <label
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
        />
        <span>{t('generateSquad.replace')}</span>
      </label>
      <div className="text-muted" style={{ fontSize: 11, marginLeft: 22, marginTop: 2 }}>
        {t('generateSquad.replaceHint')}
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="chip"
          style={{ fontSize: 11 }}
        >
          {advancedOpen ? '▾' : '▸'} {t('generator.advanced')}
        </button>
        {advancedOpen ? (
          <div className="field" style={{ marginTop: 8 }}>
            <label className="field__label">{t('generator.seed')}</label>
            <input
              className="input mono"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="(empty = random)"
            />
            <div className="field__hint">{t('generator.seedHint')}</div>
          </div>
        ) : null}
      </div>

      <div className="text-dim" style={{ fontSize: 12, marginTop: 12 }}>
        Will generate <span className="mono">{toGenerate}</span> player(s).
      </div>
    </Modal>
  );
}
