import { NECRAMECH_ITEM_MAX_RANK, WARFRAME_MAX_RANK } from '../../shared/equipmentRankStats.js';
import type { EquipmentType } from '../types/warframe';
import { getWeaponModCapacityBase } from './weaponValence';

const WARFRAME_LIKE_CAPACITY_TYPES = new Set<EquipmentType>([
  'warframe',
  'archwing',
  'companion',
  'beast_claws',
]);

/**
 * Max-rank mod capacity base before aura/stance bonuses and polarity.
 * Necramechs reach 40 capacity at item rank 40; stats stop at rank 30.
 */
export function getEquipmentModCapacityBase(
  equipmentType: EquipmentType | undefined,
  equipment: { name?: string } | undefined,
): number {
  if (equipmentType === 'necramech') return NECRAMECH_ITEM_MAX_RANK;
  if (equipmentType && WARFRAME_LIKE_CAPACITY_TYPES.has(equipmentType)) {
    return WARFRAME_MAX_RANK;
  }
  return getWeaponModCapacityBase(equipment);
}