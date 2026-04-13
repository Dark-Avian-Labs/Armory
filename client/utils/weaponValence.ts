import type { Weapon } from '../types/warframe';

/** Extra mod capacity vs rank-30 weapons (Kuva / Tenet / Coda cap at 40). */
export const KUVA_SERIES_MOD_CAPACITY_EXTRA = 10;

function isKuvaSeriesName(name: string): boolean {
  return /^(Kuva|Tenet|Coda)\s/i.test(name.trim());
}

export function weaponSupportsValenceBonus(weapon: Weapon): boolean {
  return isKuvaSeriesName(weapon.name);
}

/** Base mod capacity before Catalyst (30 normal, 40 for Kuva/Tenet/Coda). */
export function getWeaponModCapacityBase(equipment: { name?: string } | undefined): number {
  if (!equipment?.name) return 30;
  return isKuvaSeriesName(equipment.name) ? 30 + KUVA_SERIES_MOD_CAPACITY_EXTRA : 30;
}
