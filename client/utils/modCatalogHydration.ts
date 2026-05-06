import type { Mod, ModSlot } from '../types/warframe';
import { isRivenMod } from './riven';
import { ARMORY_STANCE_WIKI_IMAGE_PREFIX } from './specialItems';

function preferCatalogOptional<T extends string | undefined>(
  stored: T | null | undefined,
  catalog: T | null | undefined,
): T | undefined {
  if (stored != null && String(stored).trim() !== '') return stored;
  return catalog ?? stored ?? undefined;
}

export function catalogKeyForMod(mod: Pick<Mod, 'name' | 'type'>): string {
  const t = (mod.type ?? '').trim().toUpperCase();
  return `${mod.name ?? ''}|||${t}`;
}

function mergeModImagePath(stored: Mod, catalog: Mod): string | undefined {
  const st = stored.image_path?.trim();
  const cat = catalog.image_path?.trim();
  if (cat?.startsWith(ARMORY_STANCE_WIKI_IMAGE_PREFIX)) return cat;
  if (st?.startsWith(ARMORY_STANCE_WIKI_IMAGE_PREFIX)) return st;
  return preferCatalogOptional(stored.image_path, catalog.image_path);
}

export function mergeModWithCatalog(stored: Mod, catalog?: Mod): Mod {
  if (!catalog || isRivenMod(stored)) return stored;
  return {
    ...catalog,
    ...stored,
    unique_name: stored.unique_name,
    mod_set: preferCatalogOptional(stored.mod_set, catalog.mod_set),
    set_num_in_set: stored.set_num_in_set ?? catalog.set_num_in_set,
    set_stats: preferCatalogOptional(stored.set_stats, catalog.set_stats),
    description: preferCatalogOptional(stored.description, catalog.description),
    fusion_limit: stored.fusion_limit ?? catalog.fusion_limit,
    base_drain: stored.base_drain ?? catalog.base_drain,
    polarity: preferCatalogOptional(stored.polarity, catalog.polarity),
    rarity: preferCatalogOptional(stored.rarity, catalog.rarity),
    image_path: mergeModImagePath(stored, catalog),
    compat_name: preferCatalogOptional(stored.compat_name, catalog.compat_name),
    type: preferCatalogOptional(stored.type, catalog.type),
    is_utility: stored.is_utility ?? catalog.is_utility,
    subtype: preferCatalogOptional(stored.subtype, catalog.subtype),
    is_augment: stored.is_augment ?? catalog.is_augment,
    name: stored.name || catalog.name,
  };
}

export function hydrateSlotsWithModCatalog(
  slots: ModSlot[],
  catalogByUnique: Map<string, Mod>,
  catalogByNameAndType?: Map<string, Mod>,
): ModSlot[] {
  return slots.map((slot) => {
    if (!slot.mod) return slot;
    let catalog = catalogByUnique.get(slot.mod.unique_name);
    if (!catalog && catalogByNameAndType) {
      catalog = catalogByNameAndType.get(catalogKeyForMod(slot.mod));
      if (!catalog && slot.mod.name) {
        catalog = catalogByNameAndType.get(`${slot.mod.name}|||`);
      }
    }
    const merged = mergeModWithCatalog(slot.mod, catalog);
    return merged === slot.mod ? slot : { ...slot, mod: merged };
  });
}
