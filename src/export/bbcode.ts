import type { Savefile } from '../domain/savefile';
import type { Fixture, Round, SportEvent, Stage } from '../domain/spine';
import {
  computeGroupTablesThrough,
  computeOverallTableThrough,
  tableConfigOf,
} from '../engine/qualification';
import { computeTable, type TableRow } from '../engine/table';
import { entryDisplay } from '../utils/participants';

/**
 * NS-forum BBCode in the shape the sports community actually posts (Phase 2
 * minimal; templated pipeline lands in Phase 4): per-group [box] blocks, a bold
 * matchday header, plain result lines, then the cumulative table in [pre]
 * monospace. Modeled on real NSWC group-stage posts.
 */

const MINUS = '−'; // U+2212, as used in forum tables

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${MINUS}${-n}`;
  return '0';
}

function preTable(title: string, rows: TableRow[], nameOf: (entryId: string) => string): string {
  const nameW = Math.max(title.length - 2, ...rows.map((r) => nameOf(r.entryId).length)) + 4;
  const num = (v: string | number, w: number) => String(v).padStart(w);

  const header =
    `${title.padEnd(3 + nameW)}Pld` +
    `${num('W', 5)}${num('D', 4)}${num('L', 4)}` +
    `${num('GF', 6)}${num('GA', 5)}${num('GD', 5)}${num('Pts', 6)}`;

  const lines = rows.map((row, i) => {
    const prev = rows[i - 1];
    const tiedWithPrev = prev !== undefined && prev.points === row.points && prev.gd === row.gd;
    const pos = tiedWithPrev ? ' =' : num(row.position, 2);
    return (
      `${pos} ${nameOf(row.entryId).padEnd(nameW)}${num(row.played, 3)}` +
      `${num(row.won, 5)}${num(row.drawn, 4)}${num(row.lost, 4)}` +
      `${num(row.gf, 6)}${num(row.ga, 5)}${num(signed(row.gd), 5)}${num(row.points, 6)}`
    );
  });

  return `[pre][b]${header}[/b] \n${lines.join('\n')}[/pre]`;
}

function resultLine(sf: Savefile, event: SportEvent, fx: Fixture): string {
  if (fx.isBye) {
    const survivor = entryDisplay(sf, event, fx.homeEntryId ?? fx.awayEntryId).name;
    return `${survivor} — bye`;
  }
  const home = entryDisplay(sf, event, fx.homeEntryId).name;
  const away = entryDisplay(sf, event, fx.awayEntryId).name;
  if (!fx.result || fx.result.payload.family !== 'score') {
    return `${home} – ${away}`;
  }
  const p = fx.result.payload;
  let suffix = '';
  if (p.decidedBy === 'extra-time') suffix = ' (aet)';
  if (p.decidedBy === 'shootout' && p.shootout) suffix = ` (${p.shootout[0]}–${p.shootout[1]} pens)`;
  return `${home} ${p.score[0]}–${p.score[1]} ${away}${suffix}`;
}

function mdLabel(stage: Stage, round: Round): string {
  return stage.format.kind === 'league' || stage.format.kind === 'groups'
    ? `MD${round.index + 1}`
    : round.name;
}

/**
 * The results-post artifact for one matchday: per group, that matchday's
 * results followed by the table as it stands after them.
 */
export function matchdayPostBBCode(sf: Savefile, event: SportEvent, stage: Stage, round: Round): string {
  const nameOf = (entryId: string) => entryDisplay(sf, event, entryId).name;
  const label = mdLabel(stage, round);

  if (stage.groups.length > 0) {
    const tables = computeGroupTablesThrough(stage, round.index);
    return stage.groups
      .map((group) => {
        const fixtures = round.fixtures.filter((fx) => fx.groupId === group.id);
        const lines = fixtures.map((fx) => resultLine(sf, event, fx)).join('\n');
        const table = preTable(group.name, tables.get(group.id) ?? [], nameOf);
        return `[box][size=125][b]${group.name}[/b][/size]\n[hr][/hr][b]${label}[/b]\n${lines}\n\n${table}[/box]`;
      })
      .join('\n\n');
  }

  if (stage.format.kind === 'league') {
    const table = preTable(stage.name, computeOverallTableThrough(stage, round.index), nameOf);
    const lines = round.fixtures.map((fx) => resultLine(sf, event, fx)).join('\n');
    return `[box][size=125][b]${stage.name}[/b][/size]\n[hr][/hr][b]${label}[/b]\n${lines}\n\n${table}[/box]`;
  }

  // Knockout / single match: results block, no table.
  const lines = round.fixtures.map((fx) => resultLine(sf, event, fx)).join('\n');
  return `[box][size=125][b]${round.name}[/b][/size]\n[hr][/hr]${lines}[/box]`;
}

/** Current full tables only (no results) — quick copy from the standings panel. */
export function stageTablesBBCode(sf: Savefile, event: SportEvent, stage: Stage): string {
  const nameOf = (entryId: string) => entryDisplay(sf, event, entryId).name;
  if (stage.groups.length > 0) {
    const lastRound = stage.rounds.length - 1;
    const tables = computeGroupTablesThrough(stage, lastRound);
    return stage.groups
      .map((group) => preTable(group.name, tables.get(group.id) ?? [], nameOf))
      .join('\n\n');
  }
  const rows = computeTable(
    stage.entryIds,
    stage.rounds.flatMap((r) => r.fixtures),
    tableConfigOf(stage),
  );
  return preTable(stage.name, rows, nameOf);
}

/** Bare result lines for one round. */
export function roundResultsBBCode(sf: Savefile, event: SportEvent, round: Round): string {
  return [`[b]${round.name}[/b]`, ...round.fixtures.map((fx) => resultLine(sf, event, fx))].join('\n');
}
