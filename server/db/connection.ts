import Database from 'better-sqlite3';

import { ARMORY_DB_PATH, SESSION_DB_PATH } from '../config.js';
import { closeCodexDb } from './codex.js';

let db: Database.Database | null = null;
let sessionDb: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(ARMORY_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function getSessionDb(): Database.Database {
  if (!sessionDb) {
    sessionDb = new Database(SESSION_DB_PATH);
    sessionDb.pragma('journal_mode = WAL');
    sessionDb.pragma('foreign_keys = ON');
  }
  return sessionDb;
}

export const getCentralDb = getSessionDb;

export function closeAll(): void {
  if (db) {
    db.close();
    db = null;
  }
  if (sessionDb) {
    sessionDb.close();
    sessionDb = null;
  }
  closeCodexDb();
}
