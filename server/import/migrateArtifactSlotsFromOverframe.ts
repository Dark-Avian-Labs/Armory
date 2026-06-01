import type Database from 'better-sqlite3';

import { WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT } from '../../shared/artifactSlotState.js';
import { getDb } from '../db/connection.js';

export const ARTIFACT_SLOTS_FROM_OVERFRAME_MIGRATION_ID = '20260531_artifact_slots_from_overframe';

/** Jade — only warframe whose Overframe artifact layout we preserve. */
export const JADE_WARFRAME_UNIQUE_NAME = '/Lotus/Powersuits/Choir/Choir';

const NECRAMECH_CATEGORIES = new Set(['Necramechs', 'MechSuits']);

export function isNecramechProductCategory(productCategory: string | null | undefined): boolean {
  return productCategory != null && NECRAMECH_CATEGORIES.has(productCategory);
}

function parseArtifactSlots(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Fold legacy Overframe Jade rows (often 12–13 slots) into the 11-slot extended layout:
 * 8 general, aura @8, aura2 @9, exilus @10.
 */
export function migrateJadeArtifactSlots(legacy: string[]): string[] {
  const general = legacy.slice(0, 8);
  while (general.length < 8) general.push('AP_UNIVERSAL');

  const aura = legacy[8] ?? 'AP_UNIVERSAL';
  const aura2 =
    legacy.find((ap, i) => i > 8 && ap !== 'AP_UNIVERSAL' && ap !== 'AP_DISABLED') ??
    legacy[10] ??
    legacy[9] ??
    'AP_ANY';
  const exilus =
    legacy[9] != null && legacy[9] !== aura2 ? legacy[9] : (legacy[11] ?? 'AP_UNIVERSAL');

  return [...general, aura, aura2, exilus];
}

/** Keep the first 12 general polarities from Overframe necramech rows. */
export function migrateNecramechArtifactSlots(legacy: string[]): string[] {
  const result = legacy.slice(0, 12);
  while (result.length < 12) result.push('AP_UNIVERSAL');
  return result;
}

export interface ArtifactSlotsMigrationSummary {
  dryRun: boolean;
  warframesCleared: number;
  warframesJadeUpdated: number;
  warframesNecramechUpdated: number;
  weaponsCleared: number;
  companionsCleared: number;
}

export function migrateArtifactSlotsFromOverframe(
  db: Database.Database,
  options?: { dryRun?: boolean },
): ArtifactSlotsMigrationSummary {
  const dryRun = options?.dryRun ?? false;
  const summary: ArtifactSlotsMigrationSummary = {
    dryRun,
    warframesCleared: 0,
    warframesJadeUpdated: 0,
    warframesNecramechUpdated: 0,
    weaponsCleared: 0,
    companionsCleared: 0,
  };

  const clearWarframe = db.prepare(
    'UPDATE warframes SET artifact_slots = NULL WHERE unique_name = ?',
  );
  const updateWarframe = db.prepare(
    'UPDATE warframes SET artifact_slots = ? WHERE unique_name = ?',
  );
  const clearWeapons = db.prepare(
    `UPDATE weapons SET artifact_slots = NULL WHERE artifact_slots IS NOT NULL`,
  );
  const clearCompanions = db.prepare(
    `UPDATE companions SET artifact_slots = NULL WHERE artifact_slots IS NOT NULL`,
  );

  const warframes = db
    .prepare(`SELECT unique_name, name, product_category, artifact_slots FROM warframes`)
    .all() as Array<{
    unique_name: string;
    name: string;
    product_category: string | null;
    artifact_slots: string | null;
  }>;

  const apply = (fn: () => void) => {
    if (!dryRun) fn();
  };

  for (const row of warframes) {
    if (row.unique_name === JADE_WARFRAME_UNIQUE_NAME || row.name === 'Jade') {
      const legacy = parseArtifactSlots(row.artifact_slots);
      if (legacy.length === 0) continue;
      const migrated = migrateJadeArtifactSlots(legacy);
      if (migrated.length !== WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT) continue;
      summary.warframesJadeUpdated += 1;
      apply(() => updateWarframe.run(JSON.stringify(migrated), row.unique_name));
      continue;
    }

    if (isNecramechProductCategory(row.product_category)) {
      const legacy = parseArtifactSlots(row.artifact_slots);
      if (legacy.length === 0) continue;
      const migrated = migrateNecramechArtifactSlots(legacy);
      summary.warframesNecramechUpdated += 1;
      apply(() => updateWarframe.run(JSON.stringify(migrated), row.unique_name));
      continue;
    }

    if (row.artifact_slots == null) continue;
    summary.warframesCleared += 1;
    apply(() => clearWarframe.run(row.unique_name));
  }

  const weaponCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM weapons WHERE artifact_slots IS NOT NULL`).get() as {
      c: number;
    }
  ).c;
  if (weaponCount > 0) {
    summary.weaponsCleared = weaponCount;
    apply(() => clearWeapons.run());
  }

  const companionCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM companions WHERE artifact_slots IS NOT NULL`).get() as {
      c: number;
    }
  ).c;
  if (companionCount > 0) {
    summary.companionsCleared = companionCount;
    apply(() => clearCompanions.run());
  }

  return summary;
}

