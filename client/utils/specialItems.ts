import type { EquipmentType } from '../types/warframe';

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

const MELEE_WEAPON_NAMES_WITHOUT_EXILUS = new Set([
  'Shadow Clones',
  'Shadow Clones Prime',
  'Landslide Fists',
  'Landslide Fists Prime',
  'Shattered Lash',
  'Shattered Lash Prime',
  'Whipclaw',
  'Whipclaw Prime',
]);

const SPECIAL_MELEE_NAMES = new Set([
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
  'Landslide Fists',
  'Landslide Fists Prime',
  'Shadow Claws',
  'Shadow Claws Prime',
  'Shadow Clones',
  'Shadow Clones Prime',
  'Shattered Lash',
  'Shattered Lash Prime',
  'Valkyr Talons',
  'Valkyr Prime Talons',
  'Whipclaw',
  'Whipclaw Prime',
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

export function getRequiredExaltedStanceName(equipmentName?: string | null): string | null {
  if (!equipmentName) return null;
  const lookupName = normalizeLookupName(equipmentName);
  return REQUIRED_EXALTED_STANCES_BY_EQUIPMENT[lookupName] ?? null;
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
