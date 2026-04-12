import { describe, it, expect } from 'vitest';

import type { Mod } from '../../types/warframe';
import { filterCompatibleMods, normalizeWeaponIdentityName, WEAPON_CATEGORY_TO_MOD_COMPAT } from '../modFiltering';

describe('normalizeWeaponIdentityName', () => {
  it('strips Kuva, Tenet, and Coda prefixes for augment matching', () => {
    expect(normalizeWeaponIdentityName('Kuva Ogris')).toBe('OGRIS');
    expect(normalizeWeaponIdentityName('Tenet Envoy')).toBe('ENVOY');
    expect(normalizeWeaponIdentityName('Coda Vasto')).toBe('VASTO');
    expect(normalizeWeaponIdentityName('Kuva Tenet Test')).toBe('TEST');
  });
});

describe('Launcher mod compatibility', () => {
  it('accepts primary mods whose export type is "Rifle Mod"', () => {
    const mod: Mod = {
      unique_name: '/test/rifle/mod',
      name: 'Test',
      type: 'Rifle Mod',
      compat_name: 'Rifle',
    };
    const weapon = {
      unique_name: '/Lotus/Weapons/Tenno/Launcher/Ogris',
      name: 'Ogris',
      product_category: 'Launcher',
    };
    expect(filterCompatibleMods([mod], 'primary', weapon)).toHaveLength(1);
  });

  it('does not map Sniper via WEAPON_CATEGORY_TO_MOD_COMPAT.Launcher (uses path/name helper instead)', () => {
    expect(WEAPON_CATEGORY_TO_MOD_COMPAT.Launcher).not.toContain('Sniper');
  });

  it('accepts Sniper-category mods on Launchers via primaryWeaponAcceptsSniperCategoryMods', () => {
    const sniperMod: Mod = {
      unique_name: '/lotus/upgrades/mods/sniper/test',
      name: 'Sniper Ammo Mutation',
      type: 'PRIMARY',
      compat_name: 'Sniper',
    };
    const launcher = {
      unique_name: '/weapons/launcher/test',
      name: 'Test Launcher',
      product_category: 'Launcher',
    };
    expect(filterCompatibleMods([sniperMod], 'primary', launcher)).toHaveLength(1);
  });

  it('accepts Sniper-category mods when unique_name uses /Launcher/ (singular) path', () => {
    const sniperMod: Mod = {
      unique_name: '/lotus/upgrades/mods/sniper/test',
      name: 'Sniper Ammo Mutation',
      type: 'PRIMARY',
      compat_name: 'Sniper',
    };
    const ogrisLauncherPath = {
      unique_name: '/Lotus/Weapons/Tenno/Launcher/Ogris',
      name: 'Ogris',
      product_category: 'LongGuns',
    };
    expect(filterCompatibleMods([sniperMod], 'primary', ogrisLauncherPath)).toHaveLength(1);
  });

  it('accepts Sniper-category mods when weapon is LongGuns but launcher-profile (e.g. Kuva Ogris)', () => {
    const sniperMod: Mod = {
      unique_name: '/lotus/upgrades/mods/sniper/test',
      name: 'Sniper Ammo Mutation',
      type: 'PRIMARY',
      compat_name: 'Sniper',
    };
    const kuvaOgrisAsLongGuns = {
      unique_name: '/Lotus/Weapons/Grineer/Kuva/KuvaOgris',
      name: 'Kuva Ogris',
      product_category: 'LongGuns',
    };
    expect(filterCompatibleMods([sniperMod], 'primary', kuvaOgrisAsLongGuns)).toHaveLength(1);
  });

  it('does not apply Sniper launcher rule to ordinary LongGuns rifles', () => {
    const sniperMod: Mod = {
      unique_name: '/lotus/upgrades/mods/sniper/test',
      name: 'Sniper Ammo Mutation',
      type: 'PRIMARY',
      compat_name: 'Sniper',
    };
    const boltor = {
      unique_name: '/Lotus/Weapons/Tenno/Rifle/Boltor',
      name: 'Boltor',
      product_category: 'LongGuns',
    };
    expect(filterCompatibleMods([sniperMod], 'primary', boltor)).toHaveLength(0);
  });

  it('matches weapon-specific mods to Kuva variants', () => {
    const augment: Mod = {
      unique_name: '/test/ogris/augment',
      name: 'Nightwatch Napalm',
      type: 'PRIMARY',
      compat_name: 'Ogris',
    };
    const kuvaOgris = {
      unique_name: '/weapons/kuva/ogris',
      name: 'Kuva Ogris',
      product_category: 'Launcher',
    };
    expect(filterCompatibleMods([augment], 'primary', kuvaOgris)).toHaveLength(1);
  });
});

