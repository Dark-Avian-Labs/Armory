import Database from 'better-sqlite3';

import { ARMORY_DB_PATH, CENTRAL_DB_PATH } from '../config.js';
import { closeCodexDb } from './codex.js';

let db: Database.Database | null = null;
let centralDb: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(ARMORY_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function getCentralDb(): Database.Database {
  if (!centralDb) {
    centralDb = new Database(CENTRAL_DB_PATH);
    centralDb.pragma('journal_mode = WAL');
    centralDb.pragma('foreign_keys = ON');
  }
  return centralDb;
}

export function closeAll(): void {
  if (db) {
    db.close();
    db = null;
  }
  if (centralDb) {
    centralDb.close();
    centralDb = null;
  }
  closeCodexDb();
}
