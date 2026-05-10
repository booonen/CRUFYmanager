import type { Calendar } from './calendar';
import type { Club } from './club';
import type { Competition } from './competition';
import type { ForeignWorld } from './foreignWorld';
import type { HistoryArchive } from './history';
import type { Manager } from './manager';
import type { NationalTeam } from './nationalTeam';
import type { OtherMatch } from './otherMatches';
import type { Player } from './player';
import type { UserSettings } from './settings';

export const SCHEMA_VERSION = 4;

export interface SavefileMeta {
  schemaVersion: number;
  createdAt: string;
  lastSavedAt: string;
  countryName: string;
  countryShortCode: string;
}

export interface Savefile {
  meta: SavefileMeta;
  calendar: Calendar;
  competitions: Competition[];
  clubs: Club[];
  players: Player[];
  managers: Manager[];
  nationalTeam: NationalTeam;
  foreignWorld: ForeignWorld;
  otherMatches: OtherMatch[];
  history: HistoryArchive;
  settings: UserSettings;
}

export interface SaveSlot {
  id: string;
  name: string;
  createdAt: string;
  lastSavedAt: string;
  countryName: string;
  countryShortCode: string;
  savefile: Savefile;
}

export interface SaveSlotSummary {
  id: string;
  name: string;
  createdAt: string;
  lastSavedAt: string;
  countryName: string;
  countryShortCode: string;
}
