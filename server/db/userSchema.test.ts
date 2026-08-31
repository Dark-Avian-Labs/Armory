import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbState = vi.hoisted(() => ({
  db: null as Database.Database | null,
}));

vi.mock('./connection.js', () => ({
  getUserDb: () => {
    if (!dbState.db) throw new Error('Test DB not initialized');
    return dbState.db;
  },
}));

import { createUserSchema } from './userSchema.js';

describe('user schema', () => {
  beforeEach(() => {
    dbState.db?.close();
    dbState.db = new Database(':memory:');
  });

  afterEach(() => {
    dbState.db?.close();
    dbState.db = null;
  });

  it('creates a partial index for public build discovery', () => {
    createUserSchema();
    const row = dbState
      .db!.prepare(
        `SELECT sql FROM sqlite_master
        WHERE type = 'index' AND name = 'idx_builds_public_discovery'`,
      )
      .get() as { sql: string } | undefined;
    expect(row?.sql).toMatch(/visibility = 'public'/);

    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, equipment_type, equipment_unique_name, mod_config)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('user_a', 'Public', 'public', 'warframe', '/wf/A', '{}');
    dbState
      .db!.prepare(
        `INSERT INTO builds (clerk_user_id, name, visibility, equipment_type, equipment_unique_name, mod_config)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('user_a', 'Private', 'private', 'warframe', '/wf/B', '{}');

    const plan = dbState
      .db!.prepare(
        `EXPLAIN QUERY PLAN
       SELECT equipment_type, equipment_unique_name, COUNT(*) AS build_count
         FROM builds
        WHERE visibility = 'public'
        GROUP BY equipment_type, equipment_unique_name`,
      )
      .all() as Array<{ detail: string }>;
    const detail = plan.map((row) => row.detail).join(' ');
    expect(detail).toContain('idx_builds_public_discovery');
  });
});
