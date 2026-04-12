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
  it('accepts Rifle compat + Rifle type (DE export for Sniper Ammo Mutation) on Launcher category', () => {
    const sniperAmmoMutation: Mod = {
      unique_name: '/Lotus/Upgrades/Mods/Rifle/WeaponSnipersConvertAmmoMod',
      name: 'Sniper Ammo Mutation',
      type: 'Rifle',
      compat_name: 'Rifle',
    };
    const ogrisLauncherCategory = {
      unique_name: '/Lotus/Weapons/Tenno/Launcher/OgrisWeapon',
      name: 'Ogris',
      product_category: 'Launcher',
    };
    expect(filterCompatibleMods([sniperAmmoMutation], 'primary', ogrisLauncherCategory)).toHaveLength(1);
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
