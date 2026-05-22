import type Database from 'better-sqlite3';

export const LEGACY_USER_ID_TO_CLERK: Record<number, string> = {
  1: 'user_3E4yXj9u7Uoeqqoqmz4lK8iPJZ7',
  4: 'user_3E5AHLxJYueYPSDlgnc8uSDmV8O',
  5: 'user_3E589BCZwizVbtn5WTIx1GLvuPr',
};

function tableHasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  return cols.some((c) => c.name === columnName);
}

function parseLegacyUserId(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && Number.isInteger(raw) ? raw : null;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    const parsed = parseInt(raw.trim(), 10);
    return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function legacyClerkIdForUserId(userId: number): string | null {
  return LEGACY_USER_ID_TO_CLERK[userId] ?? null;
}

function rebuildBuildsTable(db: Database.Database): void {
  if (tableHasColumn(db, 'builds', 'clerk_user_id') && !tableHasColumn(db, 'builds', 'user_id')) {
    return;
  }
  if (!tableHasColumn(db, 'builds', 'user_id')) {
    return;
  }

  db.exec(`
    CREATE TABLE builds_clerk_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
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

  const rows = db.prepare('SELECT * FROM builds').all() as Array<Record<string, unknown>>;
  const insert = db.prepare(`
    INSERT INTO builds_clerk_migration (
      id, clerk_user_id, name, visibility, share_token, equipment_type, equipment_unique_name,
      mod_config, helminth_config, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const row of rows) {
      const legacyUserId = parseLegacyUserId(row.user_id);
      const mapped =
        typeof row.clerk_user_id === 'string' && row.clerk_user_id.trim().length > 0
          ? row.clerk_user_id.trim()
          : legacyUserId != null
            ? legacyClerkIdForUserId(legacyUserId)
            : null;
      if (!mapped) {
        console.warn(
          `[DB] Skipping build id=${row.id}: no clerk_user_id mapping for user_id=${String(row.user_id)}`,
        );
        continue;
      }
      insert.run(
        row.id,
        mapped,
        row.name,
        row.visibility ?? 'private',
        row.share_token ?? null,
        row.equipment_type,
        row.equipment_unique_name,
        row.mod_config,
        row.helminth_config ?? null,
        row.description ?? null,
        row.created_at ?? new Date().toISOString(),
        row.updated_at ?? new Date().toISOString(),
      );
    }
    db.exec('DROP TABLE builds');
    db.exec('ALTER TABLE builds_clerk_migration RENAME TO builds');
    db.exec('CREATE INDEX IF NOT EXISTS idx_builds_clerk_user ON builds(clerk_user_id)');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_builds_share_token ON builds(share_token)');
  })();
  console.log('[DB] Migration: builds.user_id -> builds.clerk_user_id');
}

function rebuildLoadoutsTable(db: Database.Database): void {
  if (
    tableHasColumn(db, 'loadouts', 'clerk_user_id') &&
    !tableHasColumn(db, 'loadouts', 'user_id')
  ) {
    return;
  }
  if (!tableHasColumn(db, 'loadouts', 'user_id')) {
    return;
  }

  db.exec(`
    CREATE TABLE loadouts_clerk_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
      share_token TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const rows = db.prepare('SELECT * FROM loadouts').all() as Array<Record<string, unknown>>;
  const insert = db.prepare(`
    INSERT INTO loadouts_clerk_migration (
      id, clerk_user_id, name, visibility, share_token, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const row of rows) {
      const legacyUserId = parseLegacyUserId(row.user_id);
      const mapped =
        typeof row.clerk_user_id === 'string' && row.clerk_user_id.trim().length > 0
          ? row.clerk_user_id.trim()
          : legacyUserId != null
            ? legacyClerkIdForUserId(legacyUserId)
            : null;
      if (!mapped) {
        console.warn(
          `[DB] Skipping loadout id=${row.id}: no clerk_user_id mapping for user_id=${String(row.user_id)}`,
        );
        continue;
      }
      insert.run(
        row.id,
        mapped,
        row.name,
        row.visibility ?? 'private',
        row.share_token ?? null,
        row.description ?? null,
        row.created_at ?? new Date().toISOString(),
        row.updated_at ?? new Date().toISOString(),
      );
    }
    db.exec('DROP TABLE loadouts');
    db.exec('ALTER TABLE loadouts_clerk_migration RENAME TO loadouts');
    db.exec('CREATE INDEX IF NOT EXISTS idx_loadouts_clerk_user ON loadouts(clerk_user_id)');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_loadouts_share_token ON loadouts(share_token)');
  })();
  console.log('[DB] Migration: loadouts.user_id -> loadouts.clerk_user_id');
}

export function ensureArmoryUsersTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS armory_users (
      clerk_user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
  `);
}

export function migrateBuildsAndLoadoutsToClerkUserId(db: Database.Database): void {
  ensureArmoryUsersTable(db);
  rebuildBuildsTable(db);
  rebuildLoadoutsTable(db);
}
