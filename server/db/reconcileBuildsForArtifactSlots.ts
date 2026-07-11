import type Database from 'better-sqlite3';

import {
  buildModSlotsAreEquivalent,
  reconcileStoredBuildModSlots,
  type BuildModSlot,
  type CatalogPolarityDefaults,
} from '../../shared/buildSlotLayout.js';
import { isCompanionWeapon } from '../../shared/companionWeapons.js';
import type { EquipmentSlotConfigKey } from '../../shared/equipmentSlotConfig.js';
import { parseBuildConfig } from '../routes/apiShared.js';

type CatalogEquipmentRow = {
  name?: string | null;
  product_category?: string | null;
  slot?: number | null;
  sentinel?: number | null;
  aura_polarity?: string | null;
  exilus_polarity?: string | null;
  polarities?: string | null;
};

type BuildRow = {
  id: number;
  equipment_type: string;
  mod_config: string;
};

function isEquipmentSlotConfigKey(value: string): value is EquipmentSlotConfigKey {
  return (
    value in
    {
      warframe: true,
      primary: true,
      secondary: true,
      melee: true,
      archgun: true,
      archmelee: true,
      companion: true,
      beast_claws: true,
      archwing: true,
      necramech: true,
      kdrive: true,
      tektolyst: true,
    }
  );
}

function readCatalogEquipmentRow(
  catalogDb: Database.Database,
  table: 'warframes' | 'weapons' | 'companions',
  uniqueName: string,
): CatalogEquipmentRow | null {
  if (table === 'warframes') {
    return (
      (catalogDb
        .prepare(
          `SELECT name, aura_polarity, exilus_polarity, polarities
             FROM warframes
            WHERE unique_name = ?`,
        )
        .get(uniqueName) as CatalogEquipmentRow | undefined) ?? null
    );
  }
  if (table === 'weapons') {
    return (
      (catalogDb
        .prepare(
          `SELECT name, product_category, slot, sentinel
             FROM weapons
            WHERE unique_name = ?`,
        )
        .get(uniqueName) as CatalogEquipmentRow | undefined) ?? null
    );
  }
  return (
    (catalogDb.prepare(`SELECT name FROM companions WHERE unique_name = ?`).get(uniqueName) as
      | CatalogEquipmentRow
      | undefined) ?? null
  );
}

function exportDefaultsForRow(
  row: CatalogEquipmentRow | null,
): CatalogPolarityDefaults | undefined {
  if (!row) return undefined;
  if (row.aura_polarity == null && row.exilus_polarity == null && row.polarities == null) {
    return undefined;
  }
  return {
    aura_polarity: row.aura_polarity,
    exilus_polarity: row.exilus_polarity,
    polarities: row.polarities,
  };
}

function parseExistingSlots(modConfig: Record<string, unknown> | null): BuildModSlot[] {
  if (!Array.isArray(modConfig?.slots)) return [];
  const slots: BuildModSlot[] = [];
  for (const entry of modConfig.slots) {
    if (!entry || typeof entry !== 'object') continue;
    const slot = entry as Record<string, unknown>;
    if (typeof slot.index !== 'number' || !Number.isInteger(slot.index) || slot.index < 0) {
      continue;
    }
    if (
      slot.type !== 'general' &&
      slot.type !== 'aura' &&
      slot.type !== 'stance' &&
      slot.type !== 'exilus' &&
      slot.type !== 'posture'
    ) {
      continue;
    }
    slots.push({
      index: slot.index,
      type: slot.type,
      ...(typeof slot.polarity === 'string' ? { polarity: slot.polarity } : {}),
      ...(slot.mod && typeof slot.mod === 'object'
        ? { mod: slot.mod as Record<string, unknown> }
        : {}),
      ...(typeof slot.rank === 'number' ? { rank: slot.rank } : {}),
      ...(typeof slot.setRank === 'number' ? { setRank: slot.setRank } : {}),
      ...(slot.riven_config !== undefined ? { riven_config: slot.riven_config } : {}),
      ...(typeof slot.riven_art_path === 'string' ? { riven_art_path: slot.riven_art_path } : {}),
    });
  }
  return slots;
}

export function reconcileBuildsForArtifactSlotChange(
  userDb: Database.Database,
  catalogDb: Database.Database,
  table: 'warframes' | 'weapons' | 'companions',
  uniqueName: string,
  artifactSlots: string[],
): number {
  const equipmentRow = readCatalogEquipmentRow(catalogDb, table, uniqueName);
  const exportDefaults = exportDefaultsForRow(equipmentRow);
  const isCompanionWeaponEquipped =
    table === 'weapons' &&
    isCompanionWeapon({
      name: equipmentRow?.name,
      product_category: equipmentRow?.product_category,
      slot: equipmentRow?.slot ?? null,
      sentinel: equipmentRow?.sentinel ?? null,
    });

  const builds = userDb
    .prepare(
      `SELECT id, equipment_type, mod_config
         FROM builds
        WHERE equipment_unique_name = ?`,
    )
    .all(uniqueName) as BuildRow[];

  if (builds.length === 0) return 0;

  const updateStmt = userDb.prepare(
    `UPDATE builds
        SET mod_config = ?, updated_at = datetime('now')
      WHERE id = ?`,
  );

  let updated = 0;
  const reconcile = userDb.transaction((rows: BuildRow[]) => {
    for (const row of rows) {
      if (!isEquipmentSlotConfigKey(row.equipment_type)) continue;

      const modConfig = parseBuildConfig(row.mod_config);
      const existingSlots = parseExistingSlots(modConfig);
      const reconciled = reconcileStoredBuildModSlots(existingSlots, {
        equipmentType: row.equipment_type,
        equipmentName: equipmentRow?.name,
        artifactSlotsRaw: artifactSlots,
        exportDefaults,
        isCompanionWeaponEquipped,
      });

      if (buildModSlotsAreEquivalent(existingSlots, reconciled)) continue;

      const nextConfig = {
        ...modConfig,
        slots: reconciled,
      };
      updateStmt.run(JSON.stringify(nextConfig), row.id);
      updated += 1;
    }
  });

  reconcile(builds);
  return updated;
}
