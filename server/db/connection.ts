import Database from 'better-sqlite3';

import { ARMORY_DB_PATH, SESSION_DB_PATH, USER_DB_PATH } from '../config.js';

let catalogDb: Database.Database | null = null;
let userDb: Database.Database | null = null;
let sessionDb: Database.Database | null = null;

function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

export function getCatalogDb(): Database.Database {
  if (!catalogDb) {
    catalogDb = openDatabase(ARMORY_DB_PATH);
  }
  return catalogDb;
}

export function getUserDb(): Database.Database {
  if (!userDb) {
    userDb = openDatabase(USER_DB_PATH);
  }
  return userDb;
}

export function getSessionDb(): Database.Database {
  if (!sessionDb) {
    sessionDb = openDatabase(SESSION_DB_PATH);
  }
  return sessionDb;
}

export function closeAll(): void {
  if (catalogDb) {
    catalogDb.close();
    catalogDb = null;
  }
  if (userDb) {
    userDb.close();
    userDb = null;
  }
  if (sessionDb) {
    sessionDb.close();
    sessionDb = null;
  }
}
