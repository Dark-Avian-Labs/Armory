import type { Mod, EquipmentType } from '../types/warframe';
import { getRequiredExaltedStanceName } from './specialItems';

export const VARIANT_PREFIXES = [
  'Primed',
  'Archon',
  'Umbral',
  'Amalgam',
  'Necramech',
  'Berserker',
  'Enhanced',
  'Link',
  'Galvanized',
  'Spectral',
] as const;

export function getModBaseName(name: string): string {
  let result = name;
  for (const prefix of VARIANT_PREFIXES) {
    if (result.startsWith(`${prefix} `)) {
      result = result.substring(prefix.length + 1);
      break;
    }
  }
  return result;
}

const UPGRADE_PATH_LOCKOUT_GROUPS: Record<string, string> = {
  '/lotus/upgrades/mods/shotgun/dualstat/corruptedcritchancefirerateshotgun':
    'shotgun_weapon_crit_chance',
  '/lotus/upgrades/mods/shotgun/weaponcritchancemod': 'shotgun_weapon_crit_chance',
  '/lotus/upgrades/mods/rifle/event/arbitration/shootpickupriflemod': 'rifle_bow_explosion_chance',
  '/lotus/upgrades/mods/rifle/bowexplosionchancemod': 'rifle_bow_explosion_chance',
  '/lotus/upgrades/mods/pvpmods/rifle/moredamageontripletapriflemod':
    'pvp_rifle_double_tap_hydraulic',
  '/lotus/upgrades/mods/pvpmods/rifle/lessrecoilsmallermagriflemod':
    'pvp_rifle_double_tap_hydraulic',
  '/lotus/upgrades/mods/pvpmods/rifle/highervelocitylessdamagebowmod': 'pvp_rifle_feathered_lucky',
  '/lotus/upgrades/mods/pvpmods/rifle/highervelocitylessaccurateriflemod':
    'pvp_rifle_feathered_lucky',
  '/lotus/upgrades/mods/pvpmods/shotgun/lessrecoilsmallermagshotgunmod':
    'pvp_shotgun_reload_mag_chain',
  '/lotus/upgrades/mods/pvpmods/shotgun/fasterreloadmorerecoilshotgunmod':
    'pvp_shotgun_reload_mag_chain',
  '/lotus/upgrades/mods/pvpmods/shotgun/largermaglongerreloadshotgunmod':
    'pvp_shotgun_reload_mag_chain',
};

const MIN_COMPAT_TOKEN_LENGTH = 3;

function normalizeUpgradePath(uniqueName: string): string {
  return uniqueName.trim().toLowerCase();
}

function getModPathLockoutGroup(uniqueName: string | undefined): string | null {
  if (!uniqueName) return null;
  const path = normalizeUpgradePath(uniqueName);
  const mapped = UPGRADE_PATH_LOCKOUT_GROUPS[path];
  if (mapped) return mapped;

  const lastSlash = path.lastIndexOf('/');
  const base = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  if (base.endsWith('parkourtwomod')) {
    return 'warframe_parkour_two';
  }

  if (/\/sets\/(amar|boreal|nira)\/[^/]+exilusmod$/.test(path)) {
    return 'archon_school_exilus';
  }
  if (/\/sets\/(amar|boreal|nira)\/[^/]+warframemod$/.test(path)) {
    return 'archon_school_warframe';
  }
  if (/\/sets\/(amar|boreal|nira)\/[^/]+meleemod$/.test(path)) {
    return 'archon_school_melee';
  }

  return null;
}

export function getModLockoutKey(mod: Mod): string {
  const baseName = getModBaseName(mod.name).toLowerCase();
  const type = (mod.type || '').toLowerCase();
  return `${baseName}|${type}`;
}

export function getModLockoutKeys(mod: Mod): string[] {
  const keys = new Set<string>();
  keys.add(`legacy:${getModLockoutKey(mod)}`);
  const pathGroup = getModPathLockoutGroup(mod.unique_name);
  if (pathGroup) keys.add(`path:${pathGroup}`);
  return [...keys];
}

export function isModLockedOut(candidate: Mod, equippedMods: Mod[]): boolean {
  if (equippedMods.some((m) => m.unique_name === candidate.unique_name)) {
    return true;
  }

  const candidateKeys = getModLockoutKeys(candidate);
  return equippedMods.some((m) => {
    const equippedKeys = getModLockoutKeys(m);
    return candidateKeys.some((k) => equippedKeys.includes(k));
  });
}

