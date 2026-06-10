import { useEffect, useState } from 'react';
import type { Savefile } from '../domain/savefile';
import type { Fixture, Round, SportEvent, Stage } from '../domain/spine';
import type { FixtureRef, StageRef } from '../engine/mutate';
import { matchdayPostBBCode } from '../export/bbcode';
import { t } from '../lang';
import {
  assignSlot,
  clearFixtureResult,
  enterScore,
  publishRoundAction,
  setRoundMatchdayAction,
  unlockResultAction,
  type SpineActionResult,
} from '../stores/competitions';
import { copyText } from '../utils/clipboard';
import { entryDisplay } from '../utils/participants';
import { AssignSlotModal } from './AssignSlotModal';
import { Button } from './Button';
import { NumberInput } from './NumberInput';
import { UnlockResultModal } from './UnlockResultModal';

interface RoundCardProps {
  sf: Savefile;
  event: SportEvent;
  stage: Stage;
  round: Round;
  stageRef: StageRef;
}

const intOrNull = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

function ScoreCells({
  fx,
  disabled,
  onCommit,
}: {
  fx: Fixture;
  disabled: boolean;
  onCommit: (home: number, away: number) => void;
}) {
  const current =
    fx.result && fx.result.payload.family === 'score' ? fx.result.payload.score : null;
  const [home, setHome] = useState(current ? String(current[0]) : '');
  const [away, setAway] = useState(current ? String(current[1]) : '');

  useEffect(() => {
    setHome(current ? String(current[0]) : '');
    setAway(current ? String(current[1]) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.[0], current?.[1], fx.id]);

  const commit = () => {
    const h = intOrNull(home);
    const a = intOrNull(away);
    if (h === null || a === null) return;
    if (current && current[0] === h && current[1] === a) return;
    onCommit(h, a);
  };

  const keyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    }
  };

  return (
    <span className="score-cells">
      <input
        className="input score-input"
        inputMode="numeric"
        disabled={disabled}
        value={home}
        onChange={(e) => setHome(e.target.value)}
        onBlur={commit}
        onKeyDown={keyDown}
      />
      <span className="score-sep">–</span>
      <input
        className="input score-input"
        inputMode="numeric"
        disabled={disabled}
        value={away}
        onChange={(e) => setAway(e.target.value)}
        onBlur={commit}
        onKeyDown={keyDown}
      />
    </span>
  );
}

function PensCells({
  initial,
  onApply,
}: {
  initial: [number, number] | null;
  onApply: (home: number, away: number) => void;
}) {
  const [home, setHome] = useState(initial ? String(initial[0]) : '');
  const [away, setAway] = useState(initial ? String(initial[1]) : '');
  const commit = () => {
    const h = intOrNull(home);
    const a = intOrNull(away);
    if (h === null || a === null || h === a) return;
    if (initial && initial[0] === h && initial[1] === a) return;
    onApply(h, a);
  };
  return (
    <span className="score-cells" style={{ marginLeft: 8 }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        {t('competitions.cockpit.pens')}
      </span>
      <input
        className="input score-input score-input--sm"
        inputMode="numeric"
        value={home}
        onChange={(e) => setHome(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          }
        }}
      />
      <span className="score-sep">–</span>
      <input
        className="input score-input score-input--sm"
        inputMode="numeric"
        value={away}
        onChange={(e) => setAway(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          }
        }}
      />
    </span>
  );
}

