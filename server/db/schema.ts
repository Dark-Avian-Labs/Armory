import { ensureImportRunsSchema } from '../import/importRuns.js';
import { getDb } from './connection.js';

export function createAppSchema(): void {
  const db = getDb();
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
      exclude_from_codex INTEGER DEFAULT 0,
      artifact_slots TEXT,
      passive_description_wiki TEXT
    );

    -- Warframe abilities
    CREATE TABLE IF NOT EXISTS abilities (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      warframe_unique_name TEXT,
      is_helminth_extractable INTEGER DEFAULT 0,
      image_path TEXT,
      ability_stats TEXT,
      wiki_stats TEXT,
      energy_cost INTEGER,
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
      exclude_from_codex INTEGER DEFAULT 0,
      artifact_slots TEXT,
      fire_behaviors TEXT,
      has_incarnon INTEGER DEFAULT 0,
      incarnon_data TEXT
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
      codex_secret INTEGER DEFAULT 0,
      artifact_slots TEXT
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
      augment_for_ability TEXT,
      subtype TEXT,                -- For augments: warframe unique_name
      mod_set TEXT REFERENCES mod_sets(unique_name),
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
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
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
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
      share_token TEXT,
      equipment_type TEXT NOT NULL,       -- warframe, primary, secondary, melee, etc.
      equipment_unique_name TEXT NOT NULL,
      mod_config TEXT NOT NULL,           -- JSON: full mod configuration
      helminth_config TEXT,               -- JSON: helminth ability replacement (if any)
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS build_favorites (
      clerk_user_id TEXT NOT NULL,
      build_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (clerk_user_id, build_id),
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE
    );

    -- Codex sync: resolved Warframe Market URLs (see server/warframeMarket/)
    CREATE TABLE IF NOT EXISTS warframe_market_links (
      canonical_key TEXT NOT NULL,
      worksheet_category TEXT NOT NULL,
      market_href TEXT,
      market_href_prime TEXT,
      link_kind TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (canonical_key, worksheet_category)
    );
    CREATE INDEX IF NOT EXISTS idx_warframe_market_links_category ON warframe_market_links(worksheet_category);

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_mods_type ON mods(type);
    CREATE INDEX IF NOT EXISTS idx_mods_rarity ON mods(rarity);
    CREATE INDEX IF NOT EXISTS idx_mods_compat ON mods(compat_name);
    CREATE INDEX IF NOT EXISTS idx_weapons_category ON weapons(product_category);
    CREATE INDEX IF NOT EXISTS idx_weapons_slot ON weapons(slot);
    CREATE INDEX IF NOT EXISTS idx_abilities_warframe ON abilities(warframe_unique_name);
    CREATE INDEX IF NOT EXISTS idx_build_favorites_user ON build_favorites(clerk_user_id);
  `);

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

  ensureImportRunsSchema(db);

  console.log('[DB] Application schema created/verified');
}
