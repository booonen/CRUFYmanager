import type { Savefile } from '../domain/savefile';
import type { Round, SportEvent, Stage } from '../domain/spine';
import { computeGroupTables, computeOverallTable } from '../engine/qualification';
import type { TableRow } from '../engine/table';
import { entryDisplay } from '../utils/participants';

/**
 * Minimal NS-forum BBCode (Phase 2). The full publish pipeline with templates
 * is Phase 4; these cover the gate: paste-able tables and round results.
 */

function tableBlock(sf: Savefile, event: SportEvent, title: string, rows: TableRow[]): string {
  const lines: string[] = [];
  lines.push(`[b]${title}[/b]`);
  lines.push('[table]');
  lines.push(
    '[tr][td][b]#[/b][/td][td][b]Team[/b][/td][td][b]P[/b][/td][td][b]W[/b][/td][td][b]D[/b][/td][td][b]L[/b][/td][td][b]F–A[/b][/td][td][b]GD[/b][/td][td][b]Pts[/b][/td][/tr]',
  );
  for (const row of rows) {
    const team = entryDisplay(sf, event, row.entryId).name;
    const gd = row.gd > 0 ? `+${row.gd}` : String(row.gd);
    lines.push(
      `[tr][td]${row.position}[/td][td]${team}[/td][td]${row.played}[/td][td]${row.won}[/td][td]${row.drawn}[/td][td]${row.lost}[/td][td]${row.gf}–${row.ga}[/td][td]${gd}[/td][td][b]${row.points}[/b][/td][/tr]`,
    );
  }
  lines.push('[/table]');
  return lines.join('\n');
}

export function stageTablesBBCode(sf: Savefile, event: SportEvent, stage: Stage): string {
  if (stage.groups.length > 0) {
    const tables = computeGroupTables(stage);
    return stage.groups
      .map((group) => tableBlock(sf, event, group.name, tables.get(group.id) ?? []))
      .join('\n\n');
  }
  return tableBlock(sf, event, stage.name, computeOverallTable(stage));
}

export function roundResultsBBCode(sf: Savefile, event: SportEvent, round: Round): string {
  const lines: string[] = [`[b]${round.name}[/b]`];
  for (const fx of round.fixtures) {
    if (fx.isBye) {
      const survivor = entryDisplay(sf, event, fx.homeEntryId ?? fx.awayEntryId).name;
      lines.push(`${survivor} — bye`);
      continue;
    }
    const home = entryDisplay(sf, event, fx.homeEntryId).name;
    const away = entryDisplay(sf, event, fx.awayEntryId).name;
    if (!fx.result || fx.result.payload.family !== 'score') {
      lines.push(`${home} – ${away}`);
      continue;
    }
    const p = fx.result.payload;
    const [hg, ag] = p.score;
    let suffix = '';
    if (p.decidedBy === 'extra-time') suffix = ' (aet)';
    if (p.decidedBy === 'shootout' && p.shootout) {
      suffix = ` (${p.shootout[0]}–${p.shootout[1]} pens)`;
    }
    lines.push(`${home} [b]${hg}–${ag}[/b] ${away}${suffix}`);
  }
  return lines.join('\n');
}
