import type {
  Competition,
  Entry,
  EntrySeeding,
  Fixture,
  ResultEnvelope,
  Round,
  ScoreDecidedBy,
  SportEvent,
  Stage,
  TiebreakerConfig,
} from '../domain/spine';
import type { Savefile } from '../domain/savefile';
import { newId } from '../utils/ids';
import { buildGroupRounds, createCompetitionFromSpec, type CompetitionSpec } from './generate';
import { reflowEvent } from './qualification';
import {
  ENGINE_VERSION,
  bonusAt,
  eventRatingMax,
  simInputsDigest,
  simulateMatch,
  type SimMatchInput,
} from './simulate';

/**
 * The only write-path for spine data (plan §4.7): published results refuse
 * mutation at this layer, not just in the UI.
 */
export class SpineGuardError extends Error {}

export interface EventRef {
  competitionId: string;
  eventId: string;
}
export interface StageRef extends EventRef {
  stageId: string;
}
export interface RoundRef extends StageRef {
  roundId: string;
}
export interface FixtureRef extends RoundRef {
  fixtureId: string;
}

// Strictly monotonic: integrity checks compare modifiedAt/publishedAt with '>',
// and rapid successive mutations (or tests) can land in the same millisecond.
let lastNowMs = 0;
const nowIso = () => {
  let ms = Date.now();
  if (ms <= lastNowMs) ms = lastNowMs + 1;
  lastNowMs = ms;
  return new Date(ms).toISOString();
};

function mapEvent(sf: Savefile, ref: EventRef, fn: (ev: SportEvent) => SportEvent): Savefile {
  let found = false;
  const competitions = sf.competitions.map((comp) => {
    if (comp.id !== ref.competitionId) return comp;
    const sportEvents = comp.sportEvents.map((ev) => {
      if (ev.id !== ref.eventId) return ev;
      found = true;
      return fn(ev);
    });
    return { ...comp, sportEvents };
  });
  if (!found) throw new SpineGuardError('event not found');
  return { ...sf, competitions };
}

function mapStage(sf: Savefile, ref: StageRef, fn: (stage: Stage, ev: SportEvent) => Stage): Savefile {
  return mapEvent(sf, ref, (ev) => {
    let found = false;
    const stages = ev.stages.map((stage) => {
      if (stage.id !== ref.stageId) return stage;
      found = true;
      return fn(stage, ev);
    });
    if (!found) throw new SpineGuardError('stage not found');
    return { ...ev, stages };
  });
}

function mapFixture(sf: Savefile, ref: FixtureRef, fn: (fx: Fixture, stage: Stage) => Fixture): Savefile {
  return mapStage(sf, ref, (stage) => {
    let found = false;
    const rounds = stage.rounds.map((round) => {
      if (round.id !== ref.roundId) return round;
      const fixtures = round.fixtures.map((fx) => {
        if (fx.id !== ref.fixtureId) return fx;
        found = true;
        return fn(fx, stage);
      });
      return { ...round, fixtures };
    });
    if (!found) throw new SpineGuardError('fixture not found');
    return { ...stage, rounds };
  });
}

function reflow(sf: Savefile, ref: EventRef, forceStageIndex?: number): Savefile {
  return mapEvent(sf, ref, (ev) =>
    reflowEvent(ev, forceStageIndex === undefined ? undefined : { forceStageIndex }),
  );
}

function guardDraft(fx: Fixture): void {
  if (fx.result && fx.result.lifecycle.status === 'published') {
    throw new SpineGuardError('result is published; unlock it first');
  }
}

// ---------------------------------------------------------------------------
// Competitions

export function addCompetition(sf: Savefile, spec: CompetitionSpec): { savefile: Savefile; competition: Competition } {
  const generated = createCompetitionFromSpec(spec);
  // Place rounds on the global calendar: consecutive matchdays from the current
  // one; anything past the season's end stays unscheduled (null).
  let md = sf.calendar.currentMatchday;
  const competition: Competition = {
    ...generated,
    sportEvents: generated.sportEvents.map((ev) => ({
      ...ev,
      stages: ev.stages.map((stage) => ({
        ...stage,
        rounds: stage.rounds.map((round) => {
          const assigned = md <= sf.calendar.matchdaysPerSeason ? md : null;
          md += 1;
          return { ...round, calendarMatchday: assigned };
        }),
      })),
    })),
  };
  const withComp: Savefile = { ...sf, competitions: [...sf.competitions, competition] };
  const event = competition.sportEvents[0];
  const reflowed = event ? reflow(withComp, { competitionId: competition.id, eventId: event.id }) : withComp;
  return { savefile: reflowed, competition };
}

