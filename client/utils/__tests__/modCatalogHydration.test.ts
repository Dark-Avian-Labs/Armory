import { describe, it, expect } from 'vitest';

import type { Mod } from '../../types/warframe';
import { mergeModWithCatalog, hydrateSlotsWithModCatalog } from '../modCatalogHydration';

describe('mergeModWithCatalog', () => {
  it('fills set_stats and mod_set from catalog when missing on stored mod', () => {
    const catalog: Mod = {
      unique_name: '/Lotus/Upgrades/Mods/Warframes/UmbraVitality',
      name: 'Umbral Vitality',
      mod_set: '/Lotus/Upgrades/ModSets/Umbra/UmbraModSet',
      set_num_in_set: 3,
      set_stats: JSON.stringify(['+100 Health', '+130 Health']),
      description: JSON.stringify(['a', 'b']),
      fusion_limit: 10,
    };
    const stored: Mod = {
      unique_name: '/Lotus/Upgrades/Mods/Warframes/UmbraVitality',
      name: 'Umbral Vitality',
      fusion_limit: 10,
    };
    const merged = mergeModWithCatalog(stored, catalog);
    expect(merged.set_stats).toBe(catalog.set_stats);
    expect(merged.mod_set).toBe(catalog.mod_set);
    expect(merged.set_num_in_set).toBe(3);
  });
});

describe('hydrateSlotsWithModCatalog', () => {
  it('merges mods in slots when catalog has entries', () => {
    const catalog = new Map<string, Mod>([
      [
        '/u/umbra',
        {
          unique_name: '/u/umbra',
          name: 'Umbral X',
          mod_set: 'UmbraModSet',
          set_stats: JSON.stringify(['tier1']),
          set_num_in_set: 3,
          fusion_limit: 5,
        },
      ],
    ]);
    const slots = [
      {
        index: 0,
        type: 'general' as const,
        mod: { unique_name: '/u/umbra', name: 'Umbral X', fusion_limit: 5 },
      },
    ];
    const out = hydrateSlotsWithModCatalog(slots, catalog);
    expect(out[0].mod?.set_stats).toBe(JSON.stringify(['tier1']));
    expect(out[0].mod?.mod_set).toBe('UmbraModSet');
  });
});
