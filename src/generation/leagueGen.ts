import type { Calendar } from '../domain/calendar';
import type { Club } from '../domain/club';
import type { Manager } from '../domain/manager';
import type { DomesticPlayer } from '../domain/player';
import { generateClubIdentity } from './clubGen';
import { generateManager } from './managerGen';
import { generateSquad } from './squadGen';
import { TIER_OVR_SPREAD, TIER_OVR_STEP, TIER_OVR_TOP } from './shapes';
import type { Rng } from './prng';

export interface GenerateLeagueInput {
  rng: Rng;
  calendar: Calendar;
  countryName: string;
  /** Number of tiers (1-6 reasonable). */
  tierCount: number;
  /** Clubs per tier (same for all tiers). */
  clubsPerTier: number;
  /** Top-tier mid-OVR target. Defaults to TIER_OVR_TOP. */
  topTierOvr?: number;
  /** OVR step downward per tier. Defaults to TIER_OVR_STEP. */
  tierStep?: number;
  /** OVR spread within a tier. Defaults to TIER_OVR_SPREAD. */
  tierSpread?: number;
}

export interface GeneratedLeague {
  clubs: Club[];
  players: DomesticPlayer[];
  managers: Manager[];
  /** Per-tier club id lists, top-tier first. */
  tiers: string[][];
}

export function generateLeague(input: GenerateLeagueInput): GeneratedLeague {
  const {
    rng,
    calendar,
    countryName,
    tierCount,
    clubsPerTier,
    topTierOvr = TIER_OVR_TOP,
    tierStep = TIER_OVR_STEP,
    tierSpread = TIER_OVR_SPREAD,
  } = input;

  const allClubs: Club[] = [];
  const allPlayers: DomesticPlayer[] = [];
  const allManagers: Manager[] = [];
  const tiers: string[][] = [];

  for (let tierIdx = 0; tierIdx < tierCount; tierIdx++) {
    const midOvr = topTierOvr - tierStep * tierIdx;
    const tierClubIds: string[] = [];

    for (let clubIdx = 0; clubIdx < clubsPerTier; clubIdx++) {
      // Spread club OVRs within this tier from (mid + spread) to (mid - spread).
      const t = clubsPerTier === 1 ? 0.5 : clubIdx / (clubsPerTier - 1);
      const targetOvr = Math.round(midOvr + tierSpread - 2 * tierSpread * t);

      const club = generateClubIdentity({ rng, nationality: countryName });

      const manager = generateManager({
        rng,
        nationality: countryName,
        targetMean: Math.max(50, Math.min(85, targetOvr - 5)),
      });
      manager.contractClubId = club.id;
      manager.contractUntilSeason = calendar.currentSeason + 1 + Math.floor(rng.range(0, 4));
      club.managerId = manager.id;
      allManagers.push(manager);

      const { players } = generateSquad({
        rng,
        calendar,
        clubId: club.id,
        nationality: countryName,
        targetClubOvr: targetOvr,
      });
      club.squadPlayerIds = players.map((p) => p.id);

      // Compute club OVR (mean of top-18 by OVR), matching recomputeClubOvrs.
      const sortedOvrs = players.map((p) => p.stats.ovr).sort((a, b) => b - a);
      const topN = sortedOvrs.slice(0, Math.min(18, sortedOvrs.length));
      club.ovr =
        topN.length === 0
          ? 0
          : Math.round(topN.reduce((s, v) => s + v, 0) / topN.length);

      allClubs.push(club);
      allPlayers.push(...players);
      tierClubIds.push(club.id);
    }

    tiers.push(tierClubIds);
  }

  return { clubs: allClubs, players: allPlayers, managers: allManagers, tiers };
}