export function deleteCompetition(sf: Savefile, competitionId: string): Savefile {
  return { ...sf, competitions: sf.competitions.filter((c) => c.id !== competitionId) };
}

// ---------------------------------------------------------------------------
// Results

export interface ScoreInput {
  home: number;
  away: number;
  decidedBy: ScoreDecidedBy;
  shootout: [number, number] | null;
}

export function setScore(sf: Savefile, ref: FixtureRef, input: ScoreInput): Savefile {
  const next = mapFixture(sf, ref, (fx) => {
    guardDraft(fx);
    if (!fx.homeEntryId || !fx.awayEntryId) {
      throw new SpineGuardError('both slots must be filled before entering a result');
    }
    if (input.decidedBy === 'shootout' && !input.shootout) {
      throw new SpineGuardError('shootout result missing');
    }
    const payload: ResultEnvelope['payload'] = {
      family: 'score',
      score: [input.home, input.away],
      decidedBy: input.decidedBy,
      shootout: input.decidedBy === 'shootout' ? input.shootout : null,
      detail: null,
    };
    const result: ResultEnvelope = fx.result
      ? { ...fx.result, payload, modifiedAt: nowIso() }
      : {
          id: newId(),
          competitors: [fx.homeEntryId, fx.awayEntryId],
          payload,
          provenance: { method: 'manual', seed: null, engineVersion: null, inputsDigest: null },
          lifecycle: { status: 'draft', publishedAt: null, unlocks: [] },
          modifiedAt: nowIso(),
        };
    return { ...fx, result };
  });
  return reflow(next, ref);
}

export function clearResult(sf: Savefile, ref: FixtureRef): Savefile {
  const next = mapFixture(sf, ref, (fx) => {
    guardDraft(fx);
    return { ...fx, result: null };
  });
  return reflow(next, ref);
}

export function publishResult(sf: Savefile, ref: FixtureRef): Savefile {
  return mapFixture(sf, ref, (fx) => {
    if (!fx.result || fx.result.lifecycle.status === 'published') return fx;
    return {
      ...fx,
      result: {
        ...fx.result,
        lifecycle: { ...fx.result.lifecycle, status: 'published', publishedAt: nowIso() },
      },
    };
  });
}

export function publishRound(sf: Savefile, ref: RoundRef): Savefile {
  return mapStage(sf, ref, (stage) => ({
    ...stage,
    rounds: stage.rounds.map((round) => {
      if (round.id !== ref.roundId) return round;
      const at = nowIso();
      return {
        ...round,
        fixtures: round.fixtures.map((fx) =>
          fx.result && fx.result.lifecycle.status === 'draft'
            ? { ...fx, result: { ...fx.result, lifecycle: { ...fx.result.lifecycle, status: 'published', publishedAt: at } } }
            : fx,
        ),
      };
    }),
  }));
}

