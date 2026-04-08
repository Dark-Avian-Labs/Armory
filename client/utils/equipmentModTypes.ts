import type { EquipmentType } from '../types/warframe';

/**
 * Sentinel returned by {@link getModTypesForEquipment} when this equipment type has no
 * `/api/mods` catalog (e.g. Necramech, K-Drive). Callers must not request mod lists.
 */
export const NO_MOD_TYPES_FOR_EQUIPMENT = null;

/** Comma-separated `types` query for `/api/mods`, or {@link NO_MOD_TYPES_FOR_EQUIPMENT} to skip. */
export type ModTypesForEquipmentQuery = string | typeof NO_MOD_TYPES_FOR_EQUIPMENT;

/** Comma-separated `types` query for `/api/mods` — matches FilterPanel / mod picker. */
export function getModTypesForEquipment(eqType: EquipmentType): ModTypesForEquipmentQuery {
  switch (eqType) {
    case 'warframe':
      return 'WARFRAME,AURA';
    case 'primary':
      return 'PRIMARY';
    case 'secondary':
      return 'SECONDARY';
    case 'melee':
      return 'MELEE,STANCE';
    case 'beast_claws':
      return 'MELEE,STANCE';
    case 'companion':
      return 'SENTINEL,KAVAT,KUBROW,HELMINTH CHARGER';
    case 'archgun':
      return 'ARCH-GUN';
    case 'archmelee':
      return 'ARCH-MELEE';
    case 'archwing':
      return 'ARCHWING';
    case 'necramech':
    case 'kdrive':
      return NO_MOD_TYPES_FOR_EQUIPMENT;
    default:
      return 'WARFRAME';
  }
}
