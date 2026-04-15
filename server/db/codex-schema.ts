import type Database from 'better-sqlite3';

export function createCodexSchema(db: Database.Database): void {
  db.exec(`
    -- Warframes (includes Archwings, Necramechs)
    CREATE TABLE IF NOT EXISTS codex_warframes (
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
      mastery_req INTEGER DEFAULT 0,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_warframes_name ON codex_warframes(name);

    -- Weapons (all types)
    CREATE TABLE IF NOT EXISTS codex_weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      product_category TEXT,
      slot INTEGER,
      mastery_req INTEGER DEFAULT 0,
      total_damage REAL,
      damage_per_shot TEXT,
      critical_chance REAL,
      critical_multiplier REAL,
      proc_chance REAL,
      fire_rate REAL,
      accuracy REAL,
      magazine_size INTEGER,
      reload_time REAL,
      multishot REAL,
      noise TEXT,
      trigger_type TEXT,
      omega_attenuation REAL,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_weapons_name ON codex_weapons(name);
    CREATE INDEX IF NOT EXISTS idx_codex_weapons_category ON codex_weapons(product_category);

    -- Companions (Sentinels, Kubrows, Kavats, etc.)
    CREATE TABLE IF NOT EXISTS codex_sentinels (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      health REAL,
      shield REAL,
      armor REAL,
      power REAL,
      product_category TEXT,
      mastery_req INTEGER DEFAULT 0,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_sentinels_name ON codex_sentinels(name);

    -- Mods / Upgrades
    CREATE TABLE IF NOT EXISTS codex_upgrades (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      polarity TEXT,
      rarity TEXT,
      type TEXT,
      compat_name TEXT,
      base_drain INTEGER,
      fusion_limit INTEGER,
      level_stats TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_upgrades_name ON codex_upgrades(name);
    CREATE INDEX IF NOT EXISTS idx_codex_upgrades_type ON codex_upgrades(type);

    -- Relics & Arcanes
    CREATE TABLE IF NOT EXISTS codex_relic_arcane (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT,
      level_stats TEXT,
      raw_json TEXT NOT NULL
    );
      CREATE INDEX IF NOT EXISTS idx_codex_relic_arcane_name ON codex_relic_arcane(name);

    -- Manifest (image/texture mapping)
    CREATE TABLE IF NOT EXISTS codex_manifest (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      texture_location TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_manifest_name ON codex_manifest(name);

    -- Customs (skins, cosmetics)
    CREATE TABLE IF NOT EXISTS codex_customs (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_customs_name ON codex_customs(name);

    -- Drones (extractors)
    CREATE TABLE IF NOT EXISTS codex_drones (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_drones_name ON codex_drones(name);

    -- Flavour (lore text, faction descriptions)
    CREATE TABLE IF NOT EXISTS codex_flavour (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_flavour_name ON codex_flavour(name);

    -- Fusion Bundles (endo/fusion items)
    CREATE TABLE IF NOT EXISTS codex_fusion_bundles (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_fusion_bundles_name ON codex_fusion_bundles(name);

    -- Gear (gear wheel items)
    CREATE TABLE IF NOT EXISTS codex_gear (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_gear_name ON codex_gear(name);

    -- Keys (quest keys, mission keys)
    CREATE TABLE IF NOT EXISTS codex_keys (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_keys_name ON codex_keys(name);

    -- Recipes (crafting recipes)
    CREATE TABLE IF NOT EXISTS codex_recipes (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      result_type TEXT,
      build_price INTEGER,
      build_time INTEGER,
      build_count INTEGER,
      ingredients TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_recipes_name ON codex_recipes(name);

    -- Regions (star chart)
    CREATE TABLE IF NOT EXISTS codex_regions (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_regions_name ON codex_regions(name);

    -- Resources
    CREATE TABLE IF NOT EXISTS codex_resources (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      product_category TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_resources_name ON codex_resources(name);

    -- Sortie Rewards
    CREATE TABLE IF NOT EXISTS codex_sortie_rewards (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_sortie_rewards_name ON codex_sortie_rewards(name);

    -- Intrinsics (Railjack intrinsic categories)
    CREATE TABLE IF NOT EXISTS codex_intrinsics (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_intrinsics_name ON codex_intrinsics(name);

    -- Other (miscellaneous store items)
    CREATE TABLE IF NOT EXISTS codex_other (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_other_name ON codex_other(name);

    -- Mod Sets (set bonus definitions)
    CREATE TABLE IF NOT EXISTS codex_mod_sets (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      num_in_set INTEGER,
      stats TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_mod_sets_name ON codex_mod_sets(name);

    -- Avionics (Railjack mods)
    CREATE TABLE IF NOT EXISTS codex_avionics (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      polarity TEXT,
      rarity TEXT,
      base_drain INTEGER,
      fusion_limit INTEGER,
      level_stats TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_avionics_name ON codex_avionics(name);

    -- Focus Upgrades (Focus school nodes)
    CREATE TABLE IF NOT EXISTS codex_focus_upgrades (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      polarity TEXT,
      rarity TEXT,
      base_drain INTEGER,
      fusion_limit INTEGER,
      level_stats TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_focus_upgrades_name ON codex_focus_upgrades(name);

    -- Abilities (Helminth-infusable abilities)
    CREATE TABLE IF NOT EXISTS codex_abilities (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_abilities_name ON codex_abilities(name);

    -- Railjack Weapons
    CREATE TABLE IF NOT EXISTS codex_railjack_weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      product_category TEXT,
      total_damage REAL,
      damage_per_shot TEXT,
      critical_chance REAL,
      critical_multiplier REAL,
      proc_chance REAL,
      fire_rate REAL,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_codex_railjack_weapons_name ON codex_railjack_weapons(name);

    -- Nightwave (single-row: challenges + rewards)
    CREATE TABLE IF NOT EXISTS codex_nightwave (
      id TEXT PRIMARY KEY DEFAULT 'current',
      name TEXT,
      raw_json TEXT NOT NULL
    );

    -- Railjack Nodes (single-row: node list)
    CREATE TABLE IF NOT EXISTS codex_railjack_nodes (
      id TEXT PRIMARY KEY DEFAULT 'current',
      name TEXT,
      raw_json TEXT NOT NULL
    );
  `);

  db.exec(`
    DROP VIEW IF EXISTS codex_search;
    CREATE VIEW codex_search AS
      SELECT unique_name, name, 'warframe' AS category, raw_json FROM codex_warframes
      UNION ALL
      SELECT unique_name, name, 'weapon' AS category, raw_json FROM codex_weapons
      UNION ALL
      SELECT unique_name, name, 'sentinel' AS category, raw_json FROM codex_sentinels
      UNION ALL
      SELECT unique_name, name, 'upgrade' AS category, raw_json FROM codex_upgrades
      UNION ALL
      SELECT unique_name, name, 'relic_arcane' AS category, raw_json FROM codex_relic_arcane
      UNION ALL
      SELECT unique_name, name, 'custom' AS category, raw_json FROM codex_customs
      UNION ALL
      SELECT unique_name, name, 'drone' AS category, raw_json FROM codex_drones
      UNION ALL
      SELECT unique_name, name, 'flavour' AS category, raw_json FROM codex_flavour
      UNION ALL
      SELECT unique_name, name, 'fusion_bundle' AS category, raw_json FROM codex_fusion_bundles
      UNION ALL
      SELECT unique_name, name, 'gear' AS category, raw_json FROM codex_gear
      UNION ALL
      SELECT unique_name, name, 'key' AS category, raw_json FROM codex_keys
      UNION ALL
      SELECT unique_name, name, 'recipe' AS category, raw_json FROM codex_recipes
      UNION ALL
      SELECT unique_name, name, 'region' AS category, raw_json FROM codex_regions
      UNION ALL
      SELECT unique_name, name, 'resource' AS category, raw_json FROM codex_resources
      UNION ALL
      SELECT unique_name, name, 'sortie_reward' AS category, raw_json FROM codex_sortie_rewards
      UNION ALL
      SELECT unique_name, name, 'intrinsic' AS category, raw_json FROM codex_intrinsics
      UNION ALL
      SELECT unique_name, name, 'other' AS category, raw_json FROM codex_other
      UNION ALL
      SELECT unique_name, name, 'mod_set' AS category, raw_json FROM codex_mod_sets
      UNION ALL
      SELECT unique_name, name, 'avionic' AS category, raw_json FROM codex_avionics
      UNION ALL
      SELECT unique_name, name, 'focus_upgrade' AS category, raw_json FROM codex_focus_upgrades
      UNION ALL
      SELECT unique_name, name, 'ability' AS category, raw_json FROM codex_abilities
      UNION ALL
      SELECT unique_name, name, 'railjack_weapon' AS category, raw_json FROM codex_railjack_weapons
    ;
  `);

  console.log('[Armory] Codex export schema created/verified');
}
