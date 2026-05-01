import type Database from 'better-sqlite3';

import type { WorksheetCategory } from './resolveHref.js';

function loadNames(db: Database.Database, sql: string, args: unknown[] = []): string[] {
  const rows = db.prepare(sql).all(...args) as { name: string | null }[];
  return rows.map((row) => row.name?.trim() ?? '').filter((name) => name.length > 0);
}

type WeaponSourceRow = {
  name: string | null;
  unique_name: string | null;
};

function isModularMainComponent(row: WeaponSourceRow): boolean {
  const name = row.name?.trim() ?? '';
  if (!name) return false;
  if (/\bprism\b/i.test(name)) return true;
  if (/\bscaffold\b/i.test(name)) return false;

  const uniqueName = row.unique_name?.toLowerCase() ?? '';
  if (!uniqueName) return false;
  if (uniqueName.includes('/prism/')) return true;
  if (uniqueName.includes('/scaffold/')) return false;
  if (uniqueName.includes('/barrel/')) return true;
  if (
    uniqueName.includes('/tip/') ||
    uniqueName.includes('/tips/') ||
    uniqueName.includes('/strike/')
  ) {
    return true;
  }

  const removablePartMarkers = [
    '/handle/',
    '/handles/',
    '/grip/',
    '/brace/',
    '/link/',
    '/balance/',
    '/loader/',
    '/clip/',
    '/core/',
  ];
  for (const marker of removablePartMarkers) {
    if (uniqueName.includes(marker)) {
      return false;
    }
  }
  return false;
}

function loadModularWeaponNames(armoryDb: Database.Database): Set<string> {
  const modularRows = armoryDb
    .prepare(
      "SELECT name, unique_name FROM weapons WHERE product_category IN ('ModularPrimary', 'ModularSecondary', 'Amps') AND name IS NOT NULL AND slot IS NOT NULL AND TRIM(slot) <> ''",
    )
    .all() as WeaponSourceRow[];
  const names = new Set<string>();
  for (const row of modularRows) {
    if (!isModularMainComponent(row)) continue;
    const name = row.name?.trim() ?? '';
    if (name) {
      names.add(name);
    }
  }
  return names;
}

function isCompanionModularMainComponent(row: WeaponSourceRow): boolean {
  const uniqueName = row.unique_name?.toLowerCase() ?? '';
  if (!uniqueName) return false;

  const isMoaHead = uniqueName.includes('/moapetparts/') && uniqueName.includes('/moapethead');
  if (isMoaHead) return true;

  const isHoundHead =
    uniqueName.includes('/zanukapetparts/') && uniqueName.includes('/zanukapetparthead');
  if (isHoundHead) return true;

  return false;
}

function loadCompanionNames(armoryDb: Database.Database): Set<string> {
  const companionNames = new Set(
    loadNames(armoryDb, "SELECT name FROM companions WHERE name IS NOT NULL AND TRIM(name) <> ''"),
  );
  const modularCompanionRows = armoryDb
    .prepare(
      "SELECT name, unique_name FROM weapons WHERE product_category = 'Pistols' AND slot IS NULL AND name IS NOT NULL AND unique_name IS NOT NULL AND (LOWER(unique_name) LIKE '%/moapetparts/%' OR LOWER(unique_name) LIKE '%/zanukapetparts/%')",
    )
    .all() as WeaponSourceRow[];
  for (const row of modularCompanionRows) {
    if (!isCompanionModularMainComponent(row)) continue;
    const name = row.name?.trim() ?? '';
    if (name) {
      companionNames.add(name);
    }
  }
  return companionNames;
}

const WORKSHEET_ORDER: WorksheetCategory[] = [
  'Warframes',
  'Primary Weapons',
  'Secondary Weapons',
  'Melee Weapons',
  'Modular Weapons',
  'Companions',
  'Companion Weapons',
  'Archwing Weapons',
  'Accessories',
];

export function loadArmoryWorksheetSources(
  armoryDb: Database.Database,
): Record<WorksheetCategory, Set<string>> {
  const warframes = new Set(
    loadNames(armoryDb, "SELECT name FROM warframes WHERE product_category = 'Suits'"),
  );
  const accessories = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM warframes WHERE product_category IN ('SpaceSuits', 'MechSuits')",
    ),
  );
  const primary = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'LongGuns' AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const secondary = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'Pistols' AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const melee = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'Melee' AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const archwing = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category IN ('SpaceGuns', 'SpaceMelee') AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const companionWeapons = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'SentinelWeapons' AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const modular = loadModularWeaponNames(armoryDb);
  const companions = loadCompanionNames(armoryDb);

  return {
    Warframes: warframes,
    Accessories: accessories,
    'Primary Weapons': primary,
    'Secondary Weapons': secondary,
    'Melee Weapons': melee,
    Companions: companions,
    'Companion Weapons': companionWeapons,
    'Archwing Weapons': archwing,
    'Modular Weapons': modular,
  };
}

export { WORKSHEET_ORDER };
