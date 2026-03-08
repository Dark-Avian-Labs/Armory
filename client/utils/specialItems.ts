import type { EquipmentType } from '../types/warframe';

const SPECIAL_PRIMARY_NAMES = new Set([
  'Artemis Bow',
  'Artemis Bow Prime',
  'Neutralizer',
]);

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

const SPECIAL_NECRAMECH_SELECTION_TYPE: Record<
  string,
  EquipmentType
> = {
  Arquebex: 'archgun',
  Ironbride: 'archmelee',
};

export function normalizeEquipmentName(name: string): string {
  return name.replace(/^<[^>]+>\s*/i, '').trim();
}

export function getSpecialItemSelectionType(
  name: string,
  activeTab: EquipmentType,
): EquipmentType | null {
  const normalized = normalizeEquipmentName(name);

  if (activeTab === 'primary' && SPECIAL_PRIMARY_NAMES.has(normalized)) {
    return 'primary';
  }
  if (activeTab === 'secondary' && SPECIAL_SECONDARY_NAMES.has(normalized)) {
    return 'secondary';
  }
  if (activeTab === 'melee' && SPECIAL_MELEE_NAMES.has(normalized)) {
    return 'melee';
  }
  if (activeTab === 'necramech' && SPECIAL_NECRAMECH_SELECTION_TYPE[normalized]) {
    return SPECIAL_NECRAMECH_SELECTION_TYPE[normalized];
  }

  return null;
}

export function matchesSpecialItemType(
  name: string,
  equipmentType: EquipmentType,
): boolean {
  return getSpecialItemSelectionType(name, equipmentType) !== null;
}
