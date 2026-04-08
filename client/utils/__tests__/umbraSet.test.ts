import { describe, it, expect } from 'vitest';

import type { Mod } from '../../types/warframe';
import { getUmbraTierStatBlockAtMaxRank, stripUmbraSetMarketingLines } from '../umbraSet';

describe('stripUmbraSetMarketingLines', () => {
  it('removes the marketing prefix from lines', () => {
    expect(stripUmbraSetMarketingLines('Enhance mods in this set.\n+110% Armor')).toBe('+110% Armor');
  });

  it('returns empty when only marketing text', () => {
    expect(stripUmbraSetMarketingLines('Enhance mods in this set.')).toBe('');
  });
});

describe('getUmbraTierStatBlockAtMaxRank', () => {
  const base: Mod = {
    unique_name: '/u',
    name: 'Umbral Fiber',
    mod_set: 'UmbraModSet',
    fusion_limit: 10,
  };

  it('returns null when tier is only set marketing copy (no parseable stats)', () => {
    const mod: Mod = {
      ...base,
      set_stats: JSON.stringify([
        'Enhance mods in this set.',
        'Enhance mods in this set.',
        'Enhance mods in this set.',
      ]),
    };
    expect(getUmbraTierStatBlockAtMaxRank(mod, 10, 3)).toBeNull();
  });

  it('returns stripped stats when tier has real numbers', () => {
    const mod: Mod = {
      ...base,
      set_stats: JSON.stringify(['Enhance mods in this set.\n+100% Health', '+130% Health', '+180% Health']),
    };
    expect(getUmbraTierStatBlockAtMaxRank(mod, 10, 3)).toBe('+180% Health');
  });
});
