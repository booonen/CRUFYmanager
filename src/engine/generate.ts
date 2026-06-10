import type {
  BracketTie,
  Competition,
  Entry,
  EntrySeeding,
  Fixture,
  Group,
  ParticipantRef,
  QualRule,
  Round,
  SportEvent,
  Stage,
  TieFeed,
} from '../domain/spine';
import { DEFAULT_POINTS, DEFAULT_TIEBREAKERS } from '../domain/spine';
import { t } from '../lang';
import { newId } from '../utils/ids';
import { orderEntriesBySeeding } from './qualification';
import { generateRoundRobin } from './roundrobin';

export interface EntryInput {
  participant: ParticipantRef;
  seeding: EntrySeeding;
}

export type CompetitionPreset =
  | { kind: 'league'; legs: 1 | 2 }
  | {
      kind: 'groups-knockout';
      groupCount: number;
      legs: 1 | 2;
      qualifyPerGroup: number;
      bestOfPlace: { place: number; count: number } | null;
      koLegs: 1 | 2;
      thirdPlace: boolean;
      awayGoals: boolean;
    }
  | { kind: 'knockout'; legs: 1 | 2; thirdPlace: boolean; awayGoals: boolean; pairing: 'ranked' | 'manual' }
  | { kind: 'single-match' };

export interface CompetitionSpec {
  name: string;
  shortName: string;
  preset: CompetitionPreset;
  entries: EntryInput[];
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Classic bracket seed placement: 1 meets 2 only in the final. */
export function bracketSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const doubled = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s, doubled + 1 - s);
    }
    order = next;
  }
  return order;
}

const mkFixture = (partial: Partial<Fixture>): Fixture => ({
  id: newId(),
  homeEntryId: null,
  awayEntryId: null,
  groupId: null,
  tieId: null,
  leg: null,
  isBye: false,
  result: null,
  ...partial,
});

const mkRound = (index: number, name: string, fixtures: Fixture[]): Round => ({
  id: newId(),
  index,
  name,
  calendarMatchday: null, // assigned from the global calendar in addCompetition
  fixtures,
});

const baseStage = (name: string, format: Stage['format']): Stage => ({
  id: newId(),
  name,
  format,
  entryIds: [],
  groups: [],
  rounds: [],
  qualification: [],
  pairing: 'ranked',
  points: { ...DEFAULT_POINTS },
  tiebreakers: { order: [...DEFAULT_TIEBREAKERS.order] },
  manualTieOrder: [],
  bracket: null,
});

function phaseName(tieCount: number): string {
  if (tieCount === 1) return t('spine.phase.final');
  if (tieCount === 2) return t('spine.phase.semifinals');
  if (tieCount === 4) return t('spine.phase.quarterfinals');
  return t('spine.phase.roundOf', { n: tieCount * 2 });
}

function buildLeagueStage(name: string, entryIds: string[], legs: 1 | 2): Stage {
  const stage = baseStage(name, { kind: 'league', legs });
  stage.entryIds = entryIds;
  stage.rounds = generateRoundRobin(entryIds, legs).map((pairings, i) =>
    mkRound(
      i,
      t('spine.matchday', { n: i + 1 }),
      pairings.map((p) => mkFixture({ homeEntryId: p.home, awayEntryId: p.away })),
    ),
  );
  return stage;
}

/** Snake-distributes seeded entries into G groups (pot 1 spread first, then reversed, …). */
export function snakeGroups(orderedEntryIds: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  orderedEntryIds.forEach((id, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    const g = row % 2 === 0 ? col : groupCount - 1 - col;
    groups[g]?.push(id);
  });
  return groups;
}

