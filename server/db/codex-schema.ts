import type Database from 'better-sqlite3';

export function createCodexSchema(db: Database.Database): void {
  db.exec(`
    -- Warframes (includes Archwings, Necramechs)
    CREATE TABLE IF NOT EXISTS corpus_warframes (
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
    CREATE INDEX IF NOT EXISTS idx_corpus_warframes_name ON corpus_warframes(name);

    -- Weapons (all types)
    CREATE TABLE IF NOT EXISTS corpus_weapons (
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
    CREATE INDEX IF NOT EXISTS idx_corpus_weapons_name ON corpus_weapons(name);
    CREATE INDEX IF NOT EXISTS idx_corpus_weapons_category ON corpus_weapons(product_category);

    -- Companions (Sentinels, Kubrows, Kavats, etc.)
    CREATE TABLE IF NOT EXISTS corpus_sentinels (
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
    CREATE INDEX IF NOT EXISTS idx_corpus_sentinels_name ON corpus_sentinels(name);

    -- Mods / Upgrades
    CREATE TABLE IF NOT EXISTS corpus_upgrades (
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
    CREATE INDEX IF NOT EXISTS idx_corpus_upgrades_name ON corpus_upgrades(name);
    CREATE INDEX IF NOT EXISTS idx_corpus_upgrades_type ON corpus_upgrades(type);

    -- Relics & Arcanes
    CREATE TABLE IF NOT EXISTS corpus_relic_arcane (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT,
      level_stats TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_relic_arcane_name ON corpus_relic_arcane(name);

    -- Manifest (image/texture mapping)
    CREATE TABLE IF NOT EXISTS corpus_manifest (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      texture_location TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_manifest_name ON corpus_manifest(name);

    -- Customs (skins, cosmetics)
    CREATE TABLE IF NOT EXISTS corpus_customs (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_customs_name ON corpus_customs(name);

    -- Drones (extractors)
    CREATE TABLE IF NOT EXISTS corpus_drones (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_drones_name ON corpus_drones(name);

    -- Flavour (lore text, faction descriptions)
    CREATE TABLE IF NOT EXISTS corpus_flavour (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_flavour_name ON corpus_flavour(name);

    -- Fusion Bundles (endo/fusion items)
    CREATE TABLE IF NOT EXISTS corpus_fusion_bundles (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_fusion_bundles_name ON corpus_fusion_bundles(name);

    -- Gear (gear wheel items)
    CREATE TABLE IF NOT EXISTS corpus_gear (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_gear_name ON corpus_gear(name);

    -- Keys (quest keys, mission keys)
    CREATE TABLE IF NOT EXISTS corpus_keys (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_keys_name ON corpus_keys(name);

    -- Recipes (crafting recipes)
    CREATE TABLE IF NOT EXISTS corpus_recipes (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      result_type TEXT,
      build_price INTEGER,
      build_time INTEGER,
      build_count INTEGER,
      ingredients TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_recipes_name ON corpus_recipes(name);

    -- Regions (star chart)
    CREATE TABLE IF NOT EXISTS corpus_regions (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_regions_name ON corpus_regions(name);

    -- Resources
    CREATE TABLE IF NOT EXISTS corpus_resources (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      product_category TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_resources_name ON corpus_resources(name);

    -- Sortie Rewards
    CREATE TABLE IF NOT EXISTS corpus_sortie_rewards (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_sortie_rewards_name ON corpus_sortie_rewards(name);

    -- Intrinsics (Railjack intrinsic categories)
    CREATE TABLE IF NOT EXISTS corpus_intrinsics (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_intrinsics_name ON corpus_intrinsics(name);

    -- Other (miscellaneous store items)
    CREATE TABLE IF NOT EXISTS corpus_other (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_other_name ON corpus_other(name);

    -- Mod Sets (set bonus definitions)
    CREATE TABLE IF NOT EXISTS corpus_mod_sets (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      num_in_set INTEGER,
      stats TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_mod_sets_name ON corpus_mod_sets(name);

    -- Avionics (Railjack mods)
    CREATE TABLE IF NOT EXISTS corpus_avionics (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      polarity TEXT,
      rarity TEXT,
      base_drain INTEGER,
      fusion_limit INTEGER,
      level_stats TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_avionics_name ON corpus_avionics(name);

    -- Focus Upgrades (Focus school nodes)
    CREATE TABLE IF NOT EXISTS corpus_focus_upgrades (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      polarity TEXT,
      rarity TEXT,
      base_drain INTEGER,
      fusion_limit INTEGER,
      level_stats TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_focus_upgrades_name ON corpus_focus_upgrades(name);

    -- Abilities (Helminth-infusable abilities)
    CREATE TABLE IF NOT EXISTS corpus_abilities (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_corpus_abilities_name ON corpus_abilities(name);

    -- Railjack Weapons
    CREATE TABLE IF NOT EXISTS corpus_railjack_weapons (
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
    CREATE INDEX IF NOT EXISTS idx_corpus_railjack_weapons_name ON corpus_railjack_weapons(name);

    -- Nightwave (single-row: challenges + rewards)
    CREATE TABLE IF NOT EXISTS corpus_nightwave (
      id TEXT PRIMARY KEY DEFAULT 'current',
      name TEXT,
      raw_json TEXT NOT NULL
    );

    -- Railjack Nodes (single-row: node list)
    CREATE TABLE IF NOT EXISTS corpus_railjack_nodes (
      id TEXT PRIMARY KEY DEFAULT 'current',
      name TEXT,
      raw_json TEXT NOT NULL
    );
  `);

  db.exec(`
    DROP VIEW IF EXISTS corpus_search;
    CREATE VIEW corpus_search AS
      SELECT unique_name, name, 'warframe' AS category, raw_json FROM corpus_warframes
      UNION ALL
      SELECT unique_name, name, 'weapon' AS category, raw_json FROM corpus_weapons
      UNION ALL
      SELECT unique_name, name, 'sentinel' AS category, raw_json FROM corpus_sentinels
      UNION ALL
      SELECT unique_name, name, 'upgrade' AS category, raw_json FROM corpus_upgrades
      UNION ALL
      SELECT unique_name, name, 'relic_arcane' AS category, raw_json FROM corpus_relic_arcane
      UNION ALL
      SELECT unique_name, name, 'custom' AS category, raw_json FROM corpus_customs
      UNION ALL
      SELECT unique_name, name, 'drone' AS category, raw_json FROM corpus_drones
      UNION ALL
      SELECT unique_name, name, 'flavour' AS category, raw_json FROM corpus_flavour
      UNION ALL
      SELECT unique_name, name, 'fusion_bundle' AS category, raw_json FROM corpus_fusion_bundles
      UNION ALL
      SELECT unique_name, name, 'gear' AS category, raw_json FROM corpus_gear
      UNION ALL
      SELECT unique_name, name, 'key' AS category, raw_json FROM corpus_keys
      UNION ALL
      SELECT unique_name, name, 'recipe' AS category, raw_json FROM corpus_recipes
      UNION ALL
      SELECT unique_name, name, 'region' AS category, raw_json FROM corpus_regions
      UNION ALL
      SELECT unique_name, name, 'resource' AS category, raw_json FROM corpus_resources
      UNION ALL
      SELECT unique_name, name, 'sortie_reward' AS category, raw_json FROM corpus_sortie_rewards
      UNION ALL
      SELECT unique_name, name, 'intrinsic' AS category, raw_json FROM corpus_intrinsics
      UNION ALL
      SELECT unique_name, name, 'other' AS category, raw_json FROM corpus_other
      UNION ALL
      SELECT unique_name, name, 'mod_set' AS category, raw_json FROM corpus_mod_sets
      UNION ALL
      SELECT unique_name, name, 'avionic' AS category, raw_json FROM corpus_avionics
      UNION ALL
      SELECT unique_name, name, 'focus_upgrade' AS category, raw_json FROM corpus_focus_upgrades
      UNION ALL
      SELECT unique_name, name, 'ability' AS category, raw_json FROM corpus_abilities
      UNION ALL
      SELECT unique_name, name, 'railjack_weapon' AS category, raw_json FROM corpus_railjack_weapons
    ;
  `);

  console.log('[Armory] Codex export schema created/verified');
}
