import type { Savefile } from '../domain/savefile';
import type { Competition, Fixture, Round, Stage } from '../domain/spine';
import { createBlankSavefile } from '../domain/factory';
import { addCompetition, setScore, type FixtureRef, type ScoreInput } from './mutate';
import type { CompetitionSpec, EntryInput } from './generate';

export function mkSave(): Savefile {
  return createBlankSavefile({ countryName: 'Testland', countryShortCode: 'TST', matchdaysPerSeason: 10 });
}

/** n ad-hoc entries with descending seeding ratings (Nation 1 strongest). */
export function adHocEntries(n: number): EntryInput[] {
  return Array.from({ length: n }, (_, i) => ({
    participant: { kind: 'ad-hoc' as const, name: `Nation ${i + 1}`, shortCode: `N${i + 1}` },
    seeding: n - i,
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

/** 1-based seed position of an entry (1 = highest rating) — for assertions. */
export function seedPos(sf: Savefile, competitionId: string, entryId: string): number {
  const event = getComp(sf, competitionId).sportEvents[0];
  if (!event) throw new Error('no event');
  const entry = event.entries.find((e) => e.id === entryId);
  if (!entry) throw new Error('entry not found');
  return 1 + event.entries.filter((e) => e.seeding > entry.seeding).length;
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
 * over the sides' seed positions (default: better-seeded side wins 2–0).
 * Returns the updated savefile.
 */
export function fillStage(
  sf: Savefile,
  competitionId: string,
  stageIndex: number,
  scoreFn?: (homeSeedPos: number, awaySeedPos: number) => ScoreInput,
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
          seedPos(current, competitionId, fx.homeEntryId),
          seedPos(current, competitionId, fx.awayEntryId),
        );
        current = setScore(current, ref, input);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return current;
}