/** Per-group round robins merged into shared matchdays. Used at generation and on re-draws. */
export function buildGroupRounds(groups: Group[], legs: 1 | 2): Round[] {
  const perGroupRounds = groups.map((g) => generateRoundRobin(g.entryIds, legs));
  const roundCount = Math.max(0, ...perGroupRounds.map((r) => r.length));
  const rounds: Round[] = [];
  for (let r = 0; r < roundCount; r++) {
    const fixtures: Fixture[] = [];
    groups.forEach((group, gi) => {
      for (const p of perGroupRounds[gi]?.[r] ?? []) {
        fixtures.push(mkFixture({ homeEntryId: p.home, awayEntryId: p.away, groupId: group.id }));
      }
    });
    rounds.push(mkRound(r, t('spine.matchday', { n: r + 1 }), fixtures));
  }
  return rounds;
}

function buildGroupsStage(
  name: string,
  groupAssignment: string[][],
  legs: 1 | 2,
  qualification: QualRule[],
  pairing: Stage['pairing'],
): Stage {
  const stage = baseStage(name, { kind: 'groups', legs });
  stage.qualification = qualification;
  stage.pairing = pairing;
  stage.entryIds = groupAssignment.flat();
  stage.groups = groupAssignment.map(
    (entryIds, i): Group => ({
      id: newId(),
      name: t('spine.group', { letter: String.fromCharCode(65 + i) }),
      entryIds,
    }),
  );
  stage.rounds = buildGroupRounds(stage.groups, legs);
  return stage;
}

/** Standard-cross feed patterns (top-2 qualifiers), FIFA-style halves. */
function standardCrossFeeds(groupCount: 2 | 4 | 8): [TieFeed, TieFeed][] {
  const q = (groupIndex: number, place: number): TieFeed => ({ kind: 'group-qualifier', groupIndex, place });
  if (groupCount === 2) {
    return [
      [q(0, 1), q(1, 2)],
      [q(1, 1), q(0, 2)],
    ];
  }
  if (groupCount === 4) {
    return [
      [q(0, 1), q(1, 2)],
      [q(2, 1), q(3, 2)],
      [q(1, 1), q(0, 2)],
      [q(3, 1), q(2, 2)],
    ];
  }
  return [
    [q(0, 1), q(1, 2)],
    [q(2, 1), q(3, 2)],
    [q(4, 1), q(5, 2)],
    [q(6, 1), q(7, 2)],
    [q(1, 1), q(0, 2)],
    [q(3, 1), q(2, 2)],
    [q(5, 1), q(4, 2)],
    [q(7, 1), q(6, 2)],
  ];
}

/** Ranked feeds for N participants padded to the bracket size with byes (top seeds rest). */
function rankedFeeds(
  participantCount: number,
  size: number,
  toFeed: (position: number) => TieFeed,
): [TieFeed, TieFeed][] {
  const order = bracketSeedOrder(size);
  const feeds: [TieFeed, TieFeed][] = [];
  for (let i = 0; i < size; i += 2) {
    const a = order[i] ?? 1;
    const b = order[i + 1] ?? size;
    // Seed order pairs low vs high, so a potential bye always lands on the away side.
    feeds.push([
      a <= participantCount ? toFeed(a) : { kind: 'bye' },
      b <= participantCount ? toFeed(b) : { kind: 'bye' },
    ]);
  }
  return feeds;
}

interface KnockoutOptions {
  name: string;
  size: number; // power of two
  legs: 1 | 2;
  thirdPlace: boolean;
  awayGoals: boolean;
  pairing: Stage['pairing'];
  phase0Feeds: [TieFeed, TieFeed][];
}

