import { useEffect, useMemo, useState } from 'react';
import type { Savefile } from '../domain/savefile';
import type { Competition, SportEvent, Stage } from '../domain/spine';
import type { StageRef } from '../engine/mutate';
import { STATUS_GLYPH, compactRoundLabel, roundStatus } from '../engine/calendar';
import {
  computeGroupTablesThrough,
  computeOverallTableThrough,
  stageComplete,
} from '../engine/qualification';
import { stageTablesBBCode } from '../export/bbcode';
import { t } from '../lang';
import { forceSeed, saveManualTieOrder, updateStageRules } from '../stores/competitions';
import { copyText } from '../utils/clipboard';
import { BracketView } from './BracketView';
import { Button } from './Button';
import { GroupDrawModal } from './GroupDrawModal';
import { ManualTieOrderModal } from './ManualTieOrderModal';
import { Modal } from './Modal';
import { NumberInput } from './NumberInput';
import { RoundCard } from './RoundCard';
import { StandingsTable } from './StandingsTable';

interface CompetitionStageViewProps {
  sf: Savefile;
  competition: Competition;
  event: SportEvent;
  stage: Stage;
  stageIndex: number;
  /** Deep-link target (e.g. from the calendar): focus this round on mount/update. */
  initialFocusRoundId?: string | null;
}

type TbPreset = 'default' | 'h2hFirst' | 'withGf';

const TB_ORDERS: Record<TbPreset, ('gd' | 'gf' | 'h2h')[]> = {
  default: ['gd', 'h2h'],
  h2hFirst: ['h2h', 'gd'],
  withGf: ['gd', 'gf', 'h2h'],
};

function presetOf(stage: Stage): TbPreset {
  const order = stage.tiebreakers.order.join(',');
  if (order === TB_ORDERS.h2hFirst.join(',')) return 'h2hFirst';
  if (order === TB_ORDERS.withGf.join(',')) return 'withGf';
  return 'default';
}