function hasMigrationApplied(db: Database.Database, id: string): boolean {
  const row = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').get(id);
  return row != null;
}

function markMigrationApplied(db: Database.Database, id: string): void {
  db.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run(id);
}

/** True when the DB still has Overframe-era artifact slot rows worth converting. */
export function hasLegacyOverframeArtifactSlotData(db: Database.Database): boolean {
  const weaponCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM weapons WHERE artifact_slots IS NOT NULL`).get() as {
      c: number;
    }
  ).c;
  if (weaponCount > 0) return true;

  const companionCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM companions WHERE artifact_slots IS NOT NULL`).get() as {
      c: number;
    }
  ).c;
  if (companionCount > 0) return true;

  const warframes = db
    .prepare(
      `SELECT unique_name, name, product_category, artifact_slots FROM warframes WHERE artifact_slots IS NOT NULL`,
    )
    .all() as Array<{
    unique_name: string;
    name: string;
    product_category: string | null;
    artifact_slots: string;
  }>;

  for (const row of warframes) {
    const slots = parseArtifactSlots(row.artifact_slots);
    if (slots.length === 0) continue;

    if (row.unique_name === JADE_WARFRAME_UNIQUE_NAME || row.name === 'Jade') {
      if (slots.length !== WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT) return true;
      continue;
    }

    if (isNecramechProductCategory(row.product_category)) {
      if (slots.length > 12) return true;
      continue;
    }

    return true;
  }

  return false;
}

/** Runs once per database on server boot (tracked in schema_migrations). */
export function runArtifactSlotsFromOverframeMigrationOnStartup(): void {
  const db = getDb();
  const migrationId = ARTIFACT_SLOTS_FROM_OVERFRAME_MIGRATION_ID;

  if (hasMigrationApplied(db, migrationId)) {
    return;
  }

  if (!hasLegacyOverframeArtifactSlotData(db)) {
    markMigrationApplied(db, migrationId);
    return;
  }

  try {
    const summary = migrateArtifactSlotsFromOverframe(db);
    markMigrationApplied(db, migrationId);
    console.log(
      `[DB] Migration ${migrationId}: cleared ${summary.warframesCleared} warframe(s), ` +
        `Jade ${summary.warframesJadeUpdated}, necramech ${summary.warframesNecramechUpdated}, ` +
        `weapons ${summary.weaponsCleared}, companions ${summary.companionsCleared}`,
    );
  } catch (err) {
    console.error(`[DB] Migration ${migrationId} failed:`, err);
    throw err;
  }
}
