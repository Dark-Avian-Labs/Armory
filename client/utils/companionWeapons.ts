import type { EquipmentType } from '../types/warframe';

export interface CompanionWeaponLike {
  name: string;
  product_category?: string;
  slot?: number | null;
  sentinel?: number;
}

export function isCompanionWeapon(item: CompanionWeaponLike): boolean {
  return item.product_category === 'SentinelWeapons' || item.sentinel === 1;
}

export function getCompanionWeaponSelectionType(
  item: CompanionWeaponLike,
): EquipmentType | null {
  if (!isCompanionWeapon(item)) return null;

  if (item.slot === 0) return 'secondary';
  if (item.slot === 5) {
    return item.name.toLowerCase().includes('claw') ? 'beast_claws' : 'melee';
  }

  return 'primary';
}
