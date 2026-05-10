import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';
import { isRealClub } from '../utils/freeAgents';
import type { Club } from '../domain/club';

const SQUAD_MIN = 11;
const SQUAD_MAX = 30;

export interface DashboardIssue {
  id: string;
  kind: 'under' | 'over' | 'noManager';
  club: Club;
  count: number;
}

export function computeIssues(
  clubs: readonly Club[],
): DashboardIssue[] {
  const out: DashboardIssue[] = [];
  for (const club of clubs.filter(isRealClub)) {
    const squadSize = club.squadPlayerIds.length;
    if (squadSize < SQUAD_MIN) {
      out.push({ id: `${club.id}-under`, kind: 'under', club, count: squadSize });
    }
    if (squadSize > SQUAD_MAX) {
      out.push({ id: `${club.id}-over`, kind: 'over', club, count: squadSize });
    }
    if (!club.managerId) {
      out.push({ id: `${club.id}-noMgr`, kind: 'noManager', club, count: 0 });
    }
  }
  return out;
}

export function useIssueCount(): number {
  return useSavefileStore((s) => (s.savefile ? computeIssues(s.savefile.clubs).length : 0));
}

export function IssuesRoute() {
  const status = useSavefileStore((s) => s.status);
  const savefile = useSavefileStore((s) => s.savefile);

  if (status !== 'ready' || !savefile) {
    return (
      <EmptyState
        glyph="◉"
        title={t('saves.empty.title')}
        body={t('saves.empty.body')}
        action={
          <Link to="/saves">
            <Button variant="primary">{t('saves.new')}</Button>
          </Link>
        }
      />
    );
  }

  const issues = computeIssues(savefile.clubs);

  return (
    <>
      <PageHeading title={t('nav.issues')} sub={t('issues.sub')} />

      {issues.length === 0 ? (
        <div
          className="panel"
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--success)',
            borderColor: 'rgba(85, 192, 122, 0.4)',
          }}
        >
          {t('issues.none')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {issues.map((iss) => (
            <Link
              key={iss.id}
              to={`/clubs/${iss.club.id}`}
              className="list-row"
              style={{ textDecoration: 'none' }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background:
                    iss.kind === 'over'
                      ? 'rgba(224, 168, 85, 0.18)'
                      : iss.kind === 'under'
                      ? 'rgba(224, 85, 85, 0.18)'
                      : 'rgba(91, 138, 245, 0.18)',
                  color:
                    iss.kind === 'over'
                      ? 'var(--warn)'
                      : iss.kind === 'under'
                      ? 'var(--danger)'
                      : '#5b8af5',
                }}
              >
                {iss.kind === 'under' ? 'UNDER' : iss.kind === 'over' ? 'OVER' : 'NO MGR'}
              </span>
              <div className="list-row__main">
                <div className="list-row__title" style={{ color: 'var(--text)' }}>
                  {t(`issues.kind.${iss.kind}`, {
                    name: iss.club.name,
                    count: iss.count,
                  })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