describe('DE generic type "---" mod compatibility', () => {
  const sniperAmmoMutationReal: Mod = {
    unique_name: '/Lotus/Upgrades/Mods/Rifle/WeaponSnipersConvertAmmoMod',
    name: 'Sniper Ammo Mutation',
    type: '---',
    compat_name: 'Sniper',
  };

  const primedSniperAmmoMutationReal: Mod = {
    unique_name: '/Lotus/Upgrades/Mods/Rifle/Expert/WeaponSnipersConvertAmmoModExpert',
    name: 'Primed Sniper Ammo Mutation',
    type: '---',
    compat_name: 'Sniper',
  };

  const ogrisLauncher = {
    unique_name: '/Lotus/Weapons/ClanTech/Chemical/RocketLauncher',
    name: 'Ogris',
    product_category: 'Launcher',
  };

  const kuvaOgrisLongGuns = {
    unique_name: '/Lotus/Weapons/Grineer/Kuva/KuvaOgris',
    name: 'Kuva Ogris',
    product_category: 'LongGuns',
  };

  const rubicoPrimeSniper = {
    unique_name: '/Lotus/Weapons/Tenno/Rifle/Rubico/RubicoPrime',
    name: 'Rubico Prime',
    product_category: 'Sniper',
  };

  const boltor = {
    unique_name: '/Lotus/Weapons/Tenno/Rifle/Boltor',
    name: 'Boltor',
    product_category: 'LongGuns',
  };

  it('accepts Sniper Ammo Mutation (type "---") on Ogris (Launcher category)', () => {
    expect(filterCompatibleMods([sniperAmmoMutationReal], 'primary', ogrisLauncher)).toHaveLength(1);
  });

  it('accepts Primed Sniper Ammo Mutation (type "---") on Ogris (Launcher category)', () => {
    expect(filterCompatibleMods([primedSniperAmmoMutationReal], 'primary', ogrisLauncher)).toHaveLength(1);
  });

  it('accepts Sniper Ammo Mutation (type "---") on Kuva Ogris (LongGuns with launcher name)', () => {
    expect(filterCompatibleMods([sniperAmmoMutationReal], 'primary', kuvaOgrisLongGuns)).toHaveLength(1);
  });

  it('accepts Sniper Ammo Mutation (type "---") on Rubico Prime (Sniper category)', () => {
    expect(filterCompatibleMods([sniperAmmoMutationReal], 'primary', rubicoPrimeSniper)).toHaveLength(1);
  });

  it('does NOT accept Sniper Ammo Mutation (type "---") on Boltor (regular LongGuns)', () => {
    expect(filterCompatibleMods([sniperAmmoMutationReal], 'primary', boltor)).toHaveLength(0);
  });

  it('does NOT accept Necramech mods (type "---") as primary', () => {
    const necramechMod: Mod = {
      unique_name: '/lotus/upgrades/mods/necramech/test',
      name: 'Necramech Stretch',
      type: '---',
      compat_name: 'Necramech',
    };
    expect(filterCompatibleMods([necramechMod], 'primary', ogrisLauncher)).toHaveLength(0);
  });

  it('does NOT accept K-Drive mods (type "---") as primary', () => {
    const kdriveMod: Mod = {
      unique_name: '/lotus/upgrades/mods/kdrive/test',
      name: 'K-Drive Test',
      type: '---',
      compat_name: 'K-Drive',
    };
    expect(filterCompatibleMods([kdriveMod], 'primary', ogrisLauncher)).toHaveLength(0);
  });

  it('accepts Sniper Ammo Mutation (type "---") after import resolves type to SNIPER', () => {
    const resolved: Mod = {
      ...sniperAmmoMutationReal,
      type: 'SNIPER',
    };
    expect(filterCompatibleMods([resolved], 'primary', ogrisLauncher)).toHaveLength(1);
    expect(filterCompatibleMods([resolved], 'primary', rubicoPrimeSniper)).toHaveLength(1);
  });
});
