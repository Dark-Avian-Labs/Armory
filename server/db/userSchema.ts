import { log } from '../logger.js';
import { getUserDb } from './connection.js';

const USER_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS loadouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
      share_token TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
      share_token TEXT,
      equipment_type TEXT NOT NULL,
      equipment_unique_name TEXT NOT NULL,
      mod_config TEXT NOT NULL,
      helminth_config TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loadout_builds (
      loadout_id INTEGER NOT NULL,
      build_id INTEGER NOT NULL,
      slot_type TEXT NOT NULL,
      PRIMARY KEY (loadout_id, slot_type),
      FOREIGN KEY (loadout_id) REFERENCES loadouts(id),
      FOREIGN KEY (build_id) REFERENCES builds(id)
    );

    CREATE TABLE IF NOT EXISTS build_favorites (
      clerk_user_id TEXT NOT NULL,
      build_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (clerk_user_id, build_id),
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_build_favorites_user ON build_favorites(clerk_user_id);
  `;

export function createUserSchema(): void {
  const db = getUserDb();
  db.exec(USER_SCHEMA_SQL);

  const hasColumn = db.prepare(
    `SELECT 1
       FROM pragma_table_info(?)
      WHERE name = ?
      LIMIT 1`,
  );
  if (hasColumn.get('builds', 'share_token')) {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_builds_share_token ON builds(share_token)');
  }
  if (hasColumn.get('loadouts', 'share_token')) {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_loadouts_share_token ON loadouts(share_token)');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_builds_clerk_user ON builds(clerk_user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_loadouts_clerk_user ON loadouts(clerk_user_id)');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_builds_clerk_user_visibility ON builds(clerk_user_id, visibility)',
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_loadouts_clerk_user_visibility ON loadouts(clerk_user_id, visibility)',
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_builds_equipment_discovery ON builds(equipment_type, equipment_unique_name)',
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_builds_public_discovery
       ON builds(equipment_type, equipment_unique_name, updated_at)
     WHERE visibility = 'public'`,
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_loadout_builds_build ON loadout_builds(build_id)');

  log('info', 'User schema created/verified');
}
