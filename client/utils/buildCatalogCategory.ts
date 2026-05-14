import type { EquipmentPickerTab } from '../components/BuildsCatalog/buildsCatalogUtils';
import { LOADOUT_SLOT_TYPES } from '../hooks/useLoadoutStorage';
import type { EquipmentType, StoredBuild } from '../types/warframe';
import { EQUIPMENT_TYPE_LABELS } from '../types/warframe';
import { isCompanionWeapon } from './companionWeapons';
import { matchesSpecialItemType } from './specialItems';

export type EquipmentLookupRow = {
  unique_name: string;
  name?: string;
  product_category?: string;
  sentinel?: number;
  slot?: number | null;
};

export function getBuildPickerCategory<T extends EquipmentLookupRow>(
  build: StoredBuild,
  equipmentByUniqueName: Record<string, T>,
): EquipmentPickerTab {
  const rec = equipmentByUniqueName[build.equipment_unique_name];
  if (
    (build.equipment_type === 'primary' ||
      build.equipment_type === 'secondary' ||
      build.equipment_type === 'melee') &&
    rec &&
    isCompanionWeapon({
      name: typeof rec.name === 'string' ? rec.name : build.equipment_name,
      product_category: rec.product_category,
      sentinel: rec.sentinel,
      slot: rec.slot ?? null,
    })
  ) {
    return 'companion_weapon';
  }
  return build.equipment_type as EquipmentPickerTab;
}

export function getSlotTypeForBuild<T extends EquipmentLookupRow>(
  build: StoredBuild,
  equipmentLookup?: Record<string, T>,
): string | null {
  if (matchesSpecialItemType(build.equipment_name, build.equipment_type)) {
    if (build.equipment_type === 'primary') return 'special_primary';
    if (build.equipment_type === 'secondary') return 'special_secondary';
    if (build.equipment_type === 'melee') return 'special_melee';
  }

  if (equipmentLookup) {
    const rec = equipmentLookup[build.equipment_unique_name];
    if (
      rec &&
      (build.equipment_type === 'primary' ||
        build.equipment_type === 'secondary' ||
        build.equipment_type === 'melee') &&
      isCompanionWeapon({
        name: typeof rec.name === 'string' ? rec.name : build.equipment_name,
        product_category: rec.product_category,
        sentinel: rec.sentinel,
        slot: rec.slot ?? null,
      })
    ) {
      return 'companion_weapon';
    }
  }

  const equipmentType = build.equipment_type;
  switch (equipmentType) {
    case 'warframe':
    case 'primary':
    case 'secondary':
    case 'melee':
    case 'companion':
    case 'archwing':
    case 'archgun':
    case 'archmelee':
    case 'beast_claws':
    case 'necramech':
    case 'kdrive':
    case 'tektolyst':
      return equipmentType;
    default:
      return null;
  }
}

export function formatLoadoutSlotTypeLabel(slotType: string): string {
  if (slotType === 'special_primary') return 'Primary (Special)';
  if (slotType === 'special_secondary') return 'Secondary (Special)';
  if (slotType === 'special_melee') return 'Melee (Special)';
  const loadoutLabel = LOADOUT_SLOT_TYPES.find((slot) => slot.key === slotType)?.label;
  if (loadoutLabel) return loadoutLabel;
  if (slotType in EQUIPMENT_TYPE_LABELS) {
    return EQUIPMENT_TYPE_LABELS[slotType as EquipmentType];
  }
  return slotType;
}

export function getLoadoutSlotDisplayLabel<T extends EquipmentLookupRow>(
  build: StoredBuild,
  storedSlotType: string,
  equipmentLookup: Record<string, T>,
): string {
  const effective = getSlotTypeForBuild(build, equipmentLookup) ?? storedSlotType;
  return formatLoadoutSlotTypeLabel(effective);
}
