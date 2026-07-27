import type { EquipmentType } from '../types/warframe';

const AVATAR_STATS_EQUIPMENT_TYPES = new Set<EquipmentType>(['warframe', 'companion']);

/** Equipment that shows HP / shield / armor / energy (not weapon DPS). */
export function isAvatarStatsEquipmentType(type: EquipmentType): boolean {
  return AVATAR_STATS_EQUIPMENT_TYPES.has(type);
}
