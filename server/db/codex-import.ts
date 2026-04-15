import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import { EXPORTS_DIR } from '../config.js';
import { getCodexDb } from './codex.js';

interface ImportResult {
  category: string;
  table: string;
  count: number;
  failureCount?: number;
  error?: string;
}

const EXPORT_KEY_TO_TABLE: Record<string, string> = {
  ExportWarframes: 'codex_warframes',
  ExportWeapons: 'codex_weapons',
  ExportSentinels: 'codex_sentinels',
  ExportUpgrades: 'codex_upgrades',
  ExportRelicArcane: 'codex_relic_arcane',
  Manifest: 'codex_manifest',
  ExportCustoms: 'codex_customs',
  ExportDrones: 'codex_drones',
  ExportFlavour: 'codex_flavour',
  ExportFusionBundles: 'codex_fusion_bundles',
  ExportGear: 'codex_gear',
  ExportKeys: 'codex_keys',
  ExportRecipes: 'codex_recipes',
  ExportRegions: 'codex_regions',
  ExportResources: 'codex_resources',
  ExportSortieRewards: 'codex_sortie_rewards',
  ExportIntrinsics: 'codex_intrinsics',
  ExportOther: 'codex_other',
  ExportModSet: 'codex_mod_sets',
  ExportAvionics: 'codex_avionics',
  ExportFocusUpgrades: 'codex_focus_upgrades',
  ExportAbilities: 'codex_abilities',
  ExportRailjackWeapons: 'codex_railjack_weapons',
};

const OBJECT_KEY_TO_TABLE: Record<string, string> = {
  ExportNightwave: 'codex_nightwave',
  ExportRailjack: 'codex_railjack_nodes',
};

type ColumnExtractor = (item: Record<string, unknown>) => Record<string, unknown>;

function stableSerialize(value: unknown): string {
  function normalizeForStableStringify(input: unknown): unknown {
    if (Array.isArray(input)) {
      return input.map((entry) => normalizeForStableStringify(entry));
    }

    if (input && typeof input === 'object') {
      const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      );
      return Object.fromEntries(
        entries.map(([key, entry]) => [key, normalizeForStableStringify(entry)]),
      );
    }

    return input;
  }

  return JSON.stringify(normalizeForStableStringify(value));
}

function deterministicUniqueName(item: Record<string, unknown>, prefix: string): string {
  const contentHash = createHash('sha1').update(stableSerialize(item)).digest('hex').slice(0, 16);
  return `${prefix}_${contentHash}`;
}

const EXTRACTORS: Record<string, ColumnExtractor> = {
  codex_warframes: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || '',
    description: item.description || null,
    health: item.health ?? null,
    shield: item.shield ?? null,
    armor: item.armor ?? null,
    power: item.power ?? null,
    sprint_speed: item.sprintSpeed ?? null,
    stamina: item.stamina ?? null,
    passive_description: item.passiveDescription ?? null,
    product_category: item.productCategory ?? null,
    mastery_req: item.masteryReq ?? 0,
  }),

  codex_weapons: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || '',
    description: item.description || null,
    product_category: item.productCategory ?? null,
    slot: item.slot ?? null,
    mastery_req: item.masteryReq ?? 0,
    total_damage: item.totalDamage ?? null,
    damage_per_shot: item.damagePerShot ? JSON.stringify(item.damagePerShot) : null,
    critical_chance: item.criticalChance ?? null,
    critical_multiplier: item.criticalMultiplier ?? null,
    proc_chance: item.procChance ?? null,
    fire_rate: item.fireRate ?? null,
    accuracy: item.accuracy ?? null,
    magazine_size: item.magazineSize ?? null,
    reload_time: item.reloadTime ?? null,
    multishot: item.multishot ?? null,
    noise: item.noise ?? null,
    trigger_type: item.trigger ?? null,
    omega_attenuation: item.omegaAttenuation ?? null,
  }),

  codex_sentinels: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || '',
    description: item.description || null,
    health: item.health ?? null,
    shield: item.shield ?? null,
    armor: item.armor ?? null,
    power: item.power ?? null,
    product_category: item.productCategory ?? null,
    mastery_req: item.masteryReq ?? 0,
  }),

  codex_upgrades: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || '',
    polarity: item.polarity ?? null,
    rarity: item.rarity ?? null,
    type: item.type ?? null,
    compat_name: item.compatName ?? null,
    base_drain: item.baseDrain ?? null,
    fusion_limit: item.fusionLimit ?? null,
    level_stats: item.levelStats ? JSON.stringify(item.levelStats) : null,
  }),

  codex_relic_arcane: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || '',
    description: item.description || null,
    rarity: item.rarity ?? null,
    level_stats: item.levelStats ? JSON.stringify(item.levelStats) : null,
  }),

  codex_manifest: (item) => ({
    unique_name: item.uniqueName,
    name:
      String(item.uniqueName || '')
        .split('/')
        .pop() || null,
    texture_location: item.textureLocation ?? null,
  }),

  codex_customs: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
  }),

  codex_drones: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
  }),

  codex_flavour: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
    description: item.description || null,
  }),

  codex_fusion_bundles: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
  }),

  codex_gear: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
    description: item.description || null,
  }),

  codex_keys: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
    description: item.description || null,
  }),

  codex_recipes: (item) => ({
    unique_name: item.uniqueName,
    name: item.resultType ? String(item.resultType).split('/').pop() : null,
    result_type: item.resultType ?? null,
    build_price: item.buildPrice ?? null,
    build_time: item.buildTime ?? null,
    build_count: item.buildCount ?? null,
    ingredients: item.ingredients ? JSON.stringify(item.ingredients) : null,
  }),

  codex_regions: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
  }),

  codex_resources: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
    description: item.description || null,
    product_category: item.productCategory ?? null,
  }),

  codex_sortie_rewards: (item) => ({
    unique_name: item.uniqueName || item.rewardName || deterministicUniqueName(item, 'sortie'),
    name: item.name || item.rewardName || null,
  }),

  codex_intrinsics: (item) => ({
    unique_name: item.uniqueName || item.name || deterministicUniqueName(item, 'intrinsic'),
    name: item.name || null,
  }),

  codex_other: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
    description: item.description || null,
  }),

  codex_mod_sets: (item) => ({
    unique_name: item.uniqueName,
    name: item.uniqueName ? String(item.uniqueName).split('/').pop() : null,
    num_in_set: item.numUpgradesInSet ?? null,
    stats: item.stats ? JSON.stringify(item.stats) : null,
  }),

  codex_avionics: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
    polarity: item.polarity ?? null,
    rarity: item.rarity ?? null,
    base_drain: item.baseDrain ?? null,
    fusion_limit: item.fusionLimit ?? null,
    level_stats: item.levelStats ? JSON.stringify(item.levelStats) : null,
  }),

  codex_focus_upgrades: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
    polarity: item.polarity ?? null,
    rarity: item.rarity ?? null,
    base_drain: item.baseDrain ?? null,
    fusion_limit: item.fusionLimit ?? null,
    level_stats: item.levelStats ? JSON.stringify(item.levelStats) : null,
  }),

  codex_abilities: (item) => ({
    unique_name: item.abilityUniqueName || item.uniqueName,
    name: item.abilityName || item.name || null,
    description: item.description || null,
  }),

  codex_railjack_weapons: (item) => ({
    unique_name: item.uniqueName,
    name: item.name || null,
    description: item.description || null,
    product_category: item.productCategory ?? null,
    total_damage: item.totalDamage ?? null,
    damage_per_shot: item.damagePerShot ? JSON.stringify(item.damagePerShot) : null,
    critical_chance: item.criticalChance ?? null,
    critical_multiplier: item.criticalMultiplier ?? null,
    proc_chance: item.procChance ?? null,
    fire_rate: item.fireRate ?? null,
  }),
};

