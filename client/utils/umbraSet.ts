import type { Mod, ModSlot } from '../types/warframe';

/** Warframe ExportModSet unique name fragment for Umbral mods (full path contains this). */
const UMBRA_MOD_SET_MARKER = 'UmbraModSet';

export function isUmbraSelfScalingSetMod(mod: Mod | undefined): boolean {
  if (!mod?.mod_set) return false;
  return mod.mod_set.includes(UMBRA_MOD_SET_MARKER);
}

export function countEquippedUmbraSetMods(slots: ModSlot[]): number {
  let n = 0;
  for (const slot of slots) {
    if (slot.mod && isUmbraSelfScalingSetMod(slot.mod)) n += 1;
  }
  return n;
}

export function countEquippedUmbraSetModsFromModList(mods: Mod[]): number {
  let n = 0;
  for (const mod of mods) {
    if (isUmbraSelfScalingSetMod(mod)) n += 1;
  }
  return n;
}
