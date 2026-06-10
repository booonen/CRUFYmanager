import type { Savefile } from '../domain/savefile';
import type { Competition, EntrySeeding } from '../domain/spine';
import type { CompetitionSpec } from '../engine/generate';
import {
  SpineGuardError,
  addCompetition,
  applyGroupAssignment,
  assignFixtureSlot,
  clearResult,
  deleteCompetition,
  forceSeedStage,
  publishResult,
  publishRound,
  renameRound,
  setManualTieOrder,
  setScore,
  setStageRules,
  unlockResult,
  updateEntrySeeding,
  type EventRef,
  type FixtureRef,
  type RoundRef,
  type ScoreInput,
  type StageRef,
  type StageRulesInput,
} from '../engine/mutate';
import { useSavefileStore } from './savefile';

export function useCompetitions(): Competition[] {
  return useSavefileStore((s) => s.savefile?.competitions ?? []);
}

export function useCompetition(id: string | null | undefined): Competition | null {
  return useSavefileStore((s) => {
    if (!id) return null;
    return s.savefile?.competitions.find((c) => c.id === id) ?? null;
  });
}

export type SpineActionResult = { ok: true } | { ok: false; message: string };

/** Guard violations surface as a result, not a crash — the UI shows the message. */
function mutateSpine(fn: (sf: Savefile) => Savefile): SpineActionResult {
  try {
    useSavefileStore.getState().updateSavefile(fn);
    return { ok: true };
  } catch (err) {
    if (err instanceof SpineGuardError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
}

export function createCompetition(spec: CompetitionSpec): { result: SpineActionResult; id: string | null } {
  let id: string | null = null;
  const result = mutateSpine((sf) => {
    const out = addCompetition(sf, spec);
    id = out.competition.id;
    return out.savefile;
  });
  return { result, id };
}

export function removeCompetition(id: string): SpineActionResult {
  return mutateSpine((sf) => deleteCompetition(sf, id));
}

export function enterScore(ref: FixtureRef, input: ScoreInput): SpineActionResult {
  return mutateSpine((sf) => setScore(sf, ref, input));
}

export function clearFixtureResult(ref: FixtureRef): SpineActionResult {
  return mutateSpine((sf) => clearResult(sf, ref));
}

export function publishRoundAction(ref: RoundRef): SpineActionResult {
  return mutateSpine((sf) => publishRound(sf, ref));
}

export function publishResultAction(ref: FixtureRef): SpineActionResult {
  return mutateSpine((sf) => publishResult(sf, ref));
}

export function unlockResultAction(ref: FixtureRef, note: string): SpineActionResult {
  return mutateSpine((sf) => unlockResult(sf, ref, note));
}

export function assignSlot(ref: FixtureRef, side: 'home' | 'away', entryId: string | null): SpineActionResult {
  return mutateSpine((sf) => assignFixtureSlot(sf, ref, side, entryId));
}

export function applyGroups(ref: StageRef, assignment: string[][]): SpineActionResult {
  return mutateSpine((sf) => applyGroupAssignment(sf, ref, assignment));
}

export function saveManualTieOrder(ref: StageRef, order: string[][]): SpineActionResult {
  return mutateSpine((sf) => setManualTieOrder(sf, ref, order));
}

export function updateStageRules(ref: StageRef, input: StageRulesInput): SpineActionResult {
  return mutateSpine((sf) => setStageRules(sf, ref, input));
}

export function renameRoundAction(ref: RoundRef, name: string): SpineActionResult {
  return mutateSpine((sf) => renameRound(sf, ref, name));
}

export function forceSeed(ref: EventRef, targetStageIndex: number): SpineActionResult {
  return mutateSpine((sf) => forceSeedStage(sf, ref, targetStageIndex));
}

export function setEntrySeeding(ref: EventRef, entryId: string, seeding: EntrySeeding): SpineActionResult {
  return mutateSpine((sf) => updateEntrySeeding(sf, ref, entryId, seeding));
}
