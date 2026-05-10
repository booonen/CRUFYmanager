import type { Calendar } from '../domain/calendar';
import type {
  DomesticPlayer,
  GameStatBlock,
  PersonalityTag,
  Position,
  PreferredFoot,
} from '../domain/player';
import { dobForAge } from './age';
import { computeOvr, defaultStatBlock } from './ovr';
import { newId } from './ids';

export interface PlayerFormInput {
  name: string;
  nationality: string;
  position: Position;
  preferredFoot: PreferredFoot;
  age: number;
  clubId: string;
  contractUntilSeason: number;
  squadNumber: number | null;
  stats: GameStatBlock;
  personalities: PersonalityTag[];
  consistency: number;
  workRate: number;
  injuryProneness: number;
  potential: number;
  currentForm: number;
  currentMorale: number;
  currentFitness: number;
}

export interface NewPlayerDefaults {
  nationality?: string;
}

export function newPlayerFormInput(
  calendar: Calendar,
  clubId: string,
  defaults: NewPlayerDefaults = {},
): PlayerFormInput {
  return {
    name: '',
    nationality: defaults.nationality ?? '',
    position: 'MID-CM',
    preferredFoot: 'R',
    age: 22,
    clubId,
    contractUntilSeason: calendar.currentSeason + 3,
    squadNumber: null,
    stats: defaultStatBlock(),
    personalities: ['Professional'],
    consistency: 60,
    workRate: 60,
    injuryProneness: 30,
    potential: 70,
    currentForm: 60,
    currentMorale: 75,
    currentFitness: 100,
  };
}

export function playerFormToDomain(input: PlayerFormInput, calendar: Calendar): DomesticPlayer {
  return {
    id: newId(),
    tier: 'domestic',
    name: input.name.trim(),
    nationality: input.nationality.trim(),
    position: input.position,
    preferredFoot: input.preferredFoot,
    dateOfBirth: dobForAge(input.age, calendar),
    stats: {
      ...input.stats,
      injuryProneness: input.injuryProneness,
      potential: input.potential,
      personalities: [...input.personalities],
      consistency: input.consistency,
      workRate: input.workRate,
      ovr: computeOvr(input.position, input.stats),
    },
    clubId: input.clubId,
    contractUntilSeason: input.contractUntilSeason,
    squadNumber: input.squadNumber,
    currentForm: input.currentForm,
    currentMorale: input.currentMorale,
    currentFitness: input.currentFitness,
    injury: null,
    careerHistory: [],
  };
}

export function domesticPlayerToFormInput(
  player: DomesticPlayer,
  calendar: Calendar,
): PlayerFormInput {
  const { stats } = player;
  const game: GameStatBlock = {
    pace: stats.pace,
    finishing: stats.finishing,
    passing: stats.passing,
    dribbling: stats.dribbling,
    defending: stats.defending,
    heading: stats.heading,
    vision: stats.vision,
    physicality: stats.physicality,
    technique: stats.technique,
    handling: stats.handling,
    reflexes: stats.reflexes,
    kicking: stats.kicking,
  };
  const seasonsElapsed = calendar.currentSeason - player.dateOfBirth.season;
  const passedBirthMatchday = calendar.currentMatchday >= player.dateOfBirth.matchday;
  return {
    name: player.name,
    nationality: player.nationality,
    position: player.position,
    preferredFoot: player.preferredFoot,
    age: Math.max(0, seasonsElapsed - (passedBirthMatchday ? 0 : 1)),
    clubId: player.clubId,
    contractUntilSeason: player.contractUntilSeason,
    squadNumber: player.squadNumber,
    stats: game,
    personalities: [...stats.personalities],
    consistency: stats.consistency,
    workRate: stats.workRate,
    injuryProneness: stats.injuryProneness,
    potential: stats.potential,
    currentForm: player.currentForm,
    currentMorale: player.currentMorale,
    currentFitness: player.currentFitness,
  };
}

export function nextSquadNumber(taken: (number | null)[]): number {
  const used = new Set(taken.filter((n): n is number => typeof n === 'number'));
  for (let i = 1; i < 100; i++) {
    if (!used.has(i)) return i;
  }
  return 99;
}
