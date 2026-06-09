import { EQUIPMENT_SLOT_CONFIGS, type EquipmentType, type Mod } from '../types/warframe';

export const ARMORY_STANCE_WIKI_IMAGE_PREFIX = '/ArmoryWiki/StanceMod/' as const;

const SPECIAL_PRIMARY_NAMES = new Set(['Artemis Bow', 'Artemis Bow Prime', 'Neutralizer']);

const SPECIAL_SECONDARY_NAMES = new Set([
  'Balefire Charger',
  'Balefire Charger Prime',
  'Dex Pixia',
  'Dex Pixia Prime',
  'Glory',
  'Noctua',
  'Regulators',
  'Regulators Prime',
]);

const TOME_WEAPON_NAMES = new Set(['Noctua', 'Grimoire']);

const MELEE_EXALTED_NAMES_SHARED = [
  'Shadow Clones',
  'Shadow Clones Prime',
  'Landslide Fists',
  'Landslide Fists Prime',
  'Shattered Lash',
  'Shattered Lash Prime',
  'Whipclaw',
  'Whipclaw Prime',
] as const;

const MELEE_WEAPON_NAMES_WITHOUT_EXILUS = new Set<string>(MELEE_EXALTED_NAMES_SHARED);

const SPECIAL_MELEE_NAMES = new Set<string>([
  'Desert Wind',
  'Desert Wind Prime',
  'Diwata',
  'Diwata Prime',
  'Exalted Blade',
  'Exalted Prime Blade',
  'Exalted Umbra Blade',
  'Garuda Talons',
  'Garuda Prime Talons',
  'Iron Staff',
  'Iron Staff Prime',
  'Shadow Claws',
  'Shadow Claws Prime',
  'Valkyr Talons',
  'Valkyr Prime Talons',
  ...MELEE_EXALTED_NAMES_SHARED,
]);

const SPECIAL_NECRAMECH_SELECTION_TYPE: Record<string, EquipmentType> = {
  Arquebex: 'archgun',
  Ironbride: 'archmelee',
};

const REQUIRED_EXALTED_STANCES_BY_EQUIPMENT: Record<string, string> = {
  'desert wind': 'Serene Storm',
  'desert wind prime': 'Serene Storm',
  diwata: 'Razorwing',
  'diwata prime': 'Razorwing',
  'exalted blade': 'Exalted Blade',
  'exalted prime blade': 'Exalted Blade',
  'exalted umbra blade': 'Exalted Blade',
  'garuda talons': 'Garuda Talons',
  'garuda prime talons': 'Garuda Talons',
  'iron staff': 'Primal Fury',
  'iron staff prime': 'Primal Fury',
  'shadow claws': 'Ravenous Wraith',
  'shadow claws prime': 'Ravenous Wraith',
  'shadow clones': 'Shadow Clones',
  'shadow clones prime': 'Shadow Clones',
  'shattered lash': 'Shattered Lash',
  'shattered lash prime': 'Shattered Lash',
  'valkyr talons': 'Hysteria',
  'valkyr prime talons': 'Hysteria',
  whipclaw: 'Whipclaw',
  'whipclaw prime': 'Whipclaw',
};

export function normalizeEquipmentName(name: string): string {
  return name.replace(/^<[^>]+>\s*/i, '').trim();
}

function normalizeLookupName(name: string): string {
  return normalizeEquipmentName(name).replace(/\s+/g, ' ').toLowerCase();
}

export function getSpecialItemSelectionType(
  name: string,
  equipmentType: EquipmentType,
): EquipmentType | null {
  const normalized = normalizeEquipmentName(name);
  const necramechMappedType = SPECIAL_NECRAMECH_SELECTION_TYPE[normalized];

  if (equipmentType === 'primary' && SPECIAL_PRIMARY_NAMES.has(normalized)) {
    return 'primary';
  }
  if (equipmentType === 'secondary' && SPECIAL_SECONDARY_NAMES.has(normalized)) {
    return 'secondary';
  }
  if (equipmentType === 'melee' && SPECIAL_MELEE_NAMES.has(normalized)) {
    return 'melee';
  }
  if (equipmentType === 'necramech' && necramechMappedType) {
    return necramechMappedType;
  }
  if (
    (equipmentType === 'archgun' || equipmentType === 'archmelee') &&
    necramechMappedType === equipmentType
  ) {
    return equipmentType;
  }

  return null;
}

export function matchesSpecialItemType(name: string, equipmentType: EquipmentType): boolean {
  return getSpecialItemSelectionType(name, equipmentType) !== null;
}

export function isTomeWeapon(equipment?: { unique_name?: string; name?: string | null }): boolean {
  if (!equipment?.name) return false;
  const normalized = normalizeEquipmentName(equipment.name);
  if (TOME_WEAPON_NAMES.has(normalized)) return true;
  const path = (equipment.unique_name ?? '').replace(/\\/g, '/').toLowerCase();
  return path.includes('/grimoire/') || path.includes('exaltedbook');
}

