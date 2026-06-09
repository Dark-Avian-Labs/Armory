import { type EquipmentType, type SlotType } from '../types/warframe';
import { equipmentHasStanceSlot } from './specialItems';

export function supportsUmbraForma(
  equipmentType: EquipmentType,
  equipmentName?: string | null,
): boolean {
  if (equipmentType === 'warframe') return true;
  return equipmentHasStanceSlot(equipmentType, equipmentName);
}

export function canEditSlotPolarityInFormaMode(slotType: SlotType): boolean {
  return slotType !== 'posture';
}
