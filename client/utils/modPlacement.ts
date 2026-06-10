import type { Mod, SlotType } from '../types/warframe';
import { isPostureMod } from './modFiltering';
import { isWeaponExilusMod } from './modMetadata';

export interface ModPlacementOptions {
  requiredExaltedStanceName?: string | null;
}

export interface ModSlotPickTarget {
  index: number;
  type: SlotType;
  mod?: Mod;
}

export function canPlaceModInSlot(
  mod: Mod,
  slotType: SlotType,
  options: ModPlacementOptions = {},
): boolean {
  const modType = (mod.type || '').toUpperCase();
  if (slotType === 'aura' && modType !== 'AURA') return false;
  if (slotType === 'stance' && (modType !== 'STANCE' || isPostureMod(mod))) {
    return false;
  }
  if (
    slotType === 'stance' &&
    options.requiredExaltedStanceName &&
    mod.name.trim().toLowerCase() !== options.requiredExaltedStanceName.toLowerCase()
  ) {
    return false;
  }
  if (slotType === 'posture' && (modType !== 'STANCE' || !isPostureMod(mod))) {
    return false;
  }
  if (slotType === 'exilus' && !isWeaponExilusMod(mod)) return false;
  if (slotType === 'general' && (modType === 'AURA' || modType === 'STANCE')) {
    return false;
  }
  return true;
}

export function findEmptySlotForMod(
  slots: ModSlotPickTarget[],
  mod: Mod,
  options: ModPlacementOptions & {
    activeSlotType?: SlotType;
    isRivenPlaceholder?: boolean;
  } = {},
): ModSlotPickTarget | undefined {
  const modType = (mod.type || '').toUpperCase();
  const exilusMod = isWeaponExilusMod(mod);
  const isRivenPlaceholder = options.isRivenPlaceholder === true;

  if (options.activeSlotType) {
    const targetType = isRivenPlaceholder ? 'general' : options.activeSlotType;
    return slots.find((slot) => !slot.mod && slot.type === targetType);
  }

  if (modType === 'AURA') {
    return slots.find((slot) => !slot.mod && slot.type === 'aura');
  }
  if (modType === 'STANCE') {
    const stanceSlotType = isPostureMod(mod) ? 'posture' : 'stance';
    return slots.find((slot) => !slot.mod && slot.type === stanceSlotType);
  }
  if (exilusMod) {
    return (
      slots.find((slot) => !slot.mod && slot.type === 'exilus') ??
      slots.find((slot) => !slot.mod && slot.type === 'general')
    );
  }
  return slots.find((slot) => !slot.mod && slot.type === 'general');
}
