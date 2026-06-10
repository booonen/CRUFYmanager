import type { Savefile } from '../domain/savefile';
import type { SportEvent, Stage } from '../domain/spine';
import { propagateBracket } from './bracket';
import { externalResolverFor } from './qualification';

/**
 * Integrity warnings (plan §4.7): they inform, never block. Surfaced in the
 * Issues route alongside the Phase 1 squad-coverage checks.
 */
export interface SpineWarning {
  id: string;
  kind: 'stale-upstream' | 'bracket-contradiction';
  competitionId: string;
  competitionName: string;
  stageName: string;
  roundName: string;
}

interface RoundPos {
  stageIndex: number;
  roundIndex: number;
  stage: Stage;
  roundId: string;
  roundName: string;
}

function flatten(event: SportEvent): RoundPos[] {
  const out: RoundPos[] = [];
  event.stages.forEach((stage, stageIndex) => {
    stage.rounds.forEach((round, roundIndex) => {
      out.push({ stageIndex, roundIndex, stage, roundId: round.id, roundName: round.name });
    });
  });
  return out;
}

export function spineWarnings(sf: Savefile): SpineWarning[] {
  const warnings: SpineWarning[] = [];

  for (const comp of sf.competitions) {
    for (const event of comp.sportEvents) {
      const positions = flatten(event);

      // Stale upstream: a published round whose upstream results changed after
      // publication. (Also fires when upstream results were entered later than a
      // downstream publication — the published cumulative table was incomplete.)
      for (const pos of positions) {
        const round = pos.stage.rounds[pos.roundIndex];
        if (!round) continue;
        const publishedAts = round.fixtures
          .map((fx) => fx.result)
          .filter((r) => r?.lifecycle.status === 'published')
          .map((r) => r?.lifecycle.publishedAt ?? '')
          .filter(Boolean);
        if (publishedAts.length === 0) continue;
        const minPub = publishedAts.reduce((a, b) => (a < b ? a : b));

        const stale = positions.some((up) => {
          const earlier =
            up.stageIndex < pos.stageIndex ||
            (up.stageIndex === pos.stageIndex && up.roundIndex < pos.roundIndex);
          if (!earlier) return false;
          const upRound = up.stage.rounds[up.roundIndex];
          return (
            upRound?.fixtures.some((fx) => fx.result !== null && fx.result.modifiedAt > minPub) ?? false
          );
        });
        if (stale) {
          warnings.push({
            id: `${round.id}-stale`,
            kind: 'stale-upstream',
            competitionId: comp.id,
            competitionName: comp.name,
            stageName: pos.stage.name,
            roundName: round.name,
          });
        }
      }

      // Bracket contradiction: recomputed qualification/propagation disagrees with
      // the occupants of an already-published knockout result.
      event.stages.forEach((stage, stageIndex) => {
        if (stage.format.kind !== 'knockout' || !stage.bracket) return;
        const { expected } = propagateBracket(
          stage,
          stage.format.awayGoals,
          externalResolverFor(event, stageIndex, false),
        );
        for (const round of stage.rounds) {
          for (const fx of round.fixtures) {
            if (!fx.tieId || !fx.result || fx.result.lifecycle.status !== 'published') continue;
            const exp = expected.get(fx.tieId);
            if (!exp) continue;
            const [expHome, expAway] = fx.leg === 2 ? [exp[1], exp[0]] : exp;
            const [home, away] = fx.result.competitors;
            const mismatch =
              (expHome !== null && home !== undefined && expHome !== home) ||
              (expAway !== null && away !== undefined && expAway !== away);
            if (mismatch) {
              warnings.push({
                id: `${fx.id}-contradiction`,
                kind: 'bracket-contradiction',
                competitionId: comp.id,
                competitionName: comp.name,
                stageName: stage.name,
                roundName: round.name,
              });
            }
          }
        }
      });
    }
  }

  return warnings;
}
