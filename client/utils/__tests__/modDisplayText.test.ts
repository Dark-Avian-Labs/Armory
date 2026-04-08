import { describe, it, expect } from 'vitest';

import type { Mod } from '../../types/warframe';
import { getModCardDisplayTexts } from '../modDisplayText';

describe('getModCardDisplayTexts', () => {
  it('applies Umbral multiplier to main body and shows a fixed set bonus description', () => {
    const mod: Mod = {
      unique_name: '/u/umbra',
      name: 'Umbral Vitality',
      mod_set: '/Lotus/Upgrades/ModSets/Umbra/UmbraModSet',
      description: JSON.stringify(['+10 Health', '+440 Health']),
      set_stats: JSON.stringify(['+100 Health', '+130 Health', '+180 Health']),
      set_num_in_set: 3,
      fusion_limit: 1,
    };
    const { mainDescription, setBonusDescription, effectiveSetRank } = getModCardDisplayTexts(mod, 1, {
      umbraSetEquippedCount: 3,
    });
    expect(mainDescription).toContain('792');
    expect(setBonusDescription).toBe('Enhances all equipped mods within the set');
    expect(effectiveSetRank).toBe(3);
  });

  it('keeps the same Umbral set bonus copy regardless of equipped count', () => {
    const mod: Mod = {
      unique_name: '/u/umbra',
      name: 'Umbral Vitality',
      mod_set: '/Lotus/Upgrades/ModSets/Umbra/UmbraModSet',
      description: JSON.stringify(['+10 Health']),
      set_stats: JSON.stringify(['+100 Health', '+130 Health', '+180 Health']),
      set_num_in_set: 3,
      fusion_limit: 1,
    };
    const d2 = getModCardDisplayTexts(mod, 0, { umbraSetEquippedCount: 2 }).setBonusDescription;
    const d3 = getModCardDisplayTexts(mod, 0, { umbraSetEquippedCount: 3 }).setBonusDescription;
    expect(d2).toBe('Enhances all equipped mods within the set');
    expect(d3).toBe(d2);
  });

  it('uses rank JSON for non-Umbral set mod and set_stats for the set strip', () => {
    const mod: Mod = {
      unique_name: '/u/augur',
      name: 'Augur Message',
      description: JSON.stringify(['+10% Ability Strength']),
      set_stats: JSON.stringify(['Set A', 'Set B', 'Set C']),
      set_num_in_set: 3,
      fusion_limit: 5,
    };
    const { mainDescription, setBonusDescription } = getModCardDisplayTexts(mod, 0, {
      setRank: 2,
    });
    expect(mainDescription).toContain('10%');
    expect(setBonusDescription).toBe('Set B');
  });

  it('applies Umbral multiplier at any rank when equipped count >= 2', () => {
    const mod: Mod = {
      unique_name: '/u/umbra',
      name: 'Umbral Vitality',
      mod_set: 'UmbraModSet',
      description: JSON.stringify(['+10 Health', '+440 Health']),
      set_stats: JSON.stringify(['+100 Health']),
      set_num_in_set: 3,
      fusion_limit: 1,
    };
    const { mainDescription, setBonusDescription } = getModCardDisplayTexts(mod, 0, {
      umbraSetEquippedCount: 3,
    });
    expect(mainDescription).toContain('18');
    expect(setBonusDescription).toBe('Enhances all equipped mods within the set');
  });
});
