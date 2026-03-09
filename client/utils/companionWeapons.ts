import type { EquipmentType } from '../types/warframe';

export interface CompanionWeaponLike {
  name: string;
  product_category?: string;
  slot?: number | null;
  sentinel?: number;
}

const SECONDARY_COMPANION_WEAPON_NAMES = new Set([
  'Burst Laser',
  'Burst Laser Prime',
  'Prisma Burst Laser',
  'Stinger',
]);

const MELEE_COMPANION_WEAPON_NAMES = new Set([
  'Deconstructor',
  'Deconstructor Prime',
]);

export function isCompanionWeapon(item: CompanionWeaponLike): boolean {
  return item.product_category === 'SentinelWeapons' || item.sentinel === 1;
}

export function getCompanionWeaponSelectionType(
  item: CompanionWeaponLike,
): EquipmentType | null {
  if (!isCompanionWeapon(item)) return null;

  if (SECONDARY_COMPANION_WEAPON_NAMES.has(item.name)) return 'secondary';
  if (MELEE_COMPANION_WEAPON_NAMES.has(item.name)) return 'melee';
  if (item.slot === 0) return 'secondary';
  if (item.slot === 5) {
    return item.name.toLowerCase().includes('claw') ? 'beast_claws' : 'melee';
  }

  return 'primary';
}
