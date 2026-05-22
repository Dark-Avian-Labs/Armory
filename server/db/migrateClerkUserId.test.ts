import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LEGACY_USER_ID_TO_CLERK,
  migrateBuildsAndLoadoutsToClerkUserId,
  resolveClerkUserId,
} from './migrateClerkUserId.js';

let DatabaseCtor: typeof Database | null = null;
let sqliteNativeAvailable = false;

try {
  const mod = await import('better-sqlite3');
  DatabaseCtor = mod.default ?? mod;
  const probe = new DatabaseCtor(':memory:');
  probe.close();
  sqliteNativeAvailable = true;
} catch {
  sqliteNativeAvailable = false;
}

function createLegacyDb(): Database.Database {
  if (!DatabaseCtor) {
    throw new Error('better-sqlite3 is not available');
  }
  const db = new DatabaseCtor(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      share_token TEXT,
      equipment_type TEXT NOT NULL,
      equipment_unique_name TEXT NOT NULL,
      mod_config TEXT NOT NULL,
      helminth_config TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE loadouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      share_token TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE loadout_builds (
      loadout_id INTEGER NOT NULL,
      build_id INTEGER NOT NULL,
      slot_type TEXT NOT NULL,
      PRIMARY KEY (loadout_id, slot_type),
      FOREIGN KEY (loadout_id) REFERENCES loadouts(id),
      FOREIGN KEY (build_id) REFERENCES builds(id)
    );
  `);
  return db;
}

describe('resolveClerkUserId', () => {
  it('prefers an existing clerk_user_id column value', () => {
    expect(resolveClerkUserId({ user_id: 3, clerk_user_id: ' user_existing ' })).toBe('user_existing');
  });

  it('maps known legacy user ids', () => {
    expect(resolveClerkUserId({ user_id: 1 })).toBe(LEGACY_USER_ID_TO_CLERK[1]);
    expect(resolveClerkUserId({ user_id: '4' })).toBe(LEGACY_USER_ID_TO_CLERK[4]);
  });

  it('returns null for unmapped legacy users', () => {
    expect(resolveClerkUserId({ user_id: 3 })).toBeNull();
    expect(resolveClerkUserId({ user_id: '999' })).toBeNull();
    expect(resolveClerkUserId({ user_id: null })).toBeNull();
  });
});

describe.skipIf(!sqliteNativeAvailable)('migrateBuildsAndLoadoutsToClerkUserId', () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it('migrates mapped users and drops builds owned by unmapped legacy users', () => {
    db = createLegacyDb();
    const mappedUserId = Number(Object.keys(LEGACY_USER_ID_TO_CLERK)[0]);
    const mappedClerkId = LEGACY_USER_ID_TO_CLERK[mappedUserId];

    db.prepare(
      `INSERT INTO builds (id, user_id, name, equipment_type, equipment_unique_name, mod_config)
       VALUES (1, ?, 'Mapped build', 'warframe', '/Lotus/Powersuits/Excalibur/Excalibur', '{}')`,
    ).run(mappedUserId);
    db.prepare(
      `INSERT INTO builds (id, user_id, name, equipment_type, equipment_unique_name, mod_config)
       VALUES (23, 3, 'Orphan build', 'warframe', '/Lotus/Powersuits/Mag/Mag', '{}')`,
    ).run();
    db.prepare("INSERT INTO loadouts (id, user_id, name) VALUES (1, 3, 'Orphan loadout')").run();
    db.prepare("INSERT INTO loadout_builds (loadout_id, build_id, slot_type) VALUES (1, 23, 'warframe')").run();

    migrateBuildsAndLoadoutsToClerkUserId(db);

    const builds = db.prepare('SELECT id, clerk_user_id, name FROM builds ORDER BY id').all() as Array<{
      id: number;
      clerk_user_id: string;
      name: string;
    }>;
    expect(builds).toEqual([{ id: 1, clerk_user_id: mappedClerkId, name: 'Mapped build' }]);
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM loadout_builds WHERE build_id = 23').get() as {
        count: number;
      },
    ).toEqual({ count: 0 });
    expect(tableHasColumn(db, 'builds', 'user_id')).toBe(false);
    expect(tableHasColumn(db, 'builds', 'clerk_user_id')).toBe(true);
  });

  it('recovers from a partial migration when the temp table already exists', () => {
    db = createLegacyDb();
    const mappedUserId = Number(Object.keys(LEGACY_USER_ID_TO_CLERK)[0]);
    db.prepare(
      `INSERT INTO builds (user_id, name, equipment_type, equipment_unique_name, mod_config)
       VALUES (?, 'Retry build', 'warframe', '/Lotus/Powersuits/Excalibur/Excalibur', '{}')`,
    ).run(mappedUserId);
    db.exec(`
      CREATE TABLE builds_clerk_migration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clerk_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'private',
        share_token TEXT,
        equipment_type TEXT NOT NULL,
        equipment_unique_name TEXT NOT NULL,
        mod_config TEXT NOT NULL,
        helminth_config TEXT,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    expect(() => migrateBuildsAndLoadoutsToClerkUserId(db!)).not.toThrow();
    expect(
      db.prepare('SELECT name FROM builds').get() as {
        name: string;
      },
    ).toEqual({ name: 'Retry build' });
  });
});

function tableHasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  return cols.some((c) => c.name === columnName);
}
