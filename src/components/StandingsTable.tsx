import type { Savefile } from '../domain/savefile';
import type { SportEvent } from '../domain/spine';
import type { TableRow } from '../engine/table';
import { t } from '../lang';
import { entryDisplay } from '../utils/participants';

interface StandingsTableProps {
  sf: Savefile;
  event: SportEvent;
  title: string;
  rows: TableRow[];
  /** Highlight the top N rows (qualification zone). */
  qualifyCount?: number;
  onResolveTie?: (tiedEntryIds: string[]) => void;
}

/** Contiguous unresolved rows form one tied block. */
function tiedBlockAt(rows: TableRow[], index: number): string[] {
  let start = index;
  while (start > 0 && rows[start - 1]?.unresolved) start -= 1;
  let end = index;
  while (end < rows.length - 1 && rows[end + 1]?.unresolved) end += 1;
  return rows.slice(start, end + 1).map((r) => r.entryId);
}

export function StandingsTable({ sf, event, title, rows, qualifyCount = 0, onResolveTie }: StandingsTableProps) {
  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 24 }}>#</th>
            <th>{t('competitions.cockpit.entryName')}</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>+/-</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const d = entryDisplay(sf, event, row.entryId);
            const inZone = qualifyCount > 0 && i < qualifyCount;
            return (
              <tr key={row.entryId}>
                <td className="mono" style={{ color: inZone ? 'var(--accent)' : undefined }}>
                  {row.position}
                </td>
                <td>
                  <span title={d.name}>{d.name}</span>
                  {row.unresolved && onResolveTie ? (
                    <button
                      type="button"
                      className="chip"
                      style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}
                      title={t('competitions.cockpit.tieFlag')}
                      onClick={() => onResolveTie(tiedBlockAt(rows, i))}
                    >
                      ⚖
                    </button>
                  ) : null}
                </td>
                <td className="mono">{row.played}</td>
                <td className="mono">{row.won}</td>
                <td className="mono">{row.drawn}</td>
                <td className="mono">{row.lost}</td>
                <td className="mono">
                  {row.gf}–{row.ga}
                </td>
                <td className="mono" style={{ fontWeight: 700 }}>
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
