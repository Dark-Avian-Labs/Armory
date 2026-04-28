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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsNormalizedPhrase(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeCompatText(needle);
  if (!normalizedNeedle) return false;
  const pattern = `\\b${escapeRegExp(normalizedNeedle).replace(/\\ /g, '\\s+')}\\b`;
  return new RegExp(pattern).test(haystack);
}

const STANCE_FAMILY_DEFINITIONS: Array<{
  aliases: string[];
  equipmentHints: string[];
}> = [
  {
    aliases: ['scythe', 'scythes', 'heavy scythe', 'heavy scythes'],
    equipmentHints: ['scythe', 'scythes', '/scythe', '/scythes'],
  },
  {
    aliases: ['heavy blade', 'heavy blades', 'great sword', 'greatsword', 'heavy sword'],
    equipmentHints: ['heavy blade', 'great sword', 'greatsword', '/greatsword'],
  },
  {
    aliases: ['sword', 'swords', 'long sword', 'longsword'],
    equipmentHints: ['long sword', 'longsword', '/longsword'],
  },
  {
    aliases: ['dagger', 'daggers'],
    equipmentHints: ['dagger', 'daggers', '/dagger'],
  },
  {
    aliases: ['dual daggers', 'dual dagger'],
    equipmentHints: ['dual dagger', 'dual daggers', '/dualdagger'],
  },
  {
    aliases: ['nikana'],
    equipmentHints: ['nikana', '/nikana'],
  },
  {
    aliases: ['staff', 'staves'],
    equipmentHints: ['staff', 'staves', '/staff'],
  },
  {
    aliases: ['polearm', 'polearms'],
    equipmentHints: ['polearm', 'polearms', '/polearm'],
  },
  {
    aliases: ['hammer', 'hammers'],
    equipmentHints: ['hammer', 'hammers', '/hammer'],
  },
  {
    aliases: ['fist', 'fists'],
    equipmentHints: ['fist', 'fists', '/fist'],
  },
  {
    aliases: ['sparring'],
    equipmentHints: ['sparring', '/sparring'],
  },
  {
    aliases: ['tonfa', 'tonfas'],
    equipmentHints: ['tonfa', 'tonfas', '/tonfa'],
  },
  {
    aliases: ['claws'],
    equipmentHints: ['claws', '/claws'],
  },
  {
    aliases: ['whip', 'whips'],
    equipmentHints: ['whip', 'whips', '/whip'],
  },
  {
    aliases: ['blade and whip', 'blade whip'],
    equipmentHints: ['blade and whip', 'blade whip', 'bladeandwhip', '/bladeandwhip'],
  },
  {
    aliases: ['gunblade', 'gun blade'],
    equipmentHints: ['gunblade', 'gun blade', '/gunblade'],
  },
  {
    aliases: ['warfan', 'war fan', 'warfans'],
    equipmentHints: ['warfan', 'war fan', 'warfans', '/warfan'],
  },
  {
    aliases: ['rapier', 'rapiers'],
    equipmentHints: ['rapier', 'rapiers', '/rapier'],
  },
];

function getStanceCompatAliases(value: string): string[] {
  const normalized = normalizeCompatText(value);
  if (!normalized) return [];
  for (const family of STANCE_FAMILY_DEFINITIONS) {
    if (family.aliases.includes(normalized)) {
      return family.aliases;
    }
  }
  return [normalized];
}

function parseModDescriptionLines(mod: Mod): string[] {
  const raw = mod.description?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string');
    }
  } catch {
    // ignore
  }
  return [raw];
}

function getStanceFamiliesFromDescription(mod: Mod): string[] {
  const lines = parseModDescriptionLines(mod);
  if (lines.length === 0) return [];
  const normalizedText = normalizeCompatText(lines.join(' '));
  if (!normalizedText) return [];
  const families = new Set<string>();
  for (const family of STANCE_FAMILY_DEFINITIONS) {
    for (const alias of family.aliases) {
      if (containsNormalizedPhrase(normalizedText, alias)) {
        for (const g of family.aliases) families.add(g);
        break;
      }
    }
  }
  return [...families];
}

