import type { Mod, EquipmentType } from '../types/warframe';

export const VARIANT_PREFIXES = [
  'Primed',
  'Archon',
  'Umbral',
  'Amalgam',
  'Necramech',
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

export function getModLockoutKey(mod: Mod): string {
  const baseName = getModBaseName(mod.name).toLowerCase();
  const type = (mod.type || '').toLowerCase();
  return `${baseName}|${type}`;
}

export function isModLockedOut(candidate: Mod, equippedMods: Mod[]): boolean {
  if (equippedMods.some((m) => m.unique_name === candidate.unique_name)) {
    return true;
  }

  const candidateKey = getModLockoutKey(candidate);
  return equippedMods.some((m) => getModLockoutKey(m) === candidateKey);
}

export const WEAPON_CATEGORY_TO_MOD_COMPAT: Record<string, string[]> = {
  LongGuns: ['Rifle', 'PRIMARY', 'Assault Rifle'],
  Shotgun: ['Shotgun', 'PRIMARY'],
  Bow: ['Bow', 'PRIMARY'],
  Sniper: ['Sniper', 'PRIMARY'],

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
      return isBeastClawModCompatible(modType, compat);

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

  if (modType === 'WARFRAME' && compat.toUpperCase() === 'WARFRAME')
    return true;

  if (modType === 'WARFRAME' && equipment) {
    const equipName = equipment.name.replace(/\s+PRIME$/i, '').toUpperCase();
    if (compat.toUpperCase() === equipName) return true;

    if (mod.subtype && equipment.unique_name) {
      if (
        equipment.unique_name.includes(mod.subtype) ||
        mod.subtype.includes(equipment.unique_name.replace(/Prime/, ''))
      ) {
        return true;
      }
    }
  }

  return false;
}

function isPrimaryModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  if (modType !== 'PRIMARY') return false;

  const compatUpper = compat.toUpperCase();

  if (compatUpper === 'PRIMARY') return true;

  const category = equipment?.product_category || '';

  const validCompats = WEAPON_CATEGORY_TO_MOD_COMPAT[category] || [];
  if (validCompats.some((c) => c.toUpperCase() === compatUpper)) return true;

  if (equipment) {
    const weaponName = equipment.name.replace(/\s+/g, ' ').toUpperCase();
    if (compatUpper === weaponName) return true;
  }

  if (compatUpper.startsWith('RIFLE') && category === 'LongGuns') return true;
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
  equipment?: { unique_name: string; name: string },
): boolean {
  const compatUpper = compat.toUpperCase();

  if (modType === 'STANCE') {
    return true;
  }

  if (modType !== 'MELEE') return false;

  if (compatUpper === 'MELEE') return true;

  if (equipment) {
    const weaponName = equipment.name.replace(/\s+/g, ' ').toUpperCase();
    if (compatUpper === weaponName) return true;
  }

  return true;
}

function isCompanionModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  _equipment?: { unique_name: string; name: string },
): boolean {
  const compatUpper = compat.toUpperCase();

  if (
    modType === 'SENTINEL' ||
    modType === 'KAVAT' ||
    modType === 'KUBROW' ||
    modType === 'HELMINTH CHARGER'
  ) {
    return ['COMPANION', 'BEAST', 'ROBOTIC'].includes(compatUpper);
  }

  return false;
}

function isBeastClawModCompatible(modType: string, compat: string): boolean {
  const compatUpper = compat.toUpperCase();

  if (modType === 'STANCE') {
    return compatUpper === 'CLAWS';
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
