import { describe, it, expect } from 'vitest';

import type { Mod } from '../../types/warframe';
import { catalogKeyForMod, mergeModWithCatalog, hydrateSlotsWithModCatalog } from '../modCatalogHydration';

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

  it('uses catalog set_stats when stored has empty string', () => {
    const catalog: Mod = {
      unique_name: '/u/v',
      name: 'Umbral Vitality',
      mod_set: '/Lotus/Upgrades/ModSets/Umbra/UmbraModSet',
      set_stats: JSON.stringify(['+100 Health']),
      fusion_limit: 10,
    };
    const stored: Mod = {
      unique_name: '/u/v',
      name: 'Umbral Vitality',
      set_stats: '',
      fusion_limit: 10,
    };
    const merged = mergeModWithCatalog(stored, catalog);
    expect(merged.set_stats).toBe(catalog.set_stats);
    expect(merged.mod_set).toBe(catalog.mod_set);
  });

  it('prefers catalog Armory wiki stance image over stored snapshot paths', () => {
    const wikiPath = '/ArmoryWiki/StanceMod/Lotus/Whipclaw.png';
    const catalog: Mod = {
      unique_name: '/Lotus/Stances/Whipclaw',
      name: 'Whipclaw',
      type: 'STANCE',
      image_path: wikiPath,
      fusion_limit: 3,
    };
    const stored: Mod = {
      unique_name: '/Lotus/Stances/Whipclaw',
      name: 'Whipclaw',
      type: 'STANCE',
      image_path: '/Lotus/Weapons/SomeExport.webp',
      fusion_limit: 3,
    };
    const merged = mergeModWithCatalog(stored, catalog);
    expect(merged.image_path).toBe(wikiPath);
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

  it('resolves catalog by name+type when unique_name differs', () => {
    const expert: Mod = {
      unique_name: '/Lotus/Expert/UmbraVitality',
      name: 'Umbral Vitality',
      type: 'WARFRAME',
      mod_set: 'UmbraModSet',
      set_stats: JSON.stringify(['+100 Health']),
      set_num_in_set: 3,
      fusion_limit: 5,
    };
    const byUnique = new Map<string, Mod>([[expert.unique_name, expert]]);
    const byNameType = new Map<string, Mod>([[catalogKeyForMod(expert), expert]]);
    const slots = [
      {
        index: 0,
        type: 'general' as const,
        mod: {
          unique_name: '/Lotus/Normal/UmbraVitality',
          name: 'Umbral Vitality',
          type: 'WARFRAME',
          fusion_limit: 5,
        },
      },
    ];
    const out = hydrateSlotsWithModCatalog(slots, byUnique, byNameType);
    expect(out[0].mod?.set_stats).toBe(JSON.stringify(['+100 Health']));
    expect(out[0].mod?.mod_set).toBe('UmbraModSet');
  });
});
