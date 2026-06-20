import type { Weapon } from '../types/warframe';

export const KUVA_SERIES_MOD_CAPACITY_EXTRA = 10;

function isKuvaSeriesName(name: string): boolean {
  return /^(Kuva|Tenet|Coda)\s/i.test(name.trim());
}

export function weaponSupportsValenceBonus(weapon: Weapon): boolean {
  return isKuvaSeriesName(weapon.name);
}

export function getWeaponModCapacityBase(equipment: { name?: string } | undefined): number {
  if (!equipment?.name) return 30;
  return isKuvaSeriesName(equipment.name) ? 30 + KUVA_SERIES_MOD_CAPACITY_EXTRA : 30;
}
