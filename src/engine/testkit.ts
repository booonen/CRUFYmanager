import type { Savefile } from '../domain/savefile';
import type { Competition, Fixture, Round, Stage } from '../domain/spine';
import { createBlankSavefile } from '../domain/factory';
import { addCompetition, setScore, type FixtureRef, type ScoreInput } from './mutate';
import type { CompetitionSpec, EntryInput } from './generate';

export function mkSave(): Savefile {
  return createBlankSavefile({ countryName: 'Testland', countryShortCode: 'TST', matchdaysPerSeason: 10 });
}

/** n ad-hoc entries ranked 1..n (1 strongest). */
export function adHocEntries(n: number): EntryInput[] {
  return Array.from({ length: n }, (_, i) => ({
    participant: { kind: 'ad-hoc' as const, name: `Nation ${i + 1}`, shortCode: `N${i + 1}` },
    seeding: { mode: 'rank' as const, value: i + 1 },
  }));
}

export function setUp(spec: CompetitionSpec): { sf: Savefile; competitionId: string } {
  const { savefile, competition } = addCompetition(mkSave(), spec);
  return { sf: savefile, competitionId: competition.id };
}

export function getComp(sf: Savefile, competitionId: string): Competition {
  const comp = sf.competitions.find((c) => c.id === competitionId);
  if (!comp) throw new Error('competition vanished');
  return comp;
}

export function refFor(
  sf: Savefile,
  competitionId: string,
  stage: Stage,
  round: Round,
  fixture: Fixture,
): FixtureRef {
  const comp = getComp(sf, competitionId);
  const event = comp.sportEvents[0];
  if (!event) throw new Error('no event');
  return {
    competitionId,
    eventId: event.id,
    stageId: stage.id,
    roundId: round.id,
    fixtureId: fixture.id,
  };
}

/** Rank of an entry (its seeding value) — used to derive deterministic scores. */
export function rankOf(sf: Savefile, competitionId: string, entryId: string): number {
  const event = getComp(sf, competitionId).sportEvents[0];
  const entry = event?.entries.find((e) => e.id === entryId);
  if (!entry) throw new Error('entry not found');
  return entry.seeding.value;
}

export function entryName(sf: Savefile, competitionId: string, entryId: string | null): string {
  if (!entryId) return '—';
  const event = getComp(sf, competitionId).sportEvents[0];
  const entry = event?.entries.find((e) => e.id === entryId);
  if (!entry) return '?';
  return entry.participant.kind === 'ad-hoc' ? entry.participant.name : entry.participant.kind;
}

/**
 * Fills every open fixture of the stage (by index) with scores from scoreFn
 * (default: better rank wins 2–0). Returns the updated savefile.
 */
export function fillStage(
  sf: Savefile,
  competitionId: string,
  stageIndex: number,
  scoreFn?: (homeRank: number, awayRank: number) => ScoreInput,
): Savefile {
  let current = sf;
  const fn =
    scoreFn ??
    ((h: number, a: number): ScoreInput =>
      h < a
        ? { home: 2, away: 0, decidedBy: 'regulation', shootout: null }
        : { home: 0, away: 2, decidedBy: 'regulation', shootout: null });

  // Re-read the structure after every mutation; propagation may fill new slots.
  for (let pass = 0; pass < 12; pass++) {
    let progressed = false;
    const stage = getComp(current, competitionId).sportEvents[0]?.stages[stageIndex];
    if (!stage) throw new Error('stage not found');
    for (const round of stage.rounds) {
      for (const fx of round.fixtures) {
        if (fx.isBye || fx.result || !fx.homeEntryId || !fx.awayEntryId) continue;
        const ref = refFor(current, competitionId, stage, round, fx);
        const input = fn(
          rankOf(current, competitionId, fx.homeEntryId),
          rankOf(current, competitionId, fx.awayEntryId),
        );
        current = setScore(current, ref, input);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return current;
}
