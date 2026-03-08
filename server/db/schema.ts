import { getDb } from './connection.js';

export function createAppSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const hasMigration = db.prepare(
    'SELECT 1 FROM schema_migrations WHERE id = ?',
  );
  const markMigration = db.prepare(
    'INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)',
  );

  db.exec(`
    -- Warframes (includes Archwings, Necramechs)
    CREATE TABLE IF NOT EXISTS warframes (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      health REAL,
      shield REAL,
      armor REAL,
      power REAL,
      sprint_speed REAL,
      stamina REAL,
      passive_description TEXT,
      product_category TEXT,
      abilities TEXT,              -- JSON array of abilities
      aura_polarity TEXT,
      exilus_polarity TEXT,
      polarities TEXT,             -- JSON array of default polarities
      mastery_req INTEGER DEFAULT 0,
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0
    );

    -- Warframe abilities
    CREATE TABLE IF NOT EXISTS abilities (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      warframe_unique_name TEXT,
      is_helminth_extractable INTEGER DEFAULT 0,
      image_path TEXT,
      FOREIGN KEY (warframe_unique_name) REFERENCES warframes(unique_name)
    );

    -- Weapons (all types)
    CREATE TABLE IF NOT EXISTS weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      product_category TEXT,       -- Pistols, LongGuns, Melee, etc.
      slot INTEGER,                -- 0=secondary, 1=primary, 5=melee, etc.
      mastery_req INTEGER DEFAULT 0,
      total_damage REAL,
      damage_per_shot TEXT,        -- JSON array of 20 floats
      critical_chance REAL,
      critical_multiplier REAL,
      proc_chance REAL,
      fire_rate REAL,
      accuracy REAL,
      magazine_size INTEGER,
      reload_time REAL,
      multishot INTEGER,
      noise TEXT,
      trigger_type TEXT,
      omega_attenuation REAL,
      riven_disposition REAL,
      max_level_cap INTEGER,
      sentinel INTEGER DEFAULT 0,
      -- Melee-specific
      blocking_angle INTEGER,
      combo_duration INTEGER,
      follow_through REAL,
      range REAL,
      slam_attack REAL,
      slam_radial_damage REAL,
      slam_radius REAL,
      slide_attack REAL,
      heavy_attack_damage REAL,
      heavy_slam_attack REAL,
      heavy_slam_radial_damage REAL,
      heavy_slam_radius REAL,
      wind_up REAL,
      -- Metadata
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0
    );

    -- Companions (Sentinels, Kubrows, Kavats, etc.)
    CREATE TABLE IF NOT EXISTS companions (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_name TEXT,
      health INTEGER,
      shield INTEGER,
      armor INTEGER,
      power INTEGER,
      stamina INTEGER,
      product_category TEXT,
      mastery_req INTEGER DEFAULT 0,
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0
    );

    -- Mods / Upgrades
    CREATE TABLE IF NOT EXISTS mods (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      polarity TEXT,
      rarity TEXT,                 -- COMMON, UNCOMMON, RARE, LEGENDARY
      type TEXT,                   -- WARFRAME, PRIMARY, SECONDARY, MELEE, etc.
      compat_name TEXT,            -- Equipment compatibility display name
      base_drain INTEGER,
      fusion_limit INTEGER,        -- Max rank
      is_utility INTEGER DEFAULT 0,-- Can fit in Exilus slot
      is_augment INTEGER DEFAULT 0,
      subtype TEXT,                -- For augments: warframe unique_name
      description TEXT,            -- JSON array of description strings
      upgrade_entries TEXT,         -- JSON: available riven stats (for riven mods)
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0
    );

    -- Mod level stats
    CREATE TABLE IF NOT EXISTS mod_level_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mod_unique_name TEXT NOT NULL,
      rank INTEGER NOT NULL,
      stats TEXT NOT NULL,         -- JSON: the stats description at this rank
      FOREIGN KEY (mod_unique_name) REFERENCES mods(unique_name),
      UNIQUE(mod_unique_name, rank)
    );

    -- Mod sets
    CREATE TABLE IF NOT EXISTS mod_sets (
      unique_name TEXT PRIMARY KEY,
      num_in_set INTEGER,
      stats TEXT                   -- JSON array of set bonus descriptions
    );

    -- Mod set members (which mods belong to which set)
    CREATE TABLE IF NOT EXISTS mod_set_members (
      mod_unique_name TEXT NOT NULL,
      set_unique_name TEXT NOT NULL,
      PRIMARY KEY (mod_unique_name, set_unique_name),
      FOREIGN KEY (mod_unique_name) REFERENCES mods(unique_name),
      FOREIGN KEY (set_unique_name) REFERENCES mod_sets(unique_name)
    );

    -- Arcanes
    CREATE TABLE IF NOT EXISTS arcanes (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rarity TEXT,
      level_stats TEXT,            -- JSON array of level stat objects
      compat_tags TEXT,            -- JSON array of compatibility tags
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0
    );

    -- Archon shard types
    CREATE TABLE IF NOT EXISTS archon_shard_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon_path TEXT NOT NULL,
      tauforged_icon_path TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    -- Archon shard buffs
    CREATE TABLE IF NOT EXISTS archon_shard_buffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shard_type_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      base_value REAL NOT NULL,
      tauforged_value REAL NOT NULL,
      value_format TEXT DEFAULT '%',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (shard_type_id) REFERENCES archon_shard_types(id)
    );

    -- Loadouts
    CREATE TABLE IF NOT EXISTS loadouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
      share_token TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loadout_builds (
      loadout_id INTEGER NOT NULL,
      build_id INTEGER NOT NULL,
      slot_type TEXT NOT NULL,
      PRIMARY KEY (loadout_id, slot_type),
      FOREIGN KEY (loadout_id) REFERENCES loadouts(id),
      FOREIGN KEY (build_id) REFERENCES builds(id)
    );

    -- User builds
    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
      share_token TEXT,
      equipment_type TEXT NOT NULL,       -- warframe, primary, secondary, melee, etc.
      equipment_unique_name TEXT NOT NULL,
      mod_config TEXT NOT NULL,           -- JSON: full mod configuration
      helminth_config TEXT,               -- JSON: helminth ability replacement (if any)
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_mods_type ON mods(type);
    CREATE INDEX IF NOT EXISTS idx_mods_rarity ON mods(rarity);
    CREATE INDEX IF NOT EXISTS idx_mods_compat ON mods(compat_name);
    CREATE INDEX IF NOT EXISTS idx_weapons_category ON weapons(product_category);
    CREATE INDEX IF NOT EXISTS idx_weapons_slot ON weapons(slot);
    CREATE INDEX IF NOT EXISTS idx_builds_user ON builds(user_id);
    CREATE INDEX IF NOT EXISTS idx_abilities_warframe ON abilities(warframe_unique_name);
  `);

  const migrations: Array<{
    id: string;
    table: string;
    column: string;
    sql: string;
  }> = [
    {
      id: '20260301_abilities_image_path',
      table: 'abilities',
      column: 'image_path',
      sql: 'ALTER TABLE abilities ADD COLUMN image_path TEXT',
    },
    {
      id: '20260301_mods_mod_set',
      table: 'mods',
      column: 'mod_set',
      sql: 'ALTER TABLE mods ADD COLUMN mod_set TEXT REFERENCES mod_sets(unique_name)',
    },
    {
      id: '20260301_warframes_artifact_slots',
      table: 'warframes',
      column: 'artifact_slots',
      sql: 'ALTER TABLE warframes ADD COLUMN artifact_slots TEXT',
    },
    {
      id: '20260301_weapons_artifact_slots',
      table: 'weapons',
      column: 'artifact_slots',
      sql: 'ALTER TABLE weapons ADD COLUMN artifact_slots TEXT',
    },
    {
      id: '20260301_weapons_fire_behaviors',
      table: 'weapons',
      column: 'fire_behaviors',
      sql: 'ALTER TABLE weapons ADD COLUMN fire_behaviors TEXT',
    },
    {
      id: '20260301_weapons_riven_disposition',
      table: 'weapons',
      column: 'riven_disposition',
      sql: 'ALTER TABLE weapons ADD COLUMN riven_disposition REAL',
    },
    {
      id: '20260301_abilities_ability_stats',
      table: 'abilities',
      column: 'ability_stats',
      sql: 'ALTER TABLE abilities ADD COLUMN ability_stats TEXT',
    },
    {
      id: '20260301_companions_artifact_slots',
      table: 'companions',
      column: 'artifact_slots',
      sql: 'ALTER TABLE companions ADD COLUMN artifact_slots TEXT',
    },
    {
      id: '20260301_abilities_wiki_stats',
      table: 'abilities',
      column: 'wiki_stats',
      sql: 'ALTER TABLE abilities ADD COLUMN wiki_stats TEXT',
    },
    {
      id: '20260301_abilities_energy_cost',
      table: 'abilities',
      column: 'energy_cost',
      sql: 'ALTER TABLE abilities ADD COLUMN energy_cost INTEGER',
    },
    {
      id: '20260301_warframes_passive_description_wiki',
      table: 'warframes',
      column: 'passive_description_wiki',
      sql: 'ALTER TABLE warframes ADD COLUMN passive_description_wiki TEXT',
    },
    {
      id: '20260301_mods_augment_for_ability',
      table: 'mods',
      column: 'augment_for_ability',
      sql: 'ALTER TABLE mods ADD COLUMN augment_for_ability TEXT',
    },
    {
      id: '20260301_builds_visibility',
      table: 'builds',
      column: 'visibility',
      sql: "ALTER TABLE builds ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted'))",
    },
    {
      id: '20260301_builds_share_token',
      table: 'builds',
      column: 'share_token',
      sql: 'ALTER TABLE builds ADD COLUMN share_token TEXT',
    },
    {
      id: '20260301_loadouts_visibility',
      table: 'loadouts',
      column: 'visibility',
      sql: "ALTER TABLE loadouts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted'))",
    },
    {
      id: '20260301_loadouts_share_token',
      table: 'loadouts',
      column: 'share_token',
      sql: 'ALTER TABLE loadouts ADD COLUMN share_token TEXT',
    },
    {
      id: '20260308_arcanes_compat_tags',
      table: 'arcanes',
      column: 'compat_tags',
      sql: 'ALTER TABLE arcanes ADD COLUMN compat_tags TEXT',
    },
  ];
  const ALLOWED_MIGRATION_TABLES = new Set(
    migrations.map((migration) => migration.table),
  );
  for (const m of migrations) {
    if (hasMigration.get(m.id)) {
      continue;
    }
    if (!ALLOWED_MIGRATION_TABLES.has(m.table)) {
      throw new Error(
        `[DB] Migration ${m.id} references unexpected table: ${m.table}`,
      );
    }
    const cols = db.prepare(`PRAGMA table_info(${m.table})`).all() as {
      name: string;
    }[];
    if (!cols.some((c) => c.name === m.column)) {
      db.exec(m.sql);
      console.log(`[DB] Migration: added ${m.table}.${m.column}`);
    }
    markMigration.run(m.id);
  }

  const hasColumn = db.prepare(
    `SELECT 1
       FROM pragma_table_info(?)
      WHERE name = ?
      LIMIT 1`,
  );
  if (hasColumn.get('builds', 'share_token')) {
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_builds_share_token ON builds(share_token)',
    );
  }
  if (hasColumn.get('loadouts', 'share_token')) {
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_loadouts_share_token ON loadouts(share_token)',
    );
  }

  const ARCHON_MIGRATION_ID = '20260301_archon_shard_types_id_integer';
  if (!hasMigration.get(ARCHON_MIGRATION_ID)) {
    const archonCols = db
      .prepare('PRAGMA table_info(archon_shard_types)')
      .all() as {
      name: string;
      type: string;
    }[];
    const idCol = archonCols.find((c) => c.name === 'id');
    if (idCol && idCol.type.toUpperCase() === 'TEXT') {
      try {
        db.transaction(() => {
          db.exec(`
          CREATE TABLE archon_shard_types_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon_path TEXT NOT NULL,
            tauforged_icon_path TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
          );
        `);
          const oldTypes = db
            .prepare(
              'SELECT id, name, icon_path, tauforged_icon_path, sort_order FROM archon_shard_types ORDER BY sort_order, name',
            )
            .all() as {
            id: string;
            name: string;
            icon_path: string;
            tauforged_icon_path: string;
            sort_order: number;
          }[];
          const insertType = db.prepare(
            'INSERT INTO archon_shard_types_new (name, icon_path, tauforged_icon_path, sort_order) VALUES (?, ?, ?, ?)',
          );
          const typeIdMap = new Map<string, number>();
          for (const row of oldTypes) {
            const result = insertType.run(
              row.name,
              row.icon_path,
              row.tauforged_icon_path,
              row.sort_order,
            );
            typeIdMap.set(
              row.id,
              (result as { lastInsertRowid: number }).lastInsertRowid,
            );
          }
          const oldBuffs = db
            .prepare(
              'SELECT shard_type_id, description, base_value, tauforged_value, value_format, sort_order FROM archon_shard_buffs',
            )
            .all() as {
            shard_type_id: string;
            description: string;
            base_value: number;
            tauforged_value: number;
            value_format: string;
            sort_order: number;
          }[];
          db.exec(`DROP TABLE archon_shard_buffs`);
          db.exec(`DROP TABLE archon_shard_types`);
          db.exec(
            `ALTER TABLE archon_shard_types_new RENAME TO archon_shard_types`,
          );
          db.exec(`
          CREATE TABLE archon_shard_buffs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shard_type_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            base_value REAL NOT NULL,
            tauforged_value REAL NOT NULL,
            value_format TEXT DEFAULT '%',
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (shard_type_id) REFERENCES archon_shard_types(id)
          );
        `);
          const insertBuff = db.prepare(
            'INSERT INTO archon_shard_buffs (shard_type_id, description, base_value, tauforged_value, value_format, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
          );
          for (const row of oldBuffs) {
            const newTypeId = typeIdMap.get(row.shard_type_id);
            if (newTypeId === undefined) {
              const msg = `Migration failed: archon_shard_buffs row has unmapped shard_type_id "${row.shard_type_id}" (typeIdMap has no mapping; oldBuffs/insertBuff migration cannot proceed)`;
              console.error(`[DB] ${msg}`);
              throw new Error(msg);
            }
            insertBuff.run(
              newTypeId,
              row.description,
              row.base_value,
              row.tauforged_value,
              row.value_format,
              row.sort_order,
            );
          }
        })();
        markMigration.run(ARCHON_MIGRATION_ID);
        console.log(
          '[DB] Migration: archon_shard_types id TEXT -> INTEGER AUTOINCREMENT',
        );
      } catch (err) {
        console.error('[DB] Migration failed, rolled back:', err);
        throw err;
      }
    }
  }

  console.log('[DB] Application schema created/verified');
}