function getEquipmentStanceFamilyAliases(equipment: {
  unique_name: string;
  name: string;
  product_category?: string;
}): string[] {
  const searchable = `${normalizeCompatText(equipment.name)} ${normalizeCompatText(equipment.unique_name)}`;
  const aliases = new Set<string>();
  for (const family of STANCE_FAMILY_DEFINITIONS) {
    if (
      family.aliases.includes('sword') &&
      (searchable.includes('great sword') || searchable.includes('greatsword'))
    ) {
      continue;
    }
    if (family.equipmentHints.some((hint) => searchable.includes(hint))) {
      for (const alias of family.aliases) {
        aliases.add(alias);
      }
    }
  }
  return [...aliases];
}

function hasAnyHint(searchable: string, hints: string[]): boolean {
  return hints.some((hint) => searchable.includes(hint));
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

  const suppressSwordFamilyOnGreatSword =
    ['sword', 'swords', 'long sword', 'longsword'].includes(compatNorm) &&
    (searchable.includes('great sword') || searchable.includes('greatsword'));

  if (
    !suppressSwordFamilyOnGreatSword &&
    (containsNormalizedPhrase(searchable, compatNorm) ||
      containsNormalizedPhrase(compatNorm, normalizeCompatText(equipment.name)))
  ) {
    return true;
  }

  if (
    compatNorm.includes('heavy scythe') &&
    !hasAnyHint(searchable, ['heavy scythe', 'heavy scythes'])
  ) {
    return false;
  }
  if (
    compatNorm.includes('heavy blade') &&
    !hasAnyHint(searchable, ['heavy blade', 'heavy blades', 'great sword', 'greatsword'])
  ) {
    return false;
  }
  if (
    compatNorm.includes('dual dagger') &&
    !hasAnyHint(searchable, ['dual dagger', 'dual daggers'])
  ) {
    return false;
  }
  if (
    compatNorm.includes('blade and whip') &&
    !hasAnyHint(searchable, ['blade and whip', 'blade whip', 'bladeandwhip'])
  ) {
    return false;
  }
  if (
    (compatNorm.includes('gun blade') || compatNorm.includes('gunblade')) &&
    !hasAnyHint(searchable, ['gun blade', 'gunblade'])
  ) {
    return false;
  }

  if (suppressSwordFamilyOnGreatSword) {
    return false;
  }

  const compatAliases = new Set<string>(getStanceCompatAliases(compatNorm));
  for (const family of getStanceFamiliesFromDescription(mod)) {
    for (const alias of getStanceCompatAliases(family)) {
      compatAliases.add(alias);
    }
  }
  const equipmentAliases = new Set<string>(getEquipmentStanceFamilyAliases(equipment));
  if ([...compatAliases].some((alias) => alias && containsNormalizedPhrase(searchable, alias))) {
    return true;
  }
  if ([...compatAliases].some((alias) => equipmentAliases.has(alias))) {
    return true;
  }

  const compatTokens = getCompatTokens(compatNorm);
  return compatTokens.some((token) => containsNormalizedPhrase(searchable, token));
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

  if (compat.toUpperCase() === 'ANY' && modType !== '---') return true;

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

export function normalizeWeaponIdentityName(name: string): string {
  let n = name.replace(/\s+/g, ' ').trim();
  let prev = '';
  while (n !== prev) {
    prev = n;
    n = n.replace(/^(Kuva|Tenet|Coda)\s+/i, '').trim();
  }
  return n.toUpperCase();
}

function primaryWeaponAcceptsSniperCategoryMods(equipment?: {
  unique_name: string;
  name: string;
  product_category?: string;
}): boolean {
  if (!equipment) return false;
  if (equipment.product_category === 'Launcher') return true;

  const path = equipment.unique_name.replace(/\\/g, '/').toLowerCase();
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

function isPrimaryWeaponModExportType(modType: string): boolean {
  const t = modType
    .toUpperCase()
    .trim()
    .replace(/\s+MOD$/i, '')
    .trim();
  if (t === 'PRIMARY') return true;
  return ['RIFLE', 'SNIPER', 'SHOTGUN', 'BOW', 'LAUNCHER', 'ASSAULT RIFLE'].includes(t);
}

const GENERIC_TYPE_PRIMARY_COMPAT_NAMES = new Set([
  'SNIPER',
  'RIFLE',
  'SHOTGUN',
  'BOW',
  'LAUNCHER',
  'ASSAULT RIFLE',
  'PRIMARY',
]);

function isPrimaryModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  if (modType === '---') {
    if (!GENERIC_TYPE_PRIMARY_COMPAT_NAMES.has(compat.toUpperCase())) return false;
  } else if (!isPrimaryWeaponModExportType(modType)) {
    return false;
  }

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
