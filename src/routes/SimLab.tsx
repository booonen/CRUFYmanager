import { useState } from 'react';
import { Button } from '../components/Button';
import { NumberInput } from '../components/NumberInput';
import { PageHeading } from '../components/PageHeading';
import { DEFAULT_SIM_PARAMS } from '../domain/scorination';
import { simulateMatch } from '../engine/simulate';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';

interface LabResult {
  n: number;
  aWins: number;
  draws: number;
  bWins: number;
  avgGoals: number;
  scorelines: { label: string; count: number }[];
}

export function SimLabRoute() {
  const savefile = useSavefileStore((s) => s.savefile);
  const params = savefile?.scorination.sim ?? DEFAULT_SIM_PARAMS;

  const [ratingA, setRatingA] = useState(20);
  const [ratingB, setRatingB] = useState(14);
  const [max, setMax] = useState(30);
  const [runs, setRuns] = useState(1000);
  const [styleA, setStyleA] = useState(0);
  const [styleB, setStyleB] = useState(0);
  const [knockout, setKnockout] = useState(false);
  const [result, setResult] = useState<LabResult | null>(null);

  const run = () => {
    const counts = new Map<string, number>();
    let aWins = 0;
    let draws = 0;
    let bWins = 0;
    let goals = 0;
    const stamp = Date.now();
    for (let i = 0; i < runs; i++) {
      const out = simulateMatch(
        {
          homeRating: ratingA,
          awayRating: ratingB,
          homeStyle: styleA,
          awayStyle: styleB,
          ratingMax: Math.max(1, max),
          params,
          knockout,
        },
        `lab-${stamp}-${i}`,
      );
      goals += out.home + out.away;
      if (out.home > out.away) aWins += 1;
      else if (out.home < out.away) bWins += 1;
      else draws += 1;
      const key = `${out.home}–${out.away}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const scorelines = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }));
    setResult({ n: runs, aWins, draws, bWins, avgGoals: goals / runs, scorelines });
  };

  const pct = (x: number, n: number) => ((100 * x) / n).toFixed(1);

  return (
    <>
      <PageHeading title={t('nav.simLab')} sub={t('simlab.sub')} />
      <div className="panel" style={{ padding: 16, maxWidth: 560 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field">
            <label className="field__label">{t('simlab.ratingA')}</label>
            <NumberInput className="input" style={{ width: 90 }} value={ratingA} min={0} max={9999} step={0.01} allowFloat onCommit={setRatingA} />
          </div>
          <div className="field">
            <label className="field__label">{t('simlab.ratingB')}</label>
            <NumberInput className="input" style={{ width: 90 }} value={ratingB} min={0} max={9999} step={0.01} allowFloat onCommit={setRatingB} />
          </div>
          <div className="field">
            <label className="field__label">{t('simlab.max')}</label>
            <NumberInput className="input" style={{ width: 90 }} value={max} min={1} max={9999} step={0.01} allowFloat onCommit={setMax} />
          </div>
          <div className="field">
            <label className="field__label">{t('simlab.styleA')}</label>
            <NumberInput className="input" style={{ width: 90 }} value={styleA} min={-5} max={5} step={0.01} allowFloat onCommit={setStyleA} />
          </div>
          <div className="field">
            <label className="field__label">{t('simlab.styleB')}</label>
            <NumberInput className="input" style={{ width: 90 }} value={styleB} min={-5} max={5} step={0.01} allowFloat onCommit={setStyleB} />
          </div>
          <div className="field">
            <label className="field__label">{t('simlab.runs')}</label>
            <NumberInput className="input" style={{ width: 90 }} value={runs} min={100} max={20000} onCommit={setRuns} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={knockout} onChange={(e) => setKnockout(e.target.checked)} />
            {t('simlab.knockout')}
          </label>
          <Button variant="primary" onClick={run}>
            {t('simlab.run')}
          </Button>
        </div>

        {result ? (
          <div style={{ marginTop: 16 }}>
            <div className="mono" style={{ fontSize: 13 }}>
              {t('simlab.results', {
                n: result.n,
                aw: pct(result.aWins, result.n),
                d: pct(result.draws, result.n),
                bw: pct(result.bWins, result.n),
                g: result.avgGoals.toFixed(2),
              })}
            </div>
            <div style={{ marginTop: 10, fontWeight: 600, fontSize: 13 }}>{t('simlab.scorelines')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {result.scorelines.map((s) => (
                <span key={s.label} className="chip mono" style={{ fontSize: 12 }}>
                  {s.label} ×{s.count}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
