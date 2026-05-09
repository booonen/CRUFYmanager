import Dexie, { type Table } from 'dexie';
import type { SaveSlot } from '../domain/savefile';

export interface MetaRow {
  id: 'singleton';
  activeSaveId: string | null;
  schemaVersion: number;
}

class CrufyDatabase extends Dexie {
  saves!: Table<SaveSlot, string>;
  meta!: Table<MetaRow, 'singleton'>;

  constructor() {
    super('crufymanager');

    this.version(1).stores({
      saves: 'id, name, lastSavedAt',
      meta: 'id',
    });
  }
}

let dbInstance: CrufyDatabase | null = null;

export function getDb(): CrufyDatabase {
  if (!dbInstance) {
    dbInstance = new CrufyDatabase();
  }
  return dbInstance;
}

export function resetDbForTests(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export type { CrufyDatabase };