export const WEAPON_CATEGORY_TO_MOD_COMPAT: Record<string, string[]> = {
  LongGuns: ['Rifle', 'PRIMARY', 'Assault Rifle'],
  Shotgun: ['Shotgun', 'PRIMARY'],
  Bow: ['Bow', 'PRIMARY'],
  Sniper: ['Sniper', 'PRIMARY'],
  /** Same primary mod tags as LongGuns (Rifle, etc.); export lists many launcher mods under `Rifle` compat. */
  Launcher: ['Launcher', 'PRIMARY', 'Rifle', 'Assault Rifle'],

  Pistols: ['Pistol'],
  Thrown: ['Thrown'],

  Melee: ['Melee'],

  SpaceGuns: ['Archgun'],
  SpaceMelee: ['Archmelee'],
};

export function filterCompatibleMods(
  mods: Mod[],
  equipmentType: EquipmentType,
  equipment?: { unique_name: string; name: string; product_category?: string },
): Mod[] {
  return mods.filter((mod) => isModCompatible(mod, equipmentType, equipment));
}

export function isPostureMod(mod: Mod): boolean {
  return (
    (mod.type || '').toUpperCase() === 'STANCE' &&
    mod.unique_name.includes('/BeastWeapons/Stances/')
  );
}

type CompanionSubtype = 'helminth' | 'kavat' | 'kubrow' | 'sentinel';

export function getCompanionSubtype(equipment?: {
  unique_name: string;
  name: string;
}): CompanionSubtype | null {
  if (!equipment) return null;
  const unique = equipment.unique_name.toUpperCase();
  const name = equipment.name.replace(/\s+/g, ' ').toUpperCase();

  if (name === 'HELMINTH CHARGER' || unique.includes('CHARGERKUBROW')) {
    return 'helminth';
  }
  if (
    name.includes('KAVAT') ||
    name.includes('VULPAPHYLA') ||
    name.includes('VENARI') ||
    unique.includes('CATBROW')
  ) {
    return 'kavat';
  }
  if (name.includes('KUBROW') || name.includes('PREDASITE') || unique.includes('KUBROWPET')) {
    return 'kubrow';
  }
  if (unique.includes('/SENTINELS/')) {
    return 'sentinel';
  }
  return null;
}

function normalizeCompatText(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_/\\-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCompatTokens(value: string | undefined): string[] {
  const normalized = normalizeCompatText(value);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length >= MIN_COMPAT_TOKEN_LENGTH);
}

export function stanceMatchesEquipment(
  mod: Mod,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  const compatNorm = normalizeCompatText(mod.compat_name);
  if (!compatNorm || compatNorm === 'any' || compatNorm === 'melee') {
    return true;
  }
  if (!equipment) {
    return true;
  }

  const searchable =
    `${normalizeCompatText(equipment.name)} ${normalizeCompatText(equipment.unique_name)}`.trim();
  if (!searchable) {
    return true;
  }

  if (searchable.includes(compatNorm) || compatNorm.includes(normalizeCompatText(equipment.name))) {
    return true;
  }

  const compatTokens = getCompatTokens(compatNorm);
  return compatTokens.some((token) => searchable.includes(token));
}

function doesCompatMatchEquipment(
  compat: string,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  const compatNorm = normalizeCompatText(compat);
  if (!compatNorm || compatNorm === 'any') {
    return true;
  }
  if (!equipment) {
    return false;
  }

  const nameNorm = normalizeCompatText(equipment.name);
  const uniqueNorm = normalizeCompatText(equipment.unique_name);
  const searchable = `${nameNorm} ${uniqueNorm}`.trim();
  if (!searchable) {
    return false;
  }

  if (searchable.includes(compatNorm) || (nameNorm && compatNorm.includes(nameNorm))) {
    return true;
  }

  const compatTokens = getCompatTokens(compatNorm);
  return compatTokens.some((token) => searchable.includes(token));
}

