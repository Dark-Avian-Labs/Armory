import type { EquipmentSlotConfigKey } from './equipmentSlotConfig.js';
import { EQUIPMENT_SLOT_CONFIGS } from './equipmentSlotConfig.js';

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

const SPECIAL_NECRAMECH_SELECTION_TYPE: Record<string, EquipmentSlotConfigKey> = {
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
  whipclaw: 'Whipclaw',
  'whipclaw prime': 'Whipclaw',
  'valkyr talons': 'Hysteria',
  'valkyr prime talons': 'Hysteria',
};

function normalizeLookupName(name: string): string {
  return name
    .replace(/^<[^>]+>\s*/i, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function getRequiredExaltedStanceName(equipmentName?: string | null): string | null {
  if (!equipmentName) return null;
  return REQUIRED_EXALTED_STANCES_BY_EQUIPMENT[normalizeLookupName(equipmentName)] ?? null;
}

export function equipmentHasStanceSlot(
  equipmentType: EquipmentSlotConfigKey,
  equipmentName?: string | null,
): boolean {
  if (getRequiredExaltedStanceName(equipmentName)) return true;
  const config = EQUIPMENT_SLOT_CONFIGS[equipmentType];
  return config?.hasStance === true;
}

export function weaponOmitsExilusSlot(
  name: string | undefined | null,
  equipmentType: EquipmentSlotConfigKey,
): boolean {
  if (!name) return false;
  const normalized = name.replace(/^<[^>]+>\s*/i, '').trim();
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
