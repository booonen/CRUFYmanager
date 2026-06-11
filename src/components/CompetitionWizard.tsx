import { useEffect, useMemo, useState } from 'react';
import type { Savefile } from '../domain/savefile';
import type { ParticipantRef } from '../domain/spine';
import { nextPow2, type CompetitionPreset, type CompetitionSpec, type EntryInput } from '../engine/generate';
import { t } from '../lang';
import { createCompetition } from '../stores/competitions';
import { participantDisplay } from '../utils/participants';
import { Button } from './Button';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';

interface CompetitionWizardProps {
  open: boolean;
  sf: Savefile;
  onClose: () => void;
  onCreated: (competitionId: string) => void;
}

type PresetKind = CompetitionPreset['kind'];
type Step = 0 | 1 | 2 | 3;

const codeOf = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '???';

/**
 * "Name, CODE, rating" per line; code and rating optional. Ratings are decimal,
 * higher = better, any internally consistent scale (KPB-style ~0–30, 0–100, …).
 * Unrated lines get 0 and keep their paste order among themselves.
 */
function parsePastedEntries(text: string): EntryInput[] {
  const out: EntryInput[] = [];
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim());
    const name = parts[0] ?? '';
    if (!name) continue;
    let code = '';
    const numbers: number[] = [];
    for (const part of parts.slice(1)) {
      const n = Number(part);
      if (part !== '' && Number.isFinite(n)) {
        numbers.push(n);
      } else if (part) {
        code = part;
      }
    }
    out.push({
      participant: { kind: 'ad-hoc', name, shortCode: (code || codeOf(name)).toUpperCase().slice(0, 5) },
      seeding: numbers[0] ?? 0,
      styleMod: Math.max(-5, Math.min(5, numbers[1] ?? 0)),
    });
  }
  return out;
}

const fmtSeed = (value: number) => (value % 1 === 0 ? String(value) : value.toFixed(2));

interface WorldPick {
  key: string;
  label: string;
  ref: ParticipantRef;
  rating: number;
}

