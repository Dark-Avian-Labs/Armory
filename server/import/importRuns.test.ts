import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/connection.js', () => {
  let db: Database.Database | null = null;
  return {
    getDb: () => {
      if (!db) {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
      }
      return db;
    },
  };
});

import {
  createImportRun,
  ensureImportRunsSchema,
  maskClerkUserId,
  releaseImportLease,
  tryAcquireImportLease,
} from './importRuns.js';

describe('importRuns', () => {
  beforeEach(() => {
    ensureImportRunsSchema();
  });

  afterEach(async () => {
    const { getDb } = await import('../db/connection.js');
    const db = getDb();
    db.exec('DELETE FROM import_runs');
    db.exec('UPDATE import_lease SET lock_token = NULL, run_id = NULL WHERE id = 1');
  });

  it('masks clerk user ids to last four characters', () => {
    expect(maskClerkUserId('user_importabcd')).toBe('****abcd');
  });

  it('allows only one import lease at a time', () => {
    const run = createImportRun('user_admin');
    const first = tryAcquireImportLease(run.id);
    const second = tryAcquireImportLease(run.id + 1);
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    releaseImportLease(first!);
    const third = tryAcquireImportLease(run.id + 1);
    expect(third).toBeTruthy();
    releaseImportLease(third!);
  });
});
