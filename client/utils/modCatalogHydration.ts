import type { Mod, ModSlot } from '../types/warframe';
import { isRivenMod } from './riven';

/**
 * Merges a stored mod (from build JSON) with the full catalog row from `/api/mods`.
 * Saved builds often omit `set_stats`, `mod_set`, and other joined fields — required for Umbral scaling.
 */
export function mergeModWithCatalog(stored: Mod, catalog?: Mod): Mod {
  if (!catalog || isRivenMod(stored)) return stored;
  return {
    ...catalog,
    ...stored,
    mod_set: stored.mod_set ?? catalog.mod_set,
    set_num_in_set: stored.set_num_in_set ?? catalog.set_num_in_set,
    set_stats: stored.set_stats ?? catalog.set_stats,
    description: stored.description ?? catalog.description,
    fusion_limit: stored.fusion_limit ?? catalog.fusion_limit,
    base_drain: stored.base_drain ?? catalog.base_drain,
    polarity: stored.polarity ?? catalog.polarity,
    rarity: stored.rarity ?? catalog.rarity,
    image_path: stored.image_path ?? catalog.image_path,
    compat_name: stored.compat_name ?? catalog.compat_name,
    type: stored.type ?? catalog.type,
    is_utility: stored.is_utility ?? catalog.is_utility,
    subtype: stored.subtype ?? catalog.subtype,
    is_augment: stored.is_augment ?? catalog.is_augment,
    name: stored.name || catalog.name,
  };
}

export function hydrateSlotsWithModCatalog(
  slots: ModSlot[],
  catalogByUnique: Map<string, Mod>,
): ModSlot[] {
  return slots.map((slot) => {
    if (!slot.mod) return slot;
    const merged = mergeModWithCatalog(slot.mod, catalogByUnique.get(slot.mod.unique_name));
    return merged === slot.mod ? slot : { ...slot, mod: merged };
  });
}
