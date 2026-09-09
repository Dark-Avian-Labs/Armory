import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { applyUserSchema } from './userSchema.js';

describe('user schema', () => {
  let db: Database.Database | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('creates a partial index for public build discovery', () => {
    db = new Database(':memory:');
    applyUserSchema(db);
    const row = db
      .prepare(
        `SELECT sql FROM sqlite_master
        WHERE type = 'index' AND name = 'idx_builds_public_discovery'`,
      )
      .get() as { sql: string } | undefined;
    expect(row?.sql).toMatch(/visibility = 'public'/);

    db.prepare(
      `INSERT INTO builds (clerk_user_id, name, visibility, equipment_type, equipment_unique_name, mod_config)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('user_a', 'Public', 'public', 'warframe', '/wf/A', '{}');
    db.prepare(
      `INSERT INTO builds (clerk_user_id, name, visibility, equipment_type, equipment_unique_name, mod_config)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('user_a', 'Private', 'private', 'warframe', '/wf/B', '{}');

    const plan = db
      .prepare(
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