export function CompetitionStageView({
  sf,
  competition,
  event,
  stage,
  stageIndex,
  initialFocusRoundId,
}: CompetitionStageViewProps) {
  const stageRef: StageRef = { competitionId: competition.id, eventId: event.id, stageId: stage.id };
  const [drawOpen, setDrawOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tieTarget, setTieTarget] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const isKnockout = stage.format.kind === 'knockout';
  const isGroups = stage.format.kind === 'groups';

  // Matchday focus: the host steps through the schedule at their own pace.
  const [focusedRoundId, setFocusedRoundId] = useState<string | null>(initialFocusRoundId ?? null);
  useEffect(() => {
    if (initialFocusRoundId) setFocusedRoundId(initialFocusRoundId);
  }, [initialFocusRoundId]);
  const focusedRound = useMemo(() => {
    const byId = stage.rounds.find((r) => r.id === focusedRoundId);
    if (byId) return byId;
    return stage.rounds.find((r) => roundStatus(r) === 'empty' || roundStatus(r) === 'partial') ?? stage.rounds.at(-1) ?? null;
  }, [stage, focusedRoundId]);

  const groupTables = useMemo(
    () => (isGroups && focusedRound ? computeGroupTablesThrough(stage, focusedRound.index) : null),
    [isGroups, stage, focusedRound],
  );
  const overallTable = useMemo(
    () =>
      stage.format.kind === 'league' && focusedRound
        ? computeOverallTableThrough(stage, focusedRound.index)
        : null,
    [stage, focusedRound],
  );

  const qualifyCount = stage.qualification.find((q) => q.kind === 'top-n-per-group')?.n ?? 0;
  const hasResults = stage.rounds.some((r) => r.fixtures.some((fx) => fx.result !== null));
  const previousStage = stageIndex > 0 ? event.stages[stageIndex - 1] : undefined;
  const hasOpenSlots = stage.rounds.some((r) =>
    r.fixtures.some((fx) => !fx.isBye && (fx.homeEntryId === null || fx.awayEntryId === null)),
  );
  const canForceSeed = isKnockout && hasOpenSlots && previousStage !== undefined && !stageComplete(previousStage);

  const applyTieOrder = (ordered: string[]) => {
    const tiedSet = new Set(ordered);
    const kept = stage.manualTieOrder.filter((arr) => !arr.some((id) => tiedSet.has(id)));
    saveManualTieOrder(stageRef, [...kept, ordered]);
    setTieTarget(null);
  };

  const copyTables = async () => {
    const ok = await copyText(stageTablesBBCode(sf, event, stage));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <>
      <div className="round-rail">
        {stage.rounds.map((round) => {
          const status = roundStatus(round);
          const active = focusedRound?.id === round.id;
          return (
            <button
              key={round.id}
              type="button"
              className={`chip round-rail__chip ${active ? 'chip--active' : ''}`}
              title={round.name}
              onClick={() => setFocusedRoundId(round.id)}
            >
              <span className={`round-rail__glyph round-rail__glyph--${status}`}>{STATUS_GLYPH[status]}</span>
              {compactRoundLabel(stage, round)}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 380px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isGroups && !hasResults ? (
            <Button size="sm" onClick={() => setDrawOpen(true)}>
              {t('competitions.cockpit.drawGroups')}
            </Button>
          ) : null}
          {isGroups && hasResults ? (
            <span className="chip" style={{ fontSize: 11 }}>
              {t('competitions.cockpit.groupsLocked')}
            </span>
          ) : null}
          {!isKnockout ? (
            <Button size="sm" onClick={() => void copyTables()}>
              {copied ? t('common.copied') : t('competitions.cockpit.copyTables')}
            </Button>
          ) : null}
          {canForceSeed ? (
            <Button size="sm" title={t('competitions.cockpit.seedNowHint')} onClick={() => forceSeed(stageRef, stageIndex)}>
              {t('competitions.cockpit.seedNow')}
            </Button>
          ) : null}
          {!isKnockout && stage.format.kind !== 'single-match' ? (
            <Button size="sm" onClick={() => setRulesOpen(true)}>
              {t('competitions.cockpit.stageRules')}
            </Button>
          ) : null}
          {stage.format.kind === 'knockout' && stage.format.legs === 2 ? (
            <Button size="sm" onClick={() => setRulesOpen(true)}>
              {t('competitions.cockpit.stageRules')}
            </Button>
          ) : null}
        </div>

        {(isGroups || stage.format.kind === 'league') && focusedRound ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {t('competitions.cockpit.afterRound', { round: focusedRound.name })}
          </div>
        ) : null}

        {isGroups && groupTables ? (
          <div className="standings-grid">
            {stage.groups.map((group) => (
              <StandingsTable
                key={group.id}
                sf={sf}
                event={event}
                title={group.name}
                rows={groupTables.get(group.id) ?? []}
                qualifyCount={qualifyCount}
                onResolveTie={(ids) => setTieTarget(ids)}
              />
            ))}
          </div>
        ) : null}

        {overallTable ? (
          <StandingsTable
            sf={sf}
            event={event}
            title={stage.name}
            rows={overallTable}
            qualifyCount={stage.qualification.find((q) => q.kind === 'top-n-overall')?.n ?? 0}
            onResolveTie={(ids) => setTieTarget(ids)}
          />
        ) : null}

        {(isKnockout || stage.format.kind === 'single-match') && stage.bracket ? (
          <BracketView sf={sf} event={event} stage={stage} />
        ) : null}
      </div>

      <div style={{ flex: '1 1 420px', minWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {focusedRound ? (
          <RoundCard
            key={focusedRound.id}
            sf={sf}
            event={event}
            stage={stage}
            round={focusedRound}
            stageRef={stageRef}
          />
        ) : null}
      </div>
      </div>

      {isGroups ? (
        <GroupDrawModal
          open={drawOpen}
          sf={sf}
          event={event}
          stage={stage}
          stageRef={stageRef}
          onClose={() => setDrawOpen(false)}
        />
      ) : null}
      <ManualTieOrderModal
        open={tieTarget !== null}
        sf={sf}
        event={event}
        tiedEntryIds={tieTarget ?? []}
        onCancel={() => setTieTarget(null)}
        onApply={applyTieOrder}
      />
      <StageRulesModal
        open={rulesOpen}
        stage={stage}
        stageRef={stageRef}
        onClose={() => setRulesOpen(false)}
      />
    </>
  );
}

function StageRulesModal({
  open,
  stage,
  stageRef,
  onClose,
}: {
  open: boolean;
  stage: Stage;
  stageRef: StageRef;
  onClose: () => void;
}) {
  const koFormat = stage.format.kind === 'knockout' ? stage.format : null;
  const tbPreset = presetOf(stage);

  return (
    <Modal
      open={open}
      title={t('competitions.cockpit.stageRules')}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      <div className="form-grid">
        {!koFormat ? (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">{t('competitions.cockpit.pointsWin')}</label>
                <NumberInput
                  className="input"
                  value={stage.points.win}
                  min={0}
                  max={10}
                  onCommit={(win) => updateStageRules(stageRef, { points: { ...stage.points, win } })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">{t('competitions.cockpit.pointsDraw')}</label>
                <NumberInput
                  className="input"
                  value={stage.points.draw}
                  min={0}
                  max={10}
                  onCommit={(draw) => updateStageRules(stageRef, { points: { ...stage.points, draw } })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label">{t('competitions.cockpit.pointsLoss')}</label>
                <NumberInput
                  className="input"
                  value={stage.points.loss}
                  min={0}
                  max={10}
                  onCommit={(loss) => updateStageRules(stageRef, { points: { ...stage.points, loss } })}
                />
              </div>
            </div>
            <div className="field">
              <label className="field__label">{t('competitions.cockpit.tiebreakers')}</label>
              <select
                className="select"
                value={tbPreset}
                onChange={(e) => {
                  const key = e.target.value as TbPreset;
                  updateStageRules(stageRef, { tiebreakers: { order: [...TB_ORDERS[key]] } });
                }}
              >
                <option value="default">{t('competitions.cockpit.tbDefault')}</option>
                <option value="h2hFirst">{t('competitions.cockpit.tbH2hFirst')}</option>
                <option value="withGf">{t('competitions.cockpit.tbWithGf')}</option>
              </select>
            </div>
          </>
        ) : null}
        {koFormat && koFormat.legs === 2 ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={koFormat.awayGoals}
              onChange={(e) => updateStageRules(stageRef, { awayGoals: e.target.checked })}
            />
            {t('competitions.cockpit.awayGoals')}
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
