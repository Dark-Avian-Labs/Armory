import { describe, expect, it } from 'vitest';

import { buildAbilitiesListQuery } from './abilitiesListQuery.js';

describe('buildAbilitiesListQuery', () => {
  it('filters by ability unique names only when both warframe and names are provided', () => {
    const q = buildAbilitiesListQuery('/Lotus/Powersuits/Ninja/Ninja', [
      '/Lotus/Powersuits/Ninja/Abilities/GlaiveAbility',
      '/Lotus/Powersuits/Ninja/Abilities/SmokeScreenAbility',
    ]);
    expect(q?.whereSql).toBe('unique_name IN (?,?)');
    expect(q?.params).toEqual([
      '/Lotus/Powersuits/Ninja/Abilities/GlaiveAbility',
      '/Lotus/Powersuits/Ninja/Abilities/SmokeScreenAbility',
    ]);
    expect(q?.whereSql).not.toContain('warframe_unique_name');
  });

  it('filters by warframe when no ability names are given', () => {
    const q = buildAbilitiesListQuery('/Lotus/Powersuits/Ninja/AshPrime', []);
    expect(q).toEqual({
      whereSql: 'warframe_unique_name = ?',
      params: ['/Lotus/Powersuits/Ninja/AshPrime'],
    });
  });

  it('returns null when no filters', () => {
    expect(buildAbilitiesListQuery(undefined, [])).toBeNull();
  });
});
