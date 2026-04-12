import type { EquipmentType } from '../types/warframe';

export const NO_MOD_TYPES_FOR_EQUIPMENT = null;

export type ModTypesForEquipmentQuery = string | typeof NO_MOD_TYPES_FOR_EQUIPMENT;

export function getModTypesForEquipment(eqType: EquipmentType): ModTypesForEquipmentQuery {
  switch (eqType) {
    case 'warframe':
      return 'WARFRAME,AURA';
    case 'primary':
      // ExportUpgrades uses per-weapon-class labels (Rifle, Sniper, …), not a single PRIMARY type.
      return 'PRIMARY,Rifle,Sniper,Shotgun,Bow,Launcher,Assault Rifle';
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
