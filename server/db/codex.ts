import Database from 'better-sqlite3';

import { CODEX_EXPORT_DB_PATH } from '../config.js';
import { createCodexSchema } from './codex-schema.js';

let codexDb: Database.Database | null = null;

export function getCodexDb(): Database.Database {
  if (!codexDb) {
    codexDb = new Database(CODEX_EXPORT_DB_PATH);
    codexDb.pragma('journal_mode = WAL');
    codexDb.pragma('foreign_keys = ON');
    createCodexSchema(codexDb);
  }
  return codexDb;
}

export function closeCodexDb(): void {
  if (codexDb) {
    codexDb.close();
    codexDb = null;
  }
}