function buildKnockoutStage(opts: KnockoutOptions): Stage {
  const stage = baseStage(opts.name, {
    kind: 'knockout',
    legs: opts.legs,
    thirdPlace: opts.thirdPlace,
    awayGoals: opts.awayGoals,
  });
  stage.pairing = opts.pairing;

  const phaseCount = Math.log2(opts.size);
  const ties: BracketTie[] = [];
  let previousPhase: BracketTie[] = [];

  for (let phase = 0; phase < phaseCount; phase++) {
    const tieCount = opts.size / 2 ** (phase + 1);
    const current: BracketTie[] = [];
    for (let slot = 0; slot < tieCount; slot++) {
      let home: TieFeed;
      let away: TieFeed;
      if (phase === 0) {
        const feeds = opts.phase0Feeds[slot] ?? [{ kind: 'tbd' }, { kind: 'tbd' }];
        [home, away] = feeds;
      } else {
        const feederA = previousPhase[slot * 2];
        const feederB = previousPhase[slot * 2 + 1];
        home = feederA ? { kind: 'winner-of', tieId: feederA.id } : { kind: 'tbd' };
        away = feederB ? { kind: 'winner-of', tieId: feederB.id } : { kind: 'tbd' };
      }
      current.push({
        id: newId(),
        phase,
        slot,
        home,
        away,
        isThirdPlace: false,
        isFinal: phase === phaseCount - 1,
      });
    }
    ties.push(...current);
    previousPhase = current;
  }

  if (opts.thirdPlace && phaseCount >= 2) {
    const semis = ties.filter((tie) => tie.phase === phaseCount - 2);
    const sfA = semis[0];
    const sfB = semis[1];
    ties.push({
      id: newId(),
      phase: phaseCount - 1,
      slot: 1,
      home: sfA ? { kind: 'loser-of', tieId: sfA.id } : { kind: 'tbd' },
      away: sfB ? { kind: 'loser-of', tieId: sfB.id } : { kind: 'tbd' },
      isThirdPlace: true,
      isFinal: false,
    });
  }

  stage.bracket = { ties };

  // Rounds: two per phase when two-legged (final & third place always single-leg).
  const rounds: Round[] = [];
  let roundIndex = 0;
  for (let phase = 0; phase < phaseCount; phase++) {
    const phaseTies = ties.filter((tie) => tie.phase === phase && !tie.isThirdPlace && !tie.isFinal);
    const isLastPhase = phase === phaseCount - 1;
    if (isLastPhase) break; // handled below
    const name = phaseName(opts.size / 2 ** (phase + 1));
    const byeTies = new Set(
      phaseTies.filter((tie) => tie.home.kind === 'bye' || tie.away.kind === 'bye').map((tie) => tie.id),
    );
    if (opts.legs === 1) {
      rounds.push(
        mkRound(
          roundIndex++,
          name,
          phaseTies.map((tie) => mkFixture({ tieId: tie.id, isBye: byeTies.has(tie.id) })),
        ),
      );
    } else {
      const leg1 = phaseTies.map((tie) =>
        mkFixture({ tieId: tie.id, leg: byeTies.has(tie.id) ? null : 1, isBye: byeTies.has(tie.id) }),
      );
      rounds.push(mkRound(roundIndex++, t('spine.leg', { name, n: 1 }), leg1));
      const leg2 = phaseTies
        .filter((tie) => !byeTies.has(tie.id))
        .map((tie) => mkFixture({ tieId: tie.id, leg: 2 }));
      if (leg2.length > 0) {
        rounds.push(mkRound(roundIndex++, t('spine.leg', { name, n: 2 }), leg2));
      }
    }
  }

  const thirdPlaceTie = ties.find((tie) => tie.isThirdPlace);
  if (thirdPlaceTie) {
    rounds.push(
      mkRound(roundIndex++, t('spine.phase.thirdPlace'), [mkFixture({ tieId: thirdPlaceTie.id })]),
    );
  }
  const finalTie = ties.find((tie) => tie.isFinal);
  if (finalTie) {
    rounds.push(mkRound(roundIndex++, t('spine.phase.final'), [mkFixture({ tieId: finalTie.id })]));
  }
  stage.rounds = rounds;
  return stage;
}

function buildSingleMatchStage(name: string, entryIds: string[]): Stage {
  const stage = baseStage(name, { kind: 'single-match' });
  stage.entryIds = entryIds.slice(0, 2);
  stage.rounds = [
    mkRound(0, t('spine.phase.final'), [
      mkFixture({ homeEntryId: entryIds[0] ?? null, awayEntryId: entryIds[1] ?? null }),
    ]),
  ];
  return stage;
}

