import type { EquipmentType } from '../types/warframe';

/** Comma-separated `types` query for `/api/mods` — matches FilterPanel / mod picker. */
export function getModTypesForEquipment(eqType: EquipmentType): string {
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
      return '---';
    case 'kdrive':
      return '---';
    default:
      return 'WARFRAME';
  }
}