export function RoundCard({ sf, event, stage, round, stageRef }: RoundCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<{ ref: FixtureRef; label: string } | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ ref: FixtureRef; side: 'home' | 'away' } | null>(null);
  const [copied, setCopied] = useState(false);

  const isKnockout = stage.format.kind === 'knockout' || stage.format.kind === 'single-match';
  const refFor = (fx: Fixture): FixtureRef => ({ ...stageRef, roundId: round.id, fixtureId: fx.id });

  const run = (result: SpineActionResult) => {
    setError(result.ok ? null : result.message);
  };

  const results = round.fixtures.filter((fx) => fx.result !== null);
  const published = round.fixtures.filter((fx) => fx.result?.lifecycle.status === 'published');
  const allPublished = results.length > 0 && published.length === results.length;

  const copyPost = async () => {
    const ok = await copyText(matchdayPostBBCode(sf, event, stage, round));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  // Groups stages render the matchday sectioned per group, like the forum post.
  const sections =
    stage.groups.length > 0
      ? stage.groups
          .map((g) => ({ label: g.name as string | null, fixtures: round.fixtures.filter((fx) => fx.groupId === g.id) }))
          .filter((s) => s.fixtures.length > 0)
      : [{ label: null, fixtures: round.fixtures }];

  return (
    <div className="panel round-card">
      <div className="round-card__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>{round.name}</div>
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--text-muted)' }}
            title={t('calendar.mdHint')}
          >
            {t('calendar.mdBadge')}
          </span>
          <NumberInput
            className="input"
            style={{ width: 52, padding: '2px 4px', fontSize: 11 }}
            value={round.calendarMatchday ?? 0}
            min={0}
            max={sf.calendar.matchdaysPerSeason}
            title={t('calendar.mdHint')}
            onCommit={(v) => run(setRoundMatchdayAction({ ...stageRef, roundId: round.id }, v === 0 ? null : v))}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {allPublished ? (
            <span className="chip chip--active" style={{ fontSize: 11 }}>
              ✓ {t('competitions.cockpit.roundPublished')}
            </span>
          ) : published.length > 0 ? (
            <span className="chip" style={{ fontSize: 11 }}>
              {t('competitions.cockpit.partlyPublished', { done: published.length, total: results.length })}
            </span>
          ) : null}
          <Button size="sm" onClick={() => void copyPost()}>
            {copied ? t('common.copied') : t('competitions.cockpit.copyPost')}
          </Button>
          {!allPublished ? (
            <Button
              size="sm"
              variant="primary"
              disabled={results.length === published.length}
              onClick={() => run(publishRoundAction({ ...stageRef, roundId: round.id }))}
            >
              {t('competitions.cockpit.publishRound')}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="round-card__error mono" onClick={() => setError(null)}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sections.map((section) => (
          <div key={section.label ?? '__all__'}>
            {section.label ? <div className="fixture-group-label">{section.label}</div> : null}
            {section.fixtures.map((fx) => {
          const home = entryDisplay(sf, event, fx.homeEntryId);
          const away = entryDisplay(sf, event, fx.awayEntryId);
          const isPublished = fx.result?.lifecycle.status === 'published';
          const payload = fx.result?.payload.family === 'score' ? fx.result.payload : null;
          const needsDecider =
            isKnockout && payload !== null && payload.score[0] === payload.score[1] && !fx.isBye;

          if (fx.isBye) {
            const survivor = fx.homeEntryId ? home : away;
            return (
              <div key={fx.id} className="fixture-row fixture-row--bye">
                <span className="mono fixture-code">{survivor.code}</span>
                <span className="fixture-name">{survivor.name}</span>
                <span className="chip" style={{ fontSize: 10 }}>
                  {t('competitions.cockpit.bye')}
                </span>
              </div>
            );
          }

          const slot = (side: 'home' | 'away', d: { name: string; code: string }, id: string | null) =>
            id === null ? (
              <button
                type="button"
                className="chip fixture-tbd"
                onClick={() => setAssignTarget({ ref: refFor(fx), side })}
              >
                {t('competitions.cockpit.tbd')}
              </button>
            ) : (
              <span className="fixture-name" title={d.name}>
                {d.name}
              </span>
            );

          return (
            <div key={fx.id} className="fixture-row">
              <span className="mono fixture-code">{fx.homeEntryId ? home.code : ''}</span>
              {slot('home', home, fx.homeEntryId)}
              <ScoreCells
                fx={fx}
                disabled={isPublished || fx.homeEntryId === null || fx.awayEntryId === null}
                onCommit={(h, a) =>
                  run(
                    enterScore(refFor(fx), {
                      home: h,
                      away: a,
                      decidedBy: 'regulation',
                      shootout: null,
                    }),
                  )
                }
              />
              {slot('away', away, fx.awayEntryId)}
              <span className="mono fixture-code">{fx.awayEntryId ? away.code : ''}</span>

              <span className="fixture-actions">
                {payload && !isPublished && payload.score[0] !== payload.score[1] && isKnockout ? (
                  <button
                    type="button"
                    className={`chip ${payload.decidedBy === 'extra-time' ? 'chip--active' : ''}`}
                    style={{ fontSize: 10 }}
                    title={t('competitions.cockpit.aet')}
                    onClick={() =>
                      run(
                        enterScore(refFor(fx), {
                          home: payload.score[0],
                          away: payload.score[1],
                          decidedBy: payload.decidedBy === 'extra-time' ? 'regulation' : 'extra-time',
                          shootout: null,
                        }),
                      )
                    }
                  >
                    {t('competitions.cockpit.aet')}
                  </button>
                ) : null}
                {payload && isPublished && payload.decidedBy === 'extra-time' ? (
                  <span className="chip" style={{ fontSize: 10 }}>
                    {t('competitions.cockpit.aet')}
                  </span>
                ) : null}
                {payload && isPublished && payload.decidedBy === 'shootout' && payload.shootout ? (
                  <span className="chip mono" style={{ fontSize: 10 }}>
                    {payload.shootout[0]}–{payload.shootout[1]}p
                  </span>
                ) : null}
                {isPublished ? (
                  <button
                    type="button"
                    className="chip fixture-lock"
                    title={t('competitions.cockpit.lockedHint')}
                    onClick={() =>
                      setUnlockTarget({ ref: refFor(fx), label: `${home.name} – ${away.name}` })
                    }
                  >
                    🔒
                  </button>
                ) : fx.result ? (
                  <button
                    type="button"
                    className="chip"
                    style={{ fontSize: 10, cursor: 'pointer' }}
                    title={t('competitions.cockpit.clearResult')}
                    onClick={() => run(clearFixtureResult(refFor(fx)))}
                  >
                    ×
                  </button>
                ) : null}
              </span>

              {needsDecider && !isPublished ? (
                <div className="fixture-decider">
                  <PensCells
                    initial={payload?.shootout ?? null}
                    onApply={(h, a) =>
                      run(
                        enterScore(refFor(fx), {
                          home: payload?.score[0] ?? 0,
                          away: payload?.score[1] ?? 0,
                          decidedBy: 'shootout',
                          shootout: [h, a],
                        }),
                      )
                    }
                  />
                </div>
              ) : null}
            </div>
          );
            })}
          </div>
        ))}
      </div>

      <UnlockResultModal
        open={unlockTarget !== null}
        fixtureLabel={unlockTarget?.label ?? ''}
        onCancel={() => setUnlockTarget(null)}
        onConfirm={(note) => {
          if (unlockTarget) run(unlockResultAction(unlockTarget.ref, note));
          setUnlockTarget(null);
        }}
      />
      <AssignSlotModal
        open={assignTarget !== null}
        sf={sf}
        event={event}
        onCancel={() => setAssignTarget(null)}
        onAssign={(entryId) => {
          if (assignTarget) run(assignSlot(assignTarget.ref, assignTarget.side, entryId));
          setAssignTarget(null);
        }}
      />
    </div>
  );
}
