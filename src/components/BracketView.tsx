import type { Savefile } from '../domain/savefile';
import type { Fixture, SportEvent, Stage } from '../domain/spine';
import { t } from '../lang';
import { entryDisplay } from '../utils/participants';

interface BracketViewProps {
  sf: Savefile;
  event: SportEvent;
  stage: Stage;
}

function scoreLabel(fx: Fixture): string {
  if (fx.isBye) return t('competitions.cockpit.bye');
  if (!fx.result || fx.result.payload.family !== 'score') return '–';
  const p = fx.result.payload;
  let s = `${p.score[0]}–${p.score[1]}`;
  if (p.decidedBy === 'shootout' && p.shootout) s += ` (${p.shootout[0]}–${p.shootout[1]}p)`;
  if (p.decidedBy === 'extra-time') s += ' aet';
  return s;
}

export function BracketView({ sf, event, stage }: BracketViewProps) {
  if (!stage.bracket) return null;
  const phases = [...new Set(stage.bracket.ties.map((t0) => t0.phase))].sort((a, b) => a - b);
  const fixturesByTie = new Map<string, Fixture[]>();
  for (const round of stage.rounds) {
    for (const fx of round.fixtures) {
      if (!fx.tieId) continue;
      fixturesByTie.set(fx.tieId, [...(fixturesByTie.get(fx.tieId) ?? []), fx]);
    }
  }

  return (
    <div className="bracket">
      {phases.map((phase) => {
        const ties = stage.bracket?.ties
          .filter((tie) => tie.phase === phase)
          .sort((a, b) => a.slot - b.slot);
        return (
          <div key={phase} className="bracket__col">
            {(ties ?? []).map((tie) => {
              const fixtures = (fixturesByTie.get(tie.id) ?? []).sort((a, b) => (a.leg ?? 1) - (b.leg ?? 1));
              const first = fixtures[0];
              const home = entryDisplay(sf, event, first?.homeEntryId ?? null);
              const away = entryDisplay(sf, event, first?.awayEntryId ?? null);
              return (
                <div key={tie.id} className="bracket__tie">
                  {tie.isThirdPlace ? (
                    <div className="bracket__tag">{t('spine.phase.thirdPlace')}</div>
                  ) : null}
                  <div className="bracket__line">
                    <span className="mono bracket__code">{home.code}</span>
                    <span className="bracket__name" title={home.name}>
                      {home.name}
                    </span>
                  </div>
                  <div className="bracket__line">
                    <span className="mono bracket__code">{away.code}</span>
                    <span className="bracket__name" title={away.name}>
                      {away.name}
                    </span>
                  </div>
                  <div className="mono bracket__score">
                    {fixtures.map((fx) => scoreLabel(fx)).join(' · ')}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