export function unlockResult(sf: Savefile, ref: FixtureRef, note: string): Savefile {
  if (!note.trim()) throw new SpineGuardError('an unlock needs a note');
  return mapFixture(sf, ref, (fx) => {
    if (!fx.result || fx.result.lifecycle.status !== 'published') {
      throw new SpineGuardError('result is not published');
    }
    return {
      ...fx,
      result: {
        ...fx.result,
        lifecycle: {
          status: 'draft',
          publishedAt: null,
          unlocks: [...fx.result.lifecycle.unlocks, { at: nowIso(), note: note.trim() }],
        },
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Simulation (Phase 3)

function locate(sf: Savefile, ref: FixtureRef) {
  const comp = sf.competitions.find((c) => c.id === ref.competitionId);
  const event = comp?.sportEvents.find((e) => e.id === ref.eventId);
  const stage = event?.stages.find((s) => s.id === ref.stageId);
  const round = stage?.rounds.find((r) => r.id === ref.roundId);
  const fixture = round?.fixtures.find((f) => f.id === ref.fixtureId);
  if (!comp || !event || !stage || !round || !fixture) {
    throw new SpineGuardError('fixture not found');
  }
  return { comp, event, stage, round, fixture };
}

/** Everything the engine sees for this fixture — also used for drift warnings. */
export function simInputForFixture(sf: Savefile, ref: FixtureRef): SimMatchInput {
  const { event, stage, round, fixture } = locate(sf, ref);
  const home = event.entries.find((e) => e.id === fixture.homeEntryId);
  const away = event.entries.find((e) => e.id === fixture.awayEntryId);
  if (!home || !away) {
    throw new SpineGuardError('both slots must be filled before simming');
  }
  const md = round.calendarMatchday;
  return {
    homeRating: home.seeding + bonusAt(home, md),
    awayRating: away.seeding + bonusAt(away, md),
    homeStyle: home.styleMod,
    awayStyle: away.styleMod,
    ratingMax: eventRatingMax(event),
    params: sf.scorination.sim,
    knockout: stage.format.kind === 'knockout' || stage.format.kind === 'single-match',
  };
}

/** Fresh-seed sim (or re-roll on a draft). Never publishes; reflows downstream. */
export function simFixture(sf: Savefile, ref: FixtureRef): Savefile {
  const input = simInputForFixture(sf, ref);
  const seed = newId();
  const out = simulateMatch(input, seed);
  const next = mapFixture(sf, ref, (fx) => {
    guardDraft(fx);
    if (fx.isBye) throw new SpineGuardError('byes have no result');
    if (!fx.homeEntryId || !fx.awayEntryId) {
      throw new SpineGuardError('both slots must be filled before simming');
    }
    const payload: ResultEnvelope['payload'] = {
      family: 'score',
      score: [out.home, out.away],
      decidedBy: out.decidedBy,
      shootout: out.shootout,
      detail: null,
    };
    const provenance: ResultEnvelope['provenance'] = {
      method: 'sim',
      seed,
      engineVersion: ENGINE_VERSION,
      inputsDigest: simInputsDigest(input),
    };
    const result: ResultEnvelope = fx.result
      ? { ...fx.result, payload, provenance, modifiedAt: nowIso() }
      : {
          id: newId(),
          competitors: [fx.homeEntryId, fx.awayEntryId],
          payload,
          provenance,
          lifecycle: { status: 'draft', publishedAt: null, unlocks: [] },
          modifiedAt: nowIso(),
        };
    return { ...fx, result };
  });
  return reflow(next, ref);
}

/** Sims only the round's untouched fixtures — manual/dictated drafts stay. */
export function simRoundEmpties(sf: Savefile, ref: RoundRef): Savefile {
  let current = sf;
  const stage = current.competitions
    .find((c) => c.id === ref.competitionId)
    ?.sportEvents.find((e) => e.id === ref.eventId)
    ?.stages.find((s) => s.id === ref.stageId);
  const target = stage?.rounds.find((r) => r.id === ref.roundId);
  if (!target) throw new SpineGuardError('round not found');
  for (const fx of target.fixtures) {
    if (fx.isBye || fx.result !== null || !fx.homeEntryId || !fx.awayEntryId) continue;
    current = simFixture(current, { ...ref, fixtureId: fx.id });
  }
  return current;
}

// ---------------------------------------------------------------------------
// Bonus ledger (host-computed values; phase-3 Q3)

export interface BonusInput {
  matchday: number | null;
  value: number;
  note: string;
}

export function upsertBonus(sf: Savefile, ref: EventRef, entryId: string, input: BonusInput): Savefile {
  return mapEvent(sf, ref, (ev) => ({
    ...ev,
    entries: ev.entries.map((entry): Entry => {
      if (entry.id !== entryId) return entry;
      const existing = entry.bonus.find((b) => b.matchday === input.matchday);
      const bonus = existing
        ? entry.bonus.map((b) =>
            b.id === existing.id ? { ...b, value: input.value, note: input.note } : b,
          )
        : [...entry.bonus, { id: newId(), matchday: input.matchday, value: input.value, note: input.note }];
      return { ...entry, bonus };
    }),
  }));
}

export function removeBonus(sf: Savefile, ref: EventRef, entryId: string, bonusId: string): Savefile {
  return mapEvent(sf, ref, (ev) => ({
    ...ev,
    entries: ev.entries.map((entry): Entry =>
      entry.id === entryId ? { ...entry, bonus: entry.bonus.filter((b) => b.id !== bonusId) } : entry,
    ),
  }));
}

/** Bulk import: one matchday, many teams ("CODE, value" paste resolved upstream). */
export function importBonusValues(
  sf: Savefile,
  ref: EventRef,
  matchday: number | null,
  rows: { entryId: string; value: number }[],
): Savefile {
  let current = sf;
  for (const row of rows) {
    current = upsertBonus(current, ref, row.entryId, { matchday, value: row.value, note: '' });
  }
  return current;
}

export function setEntryStyle(sf: Savefile, ref: EventRef, entryId: string, styleMod: number): Savefile {
  if (styleMod < -5 || styleMod > 5) {
    throw new SpineGuardError('style modifier must be between −5 and +5');
  }
  return mapEvent(sf, ref, (ev) => ({
    ...ev,
    entries: ev.entries.map((entry): Entry => (entry.id === entryId ? { ...entry, styleMod } : entry)),
  }));
}

export function setEventRatingMax(sf: Savefile, ref: EventRef, value: number | null): Savefile {
  if (value !== null && value <= 0) {
    throw new SpineGuardError('rating scale max must be positive');
  }
  return mapEvent(sf, ref, (ev) => ({ ...ev, ratingMax: value }));
}

// ---------------------------------------------------------------------------
// Structure

export function assignFixtureSlot(
  sf: Savefile,
  ref: FixtureRef,
  side: 'home' | 'away',
  entryId: string | null,
): Savefile {
  let tieInfo: { tieId: string; tieSide: 'home' | 'away' } | null = null;
  let next = mapFixture(sf, ref, (fx) => {
    if (fx.result) throw new SpineGuardError('clear the result before changing slots');
    if (fx.tieId) {
      const tieSide = fx.leg === 2 ? (side === 'home' ? 'away' : 'home') : side;
      tieInfo = { tieId: fx.tieId, tieSide };
      return fx; // occupant flows from the tie feed via reflow
    }
    return side === 'home' ? { ...fx, homeEntryId: entryId } : { ...fx, awayEntryId: entryId };
  });
  const info = tieInfo as { tieId: string; tieSide: 'home' | 'away' } | null;
  if (info) {
    next = mapStage(next, ref, (stage) => {
      if (!stage.bracket) return stage;
      return {
        ...stage,
        bracket: {
          ties: stage.bracket.ties.map((tie) => {
            if (tie.id !== info.tieId) return tie;
            const feed = entryId ? ({ kind: 'entry', entryId } as const) : ({ kind: 'tbd' } as const);
            return info.tieSide === 'home' ? { ...tie, home: feed } : { ...tie, away: feed };
          }),
        },
      };
    });
    // The feed override must land on fixtures even though occupants were set before.
    next = mapStage(next, ref, (stage) => ({
      ...stage,
      rounds: stage.rounds.map((round) => ({
        ...round,
        fixtures: round.fixtures.map((fx) => {
          if (fx.tieId !== info.tieId || fx.result) return fx;
          const fxSide = fx.leg === 2 ? (info.tieSide === 'home' ? 'away' : 'home') : info.tieSide;
          return fxSide === 'home' ? { ...fx, homeEntryId: entryId } : { ...fx, awayEntryId: entryId };
        }),
      })),
    }));
  }
  return reflow(next, ref);
}

export function applyGroupAssignment(sf: Savefile, ref: StageRef, assignment: string[][]): Savefile {
  const next = mapStage(sf, ref, (stage) => {
    if (stage.format.kind !== 'groups') throw new SpineGuardError('not a groups stage');
    const hasResults = stage.rounds.some((r) => r.fixtures.some((fx) => fx.result !== null));
    if (hasResults) throw new SpineGuardError('groups are locked once results exist');
    if (assignment.length !== stage.groups.length) {
      throw new SpineGuardError('group count mismatch');
    }
    const groups = stage.groups.map((g, i) => ({ ...g, entryIds: assignment[i] ?? [] }));
    return {
      ...stage,
      groups,
      entryIds: assignment.flat(),
      rounds: buildGroupRounds(groups, stage.format.legs),
      manualTieOrder: [],
    };
  });
  return reflow(next, ref);
}

export function setManualTieOrder(sf: Savefile, ref: StageRef, order: string[][]): Savefile {
  return mapStage(sf, ref, (stage) => ({ ...stage, manualTieOrder: order }));
}

export interface StageRulesInput {
  points?: { win: number; draw: number; loss: number };
  tiebreakers?: TiebreakerConfig;
  awayGoals?: boolean;
}

export function setStageRules(sf: Savefile, ref: StageRef, input: StageRulesInput): Savefile {
  const next = mapStage(sf, ref, (stage) => {
    let format = stage.format;
    if (input.awayGoals !== undefined && format.kind === 'knockout') {
      format = { ...format, awayGoals: input.awayGoals };
    }
    return {
      ...stage,
      format,
      points: input.points ?? stage.points,
      tiebreakers: input.tiebreakers ?? stage.tiebreakers,
    };
  });
  return reflow(next, ref);
}

export function setRoundMatchday(sf: Savefile, ref: RoundRef, matchday: number | null): Savefile {
  if (matchday !== null && (matchday < 1 || matchday > sf.calendar.matchdaysPerSeason)) {
    throw new SpineGuardError(`matchday must be 1–${sf.calendar.matchdaysPerSeason} (or unscheduled)`);
  }
  // The past is history: rounds already behind the current matchday stay put,
  // and nothing new may be scheduled before today.
  if (matchday !== null && matchday < sf.calendar.currentMatchday) {
    throw new SpineGuardError('cannot schedule into a past matchday');
  }
  return mapStage(sf, ref, (stage) => ({
    ...stage,
    rounds: stage.rounds.map((round): Round => {
      if (round.id !== ref.roundId) return round;
      if (round.calendarMatchday !== null && round.calendarMatchday < sf.calendar.currentMatchday) {
        throw new SpineGuardError('past matchdays are locked');
      }
      return { ...round, calendarMatchday: matchday };
    }),
  }));
}

export function renameRound(sf: Savefile, ref: RoundRef, name: string): Savefile {
  return mapStage(sf, ref, (stage) => ({
    ...stage,
    rounds: stage.rounds.map((round): Round => (round.id === ref.roundId ? { ...round, name } : round)),
  }));
}

export function forceSeedStage(sf: Savefile, ref: EventRef, targetStageIndex: number): Savefile {
  return reflow(sf, ref, targetStageIndex);
}

// ---------------------------------------------------------------------------
// Entries

export function updateEntrySeeding(sf: Savefile, ref: EventRef, entryId: string, seeding: EntrySeeding): Savefile {
  return mapEvent(sf, ref, (ev) => ({
    ...ev,
    entries: ev.entries.map((e): Entry => (e.id === entryId ? { ...e, seeding } : e)),
  }));
}

export function removeEntry(sf: Savefile, ref: EventRef, entryId: string): Savefile {
  return mapEvent(sf, ref, (ev) => {
    const referenced = ev.stages.some(
      (stage) =>
        stage.groups.some((g) => g.entryIds.includes(entryId)) ||
        stage.entryIds.includes(entryId) ||
        stage.rounds.some((round) =>
          round.fixtures.some(
            (fx) =>
              fx.homeEntryId === entryId ||
              fx.awayEntryId === entryId ||
              (fx.result?.competitors.includes(entryId) ?? false),
          ),
        ),
    );
    if (referenced) {
      throw new SpineGuardError('entry is part of the schedule; it cannot be removed');
    }
    return { ...ev, entries: ev.entries.filter((e) => e.id !== entryId) };
  });
}
