export interface CompanionWeaponLike {
  name?: string | null;
  product_category?: string | null;
  slot?: number | null;
  sentinel?: number | null;
}

export function isCompanionWeapon(item: CompanionWeaponLike): boolean {
  return item.product_category === 'SentinelWeapons' || item.sentinel === 1;
}
