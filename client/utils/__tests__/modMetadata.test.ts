import { describe, it, expect } from 'vitest';

import type { Mod } from '../../types/warframe';
import { isWeaponExilusMod } from '../modMetadata';

describe('isWeaponExilusMod', () => {
  it('accepts is_utility 1 and boolean/string quirks', () => {
    const base = {
      unique_name: '/x',
      name: 'Test',
    };
    expect(isWeaponExilusMod({ ...base, is_utility: 1 } as Mod)).toBe(true);
    expect(isWeaponExilusMod({ ...base, is_utility: true } as unknown as Mod)).toBe(true);
    expect(isWeaponExilusMod({ ...base, is_utility: '1' } as unknown as Mod)).toBe(true);
  });

  it('detects ammo mutation mods when isUtility was missing from import', () => {
    expect(
      isWeaponExilusMod({
        unique_name: '/Lotus/Upgrades/Mods/Rifle/WeaponSnipersConvertAmmoMod',
        name: 'Sniper Ammo Mutation',
      } as Mod),
    ).toBe(true);
  });

  it('detects known weapon exilus names when isUtility is missing', () => {
    expect(
      isWeaponExilusMod({
        unique_name: '/Lotus/Upgrades/Mods/Rifle/BowFlightSpeedMod',
        name: 'Terminal Velocity',
      } as Mod),
    ).toBe(true);
  });
});