export function createCompetitionFromSpec(spec: CompetitionSpec): Competition {
  if (spec.entries.length < 2) {
    throw new Error('a competition needs at least two entries');
  }
  const entries: Entry[] = spec.entries.map((input) => ({
    id: newId(),
    participant: input.participant,
    seeding: input.seeding,
    bonus: [],
  }));
  const orderedIds = orderEntriesBySeeding(entries).map((e) => e.id);

  const stages: Stage[] = [];
  const preset = spec.preset;
  if (preset.kind === 'league') {
    stages.push(buildLeagueStage(t('spine.stage.league'), orderedIds, preset.legs));
  } else if (preset.kind === 'single-match') {
    stages.push(buildSingleMatchStage(t('spine.phase.final'), orderedIds));
  } else if (preset.kind === 'knockout') {
    const size = nextPow2(entries.length);
    const phase0Feeds =
      preset.pairing === 'manual'
        ? Array.from({ length: size / 2 }, (): [TieFeed, TieFeed] => [{ kind: 'tbd' }, { kind: 'tbd' }])
        : rankedFeeds(entries.length, size, (position) => {
            const entryId = orderedIds[position - 1];
            return entryId ? { kind: 'entry', entryId } : { kind: 'bye' };
          });
    stages.push(
      buildKnockoutStage({
        name: t('spine.stage.knockout'),
        size,
        legs: preset.legs,
        thirdPlace: preset.thirdPlace,
        awayGoals: preset.awayGoals,
        pairing: preset.pairing,
        phase0Feeds,
      }),
    );
  } else {
    const { groupCount, qualifyPerGroup, bestOfPlace } = preset;
    const qualifierCount = groupCount * qualifyPerGroup + (bestOfPlace?.count ?? 0);
    const size = nextPow2(qualifierCount);
    const crossApplicable =
      qualifyPerGroup === 2 && !bestOfPlace && (groupCount === 2 || groupCount === 4 || groupCount === 8);
    const pairing = crossApplicable ? 'standard-cross' : 'ranked';

    const qualification: QualRule[] = [{ kind: 'top-n-per-group', n: qualifyPerGroup }];
    if (bestOfPlace) {
      qualification.push({ kind: 'best-of-place', place: bestOfPlace.place, count: bestOfPlace.count });
    }
    stages.push(
      buildGroupsStage(
        t('spine.stage.groups'),
        snakeGroups(orderedIds, groupCount),
        preset.legs,
        qualification,
        pairing,
      ),
    );
    const phase0Feeds = crossApplicable
      ? standardCrossFeeds(groupCount as 2 | 4 | 8)
      : rankedFeeds(qualifierCount, size, (position) => ({ kind: 'seed', position }));
    stages.push(
      buildKnockoutStage({
        name: t('spine.stage.knockout'),
        size,
        legs: preset.koLegs,
        thirdPlace: preset.thirdPlace,
        awayGoals: preset.awayGoals,
        pairing,
        phase0Feeds,
      }),
    );
  }

  const event: SportEvent = {
    id: newId(),
    name: spec.name,
    sport: 'football',
    entries,
    stages,
  };
  return {
    id: newId(),
    name: spec.name,
    shortName: spec.shortName,
    sportEvents: [event],
  };
}

/**
 * Seeded-pot random draw: pot i = seeds [i·G+1 .. (i+1)·G], one per group.
 * Plain Math.random — draws are pre-competition theatre, re-rollable until accepted;
 * stored-seed semantics apply to results only (plan §1.3).
 */
export function pottedDraw(entries: Entry[], groupCount: number): string[][] {
  if (groupCount < 1) {
    throw new Error('pottedDraw needs at least one group');
  }
  const ordered = orderEntriesBySeeding(entries).map((e) => e.id);
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  for (let potStart = 0; potStart < ordered.length; potStart += groupCount) {
    const pot = ordered.slice(potStart, potStart + groupCount);
    for (let i = pot.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = pot[i];
      const b = pot[j];
      if (a !== undefined && b !== undefined) {
        pot[i] = b;
        pot[j] = a;
      }
    }
    pot.forEach((entryId, g) => groups[g]?.push(entryId));
  }
  return groups;
}