function isModCompatible(
  mod: Mod,
  equipmentType: EquipmentType,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  const modType = (mod.type || '').toUpperCase();
  const compat = (mod.compat_name || '').trim();

  if (compat.toUpperCase() === 'ANY') return true;

  switch (equipmentType) {
    case 'warframe':
      return isWarframeModCompatible(mod, modType, compat, equipment);

    case 'primary':
      return isPrimaryModCompatible(mod, modType, compat, equipment);

    case 'secondary':
      return isSecondaryModCompatible(mod, modType, compat, equipment);

    case 'melee':
      return isMeleeModCompatible(mod, modType, compat, equipment);

    case 'beast_claws':
      return isBeastClawModCompatible(mod, modType, compat);

    case 'companion':
      return isCompanionModCompatible(mod, modType, compat, equipment);

    case 'archgun':
      return modType === 'ARCH-GUN';

    case 'archmelee':
      return modType === 'ARCH-MELEE';

    case 'archwing':
      return modType === 'ARCHWING';

    case 'necramech':
      return modType === '---' && compat.toLowerCase() === 'necramech';

    case 'kdrive':
      return modType === '---' && compat.toLowerCase() === 'k-drive';

    default:
      return false;
  }
}

function isWarframeModCompatible(
  mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string },
): boolean {
  if (modType === 'AURA') return true;

  if (modType === 'WARFRAME' && compat.toUpperCase() === 'WARFRAME') return true;

  if (modType === 'WARFRAME' && equipment) {
    const equipName = equipment.name.replace(/\s+PRIME$/i, '').toUpperCase();
    if (compat.toUpperCase() === equipName) return true;

    if (mod.subtype && equipment.unique_name) {
      if (
        equipment.unique_name.includes(mod.subtype) ||
        mod.subtype.includes(equipment.unique_name.replace(/prime/gi, ''))
      ) {
        return true;
      }
    }
  }

  return false;
}

/** Strips Kuva / Tenet / Coda prefixes so weapon-specific mods (e.g. Ogris) match variants (e.g. Kuva Ogris). */
export function normalizeWeaponIdentityName(name: string): string {
  let n = name.replace(/\s+/g, ' ').trim();
  let prev = '';
  while (n !== prev) {
    prev = n;
    n = n.replace(/^(Kuva|Tenet|Coda)\s+/i, '').trim();
  }
  return n.toUpperCase();
}

/**
 * Explosive / launcher primaries accept Sniper-category utility mods in-game (e.g. Sniper Ammo Mutation).
 * Corpus often uses `LongGuns` for these weapons instead of `Launcher`, so we also match by path and name.
 */
function primaryWeaponAcceptsSniperCategoryMods(equipment?: {
  unique_name: string;
  name: string;
  product_category?: string;
}): boolean {
  if (!equipment) return false;
  if (equipment.product_category === 'Launcher') return true;

  const path = equipment.unique_name.replace(/\\/g, '/').toLowerCase();
  // Export paths use `/Launcher/` or `/Launchers/` (path is normalized to lowercase).
  if (/\/launchers?\//.test(path)) return true;

  const identity = normalizeWeaponIdentityName(equipment.name).toLowerCase();
  const launcherNameTokens = [
    'ogris',
    'bramma',
    'tonkor',
    'zarr',
    'penta',
    'torid',
    'stug',
    'lenz',
  ];
  return launcherNameTokens.some((t) => identity.includes(t));
}

/** Export `type` for primary weapon mods is usually a class name (Rifle, Sniper, …), not `PRIMARY`. */
function isPrimaryWeaponModExportType(modType: string): boolean {
  const t = modType.toUpperCase().trim();
  if (t === 'PRIMARY') return true;
  return ['RIFLE', 'SNIPER', 'SHOTGUN', 'BOW', 'LAUNCHER', 'ASSAULT RIFLE'].includes(t);
}

function isPrimaryModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  if (!isPrimaryWeaponModExportType(modType)) return false;

  const compatUpper = compat.toUpperCase();

  if (compatUpper === 'PRIMARY') return true;

  const category = equipment?.product_category || '';
  if (category === 'SentinelWeapons') {
    if (compatUpper === 'RIFLE' || compatUpper === 'ASSAULT RIFLE' || compatUpper === 'SHOTGUN') {
      return true;
    }
  }

  const validCompats = WEAPON_CATEGORY_TO_MOD_COMPAT[category] || [];
  if (validCompats.some((c) => c.toUpperCase() === compatUpper)) return true;

  if (
    primaryWeaponAcceptsSniperCategoryMods(equipment) &&
    (compatUpper === 'SNIPER' || compatUpper.startsWith('SNIPER '))
  ) {
    return true;
  }

  if (equipment) {
    const weaponName = equipment.name.replace(/\s+/g, ' ').toUpperCase();
    if (compatUpper === weaponName) return true;
    const identityName = normalizeWeaponIdentityName(equipment.name);
    if (identityName && compatUpper === identityName) return true;
  }

  if (compatUpper.startsWith('RIFLE') && (category === 'LongGuns' || category === 'Launcher')) {
    return true;
  }
  if (compatUpper.startsWith('SHOTGUN') && category === 'Shotgun') return true;

  return false;
}

function isSecondaryModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string },
): boolean {
  if (modType !== 'SECONDARY') return false;

  const compatUpper = compat.toUpperCase();

  if (compatUpper === 'PISTOL') return true;
  if (compatUpper === 'SECONDARY') return true;

  if (equipment) {
    const weaponName = equipment.name.replace(/\s+/g, ' ').toUpperCase();
    if (compatUpper === weaponName) return true;
  }

  if (compatUpper.startsWith('PISTOL')) return true;

  return false;
}

function isMeleeModCompatible(
  mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  const compatUpper = compat.toUpperCase();

  if (modType === 'STANCE') {
    if (isPostureMod(mod)) {
      return false;
    }

    const requiredStanceName = getRequiredExaltedStanceName(equipment?.name);
    if (requiredStanceName) {
      return mod.name.trim().toLowerCase() === requiredStanceName.toLowerCase();
    }

    return stanceMatchesEquipment(mod, equipment);
  }

  if (modType !== 'MELEE') return false;

  if (compatUpper === 'MELEE') return true;

  return doesCompatMatchEquipment(compat, equipment);
}

function isCompanionModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string },
): boolean {
  const compatUpper = compat.toUpperCase();
  const normalizedName = equipment?.name.replace(/\s+/g, ' ').toUpperCase() || '';
  const companionSubtype = getCompanionSubtype(equipment);

  if (
    modType === 'SENTINEL' ||
    modType === 'KAVAT' ||
    modType === 'KUBROW' ||
    modType === 'HELMINTH CHARGER'
  ) {
    if (!equipment || !companionSubtype) return false;
    if (compatUpper === normalizedName) return true;

    if (modType === 'HELMINTH CHARGER') {
      return companionSubtype === 'helminth' && compatUpper === 'HELMINTH CHARGER';
    }

    if (modType === 'KAVAT') {
      return (
        companionSubtype === 'kavat' && (compatUpper === 'KAVAT' || compatUpper === 'VULPAPHYLA')
      );
    }

    if (modType === 'KUBROW') {
      return (
        companionSubtype === 'kubrow' && (compatUpper === 'KUBROW' || compatUpper === 'PREDASITE')
      );
    }

    if (companionSubtype === 'sentinel') {
      return (
        compatUpper === 'COMPANION' ||
        compatUpper === 'ROBOTIC' ||
        compatUpper === 'SENTINEL' ||
        compatUpper === 'MOA' ||
        compatUpper === 'HOUND'
      );
    }
    if (companionSubtype === 'kavat' || companionSubtype === 'kubrow') {
      return compatUpper === 'COMPANION' || compatUpper === 'BEAST';
    }
    if (companionSubtype === 'helminth') {
      return (
        compatUpper === 'COMPANION' || compatUpper === 'BEAST' || compatUpper === 'HELMINTH CHARGER'
      );
    }

    return false;
  }

  return false;
}

function isBeastClawModCompatible(mod: Mod, modType: string, compat: string): boolean {
  const compatUpper = compat.toUpperCase();

  if (modType === 'STANCE') {
    return isPostureMod(mod);
  }

  if (modType !== 'MELEE') return false;

  return (
    compatUpper === 'MELEE' ||
    compatUpper === 'CLAWS' ||
    compatUpper === 'KAVAT CLAWS' ||
    compatUpper === 'KUBROW CLAWS' ||
    compatUpper === 'HELMINTH CLAWS'
  );
}