export function CompetitionWizard({ open, sf, onClose, onCreated }: CompetitionWizardProps) {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [presetKind, setPresetKind] = useState<PresetKind>('groups-knockout');
  const [legs, setLegs] = useState<1 | 2>(1);
  const [koLegs, setKoLegs] = useState<1 | 2>(1);
  const [groupCount, setGroupCount] = useState(8);
  const [qualifyPerGroup, setQualifyPerGroup] = useState(2);
  const [bestCount, setBestCount] = useState(0);
  const [bestPlace, setBestPlace] = useState(3);
  const [thirdPlace, setThirdPlace] = useState(true);
  const [awayGoals, setAwayGoals] = useState(false);
  const [pairing, setPairing] = useState<'ranked' | 'manual'>('ranked');
  const [pasteText, setPasteText] = useState('');
  const [picked, setPicked] = useState<WorldPick[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setName('');
      setShortName('');
      setPresetKind('groups-knockout');
      setLegs(1);
      setKoLegs(1);
      setGroupCount(8);
      setQualifyPerGroup(2);
      setBestCount(0);
      setBestPlace(3);
      setThirdPlace(true);
      setAwayGoals(false);
      setPairing('ranked');
      setPasteText('');
      setPicked([]);
      setError(null);
    }
  }, [open]);

  const pasted = useMemo(() => parsePastedEntries(pasteText), [pasteText]);
  const entries: EntryInput[] = useMemo(
    () => [...pasted, ...picked.map((p) => ({ participant: p.ref, seeding: p.rating }))],
    [pasted, picked],
  );

  const worldOptions: WorldPick[] = useMemo(() => {
    const out: WorldPick[] = [];
    for (const club of sf.clubs) {
      if (club.kind !== 'club') continue;
      out.push({
        key: `club-${club.id}`,
        label: t('competitions.wizard.addClub', { name: club.name }),
        ref: { kind: 'club', id: club.id },
        rating: club.ovr || 50,
      });
    }
    out.push({
      key: 'nt',
      label: t('competitions.wizard.addNT', { name: sf.meta.countryName }),
      ref: { kind: 'national-team' },
      rating: 50,
    });
    for (const nt of sf.foreignWorld.nationalTeams) {
      out.push({
        key: `fnt-${nt.id}`,
        label: t('competitions.wizard.addForeignNT', { name: nt.countryName }),
        ref: { kind: 'foreign-nt', id: nt.id },
        rating: nt.ovr || 50,
      });
    }
    return out;
  }, [sf]);

  const preset: CompetitionPreset = useMemo(() => {
    if (presetKind === 'league') return { kind: 'league', legs };
    if (presetKind === 'knockout') return { kind: 'knockout', legs: koLegs, thirdPlace, awayGoals, pairing };
    if (presetKind === 'single-match') return { kind: 'single-match' };
    return {
      kind: 'groups-knockout',
      groupCount,
      legs,
      qualifyPerGroup,
      bestOfPlace: bestCount > 0 ? { place: bestPlace, count: bestCount } : null,
      koLegs,
      thirdPlace,
      awayGoals,
    };
  }, [presetKind, legs, koLegs, groupCount, qualifyPerGroup, bestCount, bestPlace, thirdPlace, awayGoals, pairing]);

  const validate = (target: Step): string | null => {
    if (target >= 1 && name.trim().length === 0) return t('competitions.wizard.errNeedName');
    if (target >= 3) {
      if (entries.length < 2) return t('competitions.wizard.errNeedEntries');
      if (preset.kind === 'groups-knockout' && entries.length % preset.groupCount !== 0) {
        return t('competitions.wizard.errGroupsDivide', { count: entries.length, groups: preset.groupCount });
      }
      if (preset.kind === 'single-match' && entries.length !== 2) {
        return t('competitions.wizard.errNeedEntries');
      }
    }
    return null;
  };

  const goTo = (target: Step) => {
    const problem = validate(target);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep(target);
  };

  const create = () => {
    const problem = validate(3);
    if (problem) {
      setError(problem);
      return;
    }
    const spec: CompetitionSpec = {
      name: name.trim(),
      shortName: (shortName.trim() || codeOf(name)).toUpperCase().slice(0, 6),
      preset,
      entries,
    };
    const { result, id } = createCompetition(spec);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (id) onCreated(id);
    onClose();
  };

  const qualifierCount =
    preset.kind === 'groups-knockout'
      ? preset.groupCount * preset.qualifyPerGroup + (preset.bestOfPlace?.count ?? 0)
      : preset.kind === 'knockout'
        ? entries.length
        : 0;
  const koSize = qualifierCount > 0 ? nextPow2(qualifierCount) : 0;

  const steps = [
    t('competitions.wizard.stepBasics'),
    t('competitions.wizard.stepFormat'),
    t('competitions.wizard.stepEntries'),
    t('competitions.wizard.stepReview'),
  ];

  const presetOptions: { kind: PresetKind; label: string; desc: string }[] = [
    {
      kind: 'league',
      label: t('competitions.wizard.presets.league'),
      desc: t('competitions.wizard.presets.leagueDesc'),
    },
    {
      kind: 'groups-knockout',
      label: t('competitions.wizard.presets.groupsKnockout'),
      desc: t('competitions.wizard.presets.groupsKnockoutDesc'),
    },
    {
      kind: 'knockout',
      label: t('competitions.wizard.presets.knockout'),
      desc: t('competitions.wizard.presets.knockoutDesc'),
    },
    {
      kind: 'single-match',
      label: t('competitions.wizard.presets.singleMatch'),
      desc: t('competitions.wizard.presets.singleMatchDesc'),
    },
  ];

  const legsSelect = (value: 1 | 2, onChange: (v: 1 | 2) => void, label: string) => (
    <div className="field">
      <label className="field__label">{label}</label>
      <select className="select" value={value} onChange={(e) => onChange(Number(e.target.value) === 2 ? 2 : 1)}>
        <option value={1}>{t('competitions.wizard.oneLeg')}</option>
        <option value={2}>{t('competitions.wizard.twoLegs')}</option>
      </select>
    </div>
  );

  return (
    <Modal
      open={open}
      title={t('competitions.new')}
      onClose={onClose}
      footer={
        <>
          {step > 0 ? <Button onClick={() => goTo((step - 1) as Step)}>{t('common.back')}</Button> : null}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {step < 3 ? (
            <Button variant="primary" onClick={() => goTo((step + 1) as Step)}>
              {t('common.next')}
            </Button>
          ) : (
            <Button variant="primary" onClick={create}>
              {t('competitions.wizard.create')}
            </Button>
          )}
        </>
      }
    >
      <div className="chip-row" style={{ marginBottom: 14 }}>
        {steps.map((label, i) => (
          <span key={label} className={`chip ${i === step ? 'chip--active' : ''}`}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error ? (
        <p className="mono" style={{ color: 'var(--danger)', marginTop: 0 }}>
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('competitions.wizard.name')}</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">{t('competitions.wizard.shortName')}</label>
            <input className="input" value={shortName} onChange={(e) => setShortName(e.target.value)} />
            <div className="field__hint">{t('competitions.wizard.shortNameHint')}</div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('competitions.wizard.preset')}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {presetOptions.map((opt) => (
                <button
                  key={opt.kind}
                  type="button"
                  className="list-row"
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderColor: presetKind === opt.kind ? 'var(--accent)' : undefined,
                  }}
                  onClick={() => setPresetKind(opt.kind)}
                >
                  <div className="list-row__main">
                    <div className="list-row__title">{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {presetKind === 'league' ? legsSelect(legs, setLegs, t('competitions.wizard.legs')) : null}

          {presetKind === 'groups-knockout' ? (
            <>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">{t('competitions.wizard.groupCount')}</label>
                  <NumberInput className="input" value={groupCount} min={2} max={16} onCommit={setGroupCount} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">{t('competitions.wizard.qualifyPerGroup')}</label>
                  <NumberInput className="input" value={qualifyPerGroup} min={1} max={4} onCommit={setQualifyPerGroup} />
                </div>
              </div>
              {legsSelect(legs, setLegs, t('competitions.wizard.legs'))}
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">{t('competitions.wizard.bestOfPlaceCount')}</label>
                  <NumberInput className="input" value={bestCount} min={0} max={8} onCommit={setBestCount} />
                  <div className="field__hint">{t('competitions.wizard.bestOfPlaceHint')}</div>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field__label">{t('competitions.wizard.bestOfPlacePlace')}</label>
                  <NumberInput className="input" value={bestPlace} min={2} max={5} onCommit={setBestPlace} />
                </div>
              </div>
              {legsSelect(koLegs, setKoLegs, t('competitions.wizard.legsKo'))}
            </>
          ) : null}

          {presetKind === 'knockout' ? (
            <>
              {legsSelect(koLegs, setKoLegs, t('competitions.wizard.legsKo'))}
              <div className="field">
                <label className="field__label">{t('competitions.wizard.pairing')}</label>
                <select
                  className="select"
                  value={pairing}
                  onChange={(e) => setPairing(e.target.value === 'manual' ? 'manual' : 'ranked')}
                >
                  <option value="ranked">{t('competitions.wizard.pairingRanked')}</option>
                  <option value="manual">{t('competitions.wizard.pairingManual')}</option>
                </select>
              </div>
            </>
          ) : null}

          {presetKind === 'groups-knockout' || presetKind === 'knockout' ? (
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} />
                {t('competitions.wizard.thirdPlace')}
              </label>
              {koLegs === 2 ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={awayGoals} onChange={(e) => setAwayGoals(e.target.checked)} />
                  {t('competitions.wizard.awayGoals')}
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="form-grid">
          <div className="field">
            <label className="field__label">{t('competitions.wizard.entriesPaste')}</label>
            <textarea
              className="textarea"
              rows={10}
              value={pasteText}
              autoFocus
              placeholder={'Qusmo, QUS, 28.54, -2.13\nBrixton Hill, BRX, 27.01, 1.5\nAppleton'}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="field__hint">{t('competitions.wizard.entriesHint')}</div>
            <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
              {t('competitions.wizard.entriesParsed', { count: entries.length })}
            </div>
          </div>
          {worldOptions.length > 0 ? (
            <div className="field">
              <label className="field__label">{t('competitions.wizard.addFromWorld')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                {worldOptions.map((opt) => {
                  const active = picked.some((p) => p.key === opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className={`chip ${active ? 'chip--active' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        setPicked((cur) =>
                          active ? cur.filter((p) => p.key !== opt.key) : [...cur, opt],
                        )
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontWeight: 600 }}>{name.trim()}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
              {presetOptions.find((p) => p.kind === presetKind)?.label} ·{' '}
              {t('competitions.wizard.reviewEntries', { count: entries.length })}
            </div>
            {koSize > qualifierCount && qualifierCount > 0 ? (
              <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6 }}>
                {t('competitions.wizard.errKoQualifiers', { q: qualifierCount, size: koSize })}
              </div>
            ) : null}
          </div>
          <div className="panel" style={{ padding: 12, maxHeight: 220, overflowY: 'auto' }}>
            {entries.map((e, i) => (
              <div key={i} style={{ fontSize: 13, padding: '2px 0', display: 'flex', gap: 8 }}>
                <span className="mono" style={{ color: 'var(--text-dim)', width: 48, textAlign: 'right' }}>
                  {fmtSeed(e.seeding)}
                </span>
                {participantDisplay(sf, e.participant).name}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
