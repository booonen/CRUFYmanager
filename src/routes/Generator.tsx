import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { NamePoolPicker } from '../components/NamePoolPicker';
import { NumberInput } from '../components/NumberInput';
import { PageHeading } from '../components/PageHeading';
import { applyGeneratedLeague, applyGeneratedManagers } from '../generation/apply';
import { generateLeague } from '../generation/leagueGen';
import { generateManager } from '../generation/managerGen';
import { listPools, resolvePool } from '../generation/nameGen';
import { createRng, newSeedString } from '../generation/prng';
import { TIER_OVR_STEP, TIER_OVR_TOP } from '../generation/shapes';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';

/** Best-guess pool for a country name, used only to seed the picker on first open. */
function defaultPoolForCountry(country: string): string {
  const list = listPools();
  return resolvePool(country)?.code ?? list[0]?.code ?? 'english';
}

export function GeneratorRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);

  if (status !== 'ready' || !savefile) {
    return (
      <EmptyState
        glyph="◉"
        title={t('saves.empty.title')}
        body={t('saves.empty.body')}
        action={
          <Link to="/saves">
            <Button variant="primary">{t('saves.new')}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeading title={t('generator.title')} sub={t('generator.sub')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <LeagueGeneratorPanel defaultCountry={savefile.meta.countryName} />
        <ManagerGeneratorPanel defaultCountry={savefile.meta.countryName} />
      </div>
    </>
  );
}

interface PanelHeadProps {
  heading: string;
  body: string;
}

function PanelHead({ heading, body }: PanelHeadProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="form-section__heading" style={{ marginBottom: 4 }}>
        {heading}
      </div>
      <div className="text-dim" style={{ fontSize: 13 }}>
        {body}
      </div>
    </div>
  );
}

interface SeedFieldProps {
  seed: string;
  setSeed: (s: string) => void;
}

function SeedField({ seed, setSeed }: SeedFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="chip"
        style={{ fontSize: 11 }}
      >
        {open ? '▾' : '▸'} {t('generator.advanced')}
      </button>
      {open ? (
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
  );
}

function LeagueGeneratorPanel({ defaultCountry }: { defaultCountry: string }) {
  const [country, setCountry] = useState(defaultCountry);
  const initialPool = useMemo(() => defaultPoolForCountry(defaultCountry), [defaultCountry]);
  const [poolCode, setPoolCode] = useState(initialPool);
  const [tierCount, setTierCount] = useState(4);
  const [clubsPerTier, setClubsPerTier] = useState(16);
  const [topTierOvr, setTopTierOvr] = useState(TIER_OVR_TOP);
  const [tierStep, setTierStep] = useState(TIER_OVR_STEP);
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const flushNow = useSavefileStore((s) => s.flushNow);

  const calendar = useSavefileStore((s) => s.savefile?.calendar ?? null);

  const handleSubmit = async () => {
    if (!calendar) return;
    setBusy(true);
    setSummary(null);
    const start = performance.now();
    try {
      const rng = createRng(seed.trim() || newSeedString());
      const league = generateLeague({
        rng,
        calendar,
        countryName: country.trim(),
        poolCode,
        tierCount,
        clubsPerTier,
        topTierOvr,
        tierStep,
      });
      applyGeneratedLeague(league);
      await flushNow();
      const seconds = ((performance.now() - start) / 1000).toFixed(1);
      setSummary(
        t('generator.league.summary', {
          clubs: league.clubs.length,
          players: league.players.length,
          managers: league.managers.length,
          tiers: league.tiers.length,
          seconds,
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    country.trim().length > 0 &&
    tierCount >= 1 &&
    tierCount <= 6 &&
    clubsPerTier >= 2 &&
    clubsPerTier <= 32 &&
    !busy;

  return (
    <div className="panel">
      <PanelHead heading={t('generator.league.heading')} body={t('generator.league.body')} />
      <div className="form-grid">
        <div className="field">
          <label className="field__label">{t('generator.league.country')}</label>
          <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
          <div className="field__hint">{t('generator.countryHint')}</div>
        </div>
        <div className="field">
          <label className="field__label">{t('generator.namebase')}</label>
          <NamePoolPicker value={poolCode} onChange={setPoolCode} />
          <div className="field__hint">{t('generator.namebaseHint')}</div>
        </div>
        <div className="field">
          <label className="field__label">{t('generator.league.tierCount')}</label>
          <NumberInput
            className="input mono"
            min={1}
            max={6}
            value={tierCount}
            onCommit={setTierCount}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('generator.league.clubsPerTier')}</label>
          <NumberInput
            className="input mono"
            min={2}
            max={32}
            value={clubsPerTier}
            onCommit={setClubsPerTier}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('generator.league.topTierOvr')}</label>
          <NumberInput
            className="input mono"
            min={40}
            max={95}
            value={topTierOvr}
            onCommit={setTopTierOvr}
          />
        </div>
        <div className="field">
          <label className="field__label">{t('generator.league.tierStep')}</label>
          <NumberInput
            className="input mono"
            min={4}
            max={20}
            value={tierStep}
            onCommit={setTierStep}
          />
        </div>
      </div>
      <SeedField seed={seed} setSeed={setSeed} />
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
          {busy ? t('generator.busy') : t('generator.league.submit')}
        </Button>
        {summary ? (
          <span className="text-dim" style={{ fontSize: 12 }}>
            {summary}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ManagerGeneratorPanel({ defaultCountry }: { defaultCountry: string }) {
  const [country, setCountry] = useState(defaultCountry);
  const initialPool = useMemo(() => defaultPoolForCountry(defaultCountry), [defaultCountry]);
  const [poolCode, setPoolCode] = useState(initialPool);
  const [count, setCount] = useState(10);
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const flushNow = useSavefileStore((s) => s.flushNow);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const rng = createRng(seed.trim() || newSeedString());
      const managers = Array.from({ length: count }, () =>
        generateManager({ rng, nationality: country.trim(), poolCode }),
      );
      applyGeneratedManagers(managers);
      await flushNow();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <PanelHead heading={t('generator.managers.heading')} body={t('generator.managers.body')} />
      <div className="form-grid">
        <div className="field">
          <label className="field__label">{t('generator.league.country')}</label>
          <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">{t('generator.namebase')}</label>
          <NamePoolPicker value={poolCode} onChange={setPoolCode} />
        </div>
        <div className="field">
          <label className="field__label">{t('generator.managers.count')}</label>
          <NumberInput
            className="input mono"
            min={1}
            max={50}
            value={count}
            onCommit={setCount}
          />
        </div>
      </div>
      <SeedField seed={seed} setSeed={setSeed} />
      <div style={{ marginTop: 12 }}>
        <Button variant="primary" disabled={busy} onClick={() => void handleSubmit()}>
          {busy ? t('generator.busy') : t('generator.managers.submit')}
        </Button>
      </div>
    </div>
  );
}