function defaultExtractor(item: Record<string, unknown>): Record<string, unknown> {
  return {
    unique_name: item.uniqueName,
    name: item.name || null,
  };
}

function importCategory(
  tableName: string,
  items: Record<string, unknown>[],
): { count: number; failureCount: number } {
  const db = getCodexDb();
  const extractor = EXTRACTORS[tableName] || defaultExtractor;

  if (items.length === 0) return { count: 0, failureCount: 0 };

  const sampleCols = extractor(items[0]);
  const colNames = [...Object.keys(sampleCols), 'raw_json'];
  const placeholders = colNames.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${tableName} (${colNames.join(', ')}) VALUES (${placeholders})`;

  const stmt = db.prepare(sql);
  const insertMany = db.transaction((entries: Record<string, unknown>[]) => {
    let count = 0;
    let failureCount = 0;
    for (const item of entries) {
      const extracted = extractor(item);
      if (!extracted.unique_name) continue;

      const rawJson = JSON.stringify(item);
      const values = [...Object.values(extracted), rawJson];
      try {
        stmt.run(...values);
        count++;
      } catch (e) {
        failureCount++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[Armory] Failed to insert row into ${tableName} (unique_name=${String(extracted.unique_name)}): ${msg}`,
        );
      }
    }
    return { count, failureCount };
  });

  return insertMany(items);
}

export function importAllToCodexExport(): ImportResult[] {
  const results: ImportResult[] = [];

  if (!fs.existsSync(EXPORTS_DIR)) {
    return [
      {
        category: 'error',
        table: '',
        count: 0,
        error: 'Exports directory not found',
      },
    ];
  }

  const files = fs.readdirSync(EXPORTS_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(EXPORTS_DIR, file);
    const category = file.replace('.json', '');

    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      const content = JSON.parse(text) as Record<string, unknown>;

      for (const [key, value] of Object.entries(content)) {
        if (Array.isArray(value)) {
          const tableName = EXPORT_KEY_TO_TABLE[key];
          if (!tableName) {
            console.log(`[Armory] Skipping unknown export array: ${key} (${value.length} items)`);
            continue;
          }

          const { count, failureCount } = importCategory(
            tableName,
            value as Record<string, unknown>[],
          );
          results.push({
            category: `${category}/${key}`,
            table: tableName,
            count,
            ...(failureCount > 0 ? { failureCount } : {}),
          });
          if (failureCount > 0) {
            console.error(
              `[Armory] Imported ${count} items into ${tableName} from ${key} with ${failureCount} insert failures`,
            );
          } else {
            console.log(`[Armory] Imported ${count} items into ${tableName} from ${key}`);
          }
        } else if (typeof value === 'object' && value !== null) {
          const tableName = OBJECT_KEY_TO_TABLE[key];
          if (!tableName) {
            console.log(`[Armory] Skipping unknown export object: ${key}`);
            continue;
          }

          const db = getCodexDb();
          const rawJson = JSON.stringify(value);
          db.prepare(
            `INSERT OR REPLACE INTO ${tableName} (id, name, raw_json) VALUES (?, ?, ?)`,
          ).run('current', key, rawJson);
          results.push({
            category: `${category}/${key}`,
            table: tableName,
            count: 1,
          });
          console.log(`[Armory] Imported object ${key} into ${tableName}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ category, table: '', count: 0, error: msg });
      console.error(`[Armory] Failed to import ${category}: ${msg}`);
    }
  }

  return results;
}