export function getRequiredExaltedStanceName(equipmentName?: string | null): string | null {
  if (!equipmentName) return null;
  const lookupName = normalizeLookupName(equipmentName);
  return REQUIRED_EXALTED_STANCES_BY_EQUIPMENT[lookupName] ?? null;
}

export function equipmentHasStanceSlot(
  equipmentType: EquipmentType,
  equipmentName?: string | null,
): boolean {
  if (getRequiredExaltedStanceName(equipmentName)) return true;
  const config = EQUIPMENT_SLOT_CONFIGS[equipmentType as keyof typeof EQUIPMENT_SLOT_CONFIGS];
  return config?.hasStance === true;
}

const EXALTED_STANCE_CARD_FALLBACK: Record<string, string> = {
  'Serene Storm':
    'Stance: With his Restraint eroded, Baruuk commands the Desert Wind to deliver powerful radial strikes with his fists and feet.',
  Razorwing: 'Stance: While Razorwing is active, Titania wields the Diwata exalted heavy blade.',
  'Exalted Blade': 'Stance: Summon a sword of pure light and immense power.',
  'Ravenous Wraith':
    "Stance: When the Death Well fills, Sevagoth's Shadow form is ready to be released. Tear the enemy asunder with melee-focused abilities.",
  'Primal Fury': 'Stance: Summon the iron staff and unleash fury.',
  Hysteria:
    'Stance: Valkyr is imbued with energy and becomes a ball of vicious rage, capable of unleashing a torrent of deadly claw attacks.',
  'Garuda Talons': 'Stance: Garuda extends her talons when no melee weapon is equipped.',
  'Shadow Clones': 'Stance: Strike alongside manifested shadow clones.',
  'Shattered Lash': 'Stance: Gara extends a blade of hardened glass to slice through enemies.',
  Whipclaw:
    'Stance: Khora lashes the ground with her whip, striking foes at range and lifting vulnerable targets.',
};

export function augmentExaltedStanceModForDisplay(
  mod: Mod,
  equipmentImagePath?: string | null,
): Mod {
  if ((mod.type || '').toUpperCase() !== 'STANCE') return mod;
  const fallback = EXALTED_STANCE_CARD_FALLBACK[mod.name];
  if (!fallback) return mod;
  const isSyntheticStub = mod.unique_name.startsWith('/Synthetic/SpecialItems/Stances/');
  const missingDescription = !mod.description?.trim();
  const equipmentArt = equipmentImagePath?.trim() || undefined;
  const persistedStanceArt = mod.image_path?.trim() || undefined;

  if (persistedStanceArt) {
    return {
      ...mod,
      polarity: mod.polarity ?? 'AP_POWER',
      ...(missingDescription ? { description: JSON.stringify([fallback]) } : {}),
      image_path: persistedStanceArt,
    };
  }

  if (!isSyntheticStub && !missingDescription && !equipmentArt) return mod;
  return {
    ...mod,
    polarity: mod.polarity ?? 'AP_POWER',
    ...(missingDescription ? { description: JSON.stringify([fallback]) } : {}),
    ...(equipmentArt ? { image_path: equipmentArt } : {}),
  };
}

export function weaponOmitsExilusSlot(
  name: string | undefined | null,
  equipmentType: EquipmentType,
): boolean {
  if (!name) return false;
  const normalized = normalizeEquipmentName(name);
  if (equipmentType === 'melee' && MELEE_WEAPON_NAMES_WITHOUT_EXILUS.has(normalized)) {
    return true;
  }
  const necramechMappedType = SPECIAL_NECRAMECH_SELECTION_TYPE[normalized];
  if (
    (equipmentType === 'archgun' || equipmentType === 'archmelee') &&
    necramechMappedType === equipmentType
  ) {
    return true;
  }
  return false;
}

export function weaponOmitsRivenMod(
  name: string | undefined | null,
  equipmentType: EquipmentType,
): boolean {
  if (equipmentType === 'beast_claws') return true;
  if (!name) return false;
  const normalized = normalizeEquipmentName(name);
  const necramechMappedType = SPECIAL_NECRAMECH_SELECTION_TYPE[normalized];
  if (
    (equipmentType === 'archgun' || equipmentType === 'archmelee') &&
    necramechMappedType === equipmentType
  ) {
    return true;
  }
  if (equipmentType === 'primary' && SPECIAL_PRIMARY_NAMES.has(normalized)) return true;
  if (equipmentType === 'secondary' && SPECIAL_SECONDARY_NAMES.has(normalized)) return true;
  if (equipmentType === 'melee' && SPECIAL_MELEE_NAMES.has(normalized)) return true;
  return false;
}
