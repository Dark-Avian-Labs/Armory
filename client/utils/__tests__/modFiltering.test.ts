import { describe, expect, it } from 'vitest';

import type { Mod } from '../../types/warframe';
import { getModLockoutKeys, isModLockedOut } from '../modFiltering';

function mod(partial: Partial<Mod> & Pick<Mod, 'unique_name' | 'name'>): Mod {
  return {
    type: 'Warframe Mod',
    ...partial,
  };
}

describe('getModLockoutKeys / isModLockedOut', () => {
  it('treats Parkour 2.0 subclasses as one lockout group', () => {
    const mobilize = mod({
      unique_name: '/Lotus/Upgrades/Mods/Warframe/ParkourTwoMod',
      name: 'Mobilize',
    });
    const patagium = mod({
      unique_name: '/Lotus/Upgrades/Mods/Warframe/SuperGlideParkourTwoMod',
      name: 'Patagium',
    });
    expect(getModLockoutKeys(mobilize)).toContain('path:warframe_parkour_two');
    expect(getModLockoutKeys(patagium)).toContain('path:warframe_parkour_two');
    expect(isModLockedOut(mobilize, [patagium])).toBe(true);
  });

  it('still merges Primed/Amalgam variants via legacy name|type', () => {
    const serration = mod({
      unique_name: '/Lotus/Upgrades/Mods/Rifle/WeaponDamageAmountMod',
      name: 'Serration',
      type: 'PRIMARY',
    });
    const amalgam = mod({
      unique_name: '/Lotus/Upgrades/Mods/DualSource/Rifle/SerratedRushMod',
      name: 'Amalgam Serration',
      type: 'PRIMARY',
    });
    expect(isModLockedOut(amalgam, [serration])).toBe(true);
    expect(isModLockedOut(serration, [amalgam])).toBe(true);
  });

  it('merges Berserker Fury with Fury via Berserker prefix strip', () => {
    const fury = mod({
      unique_name: '/Lotus/Upgrades/Mods/Melee/WeaponFireRateMod',
      name: 'Fury',
      type: 'MELEE',
    });
    const berserker = mod({
      unique_name: '/Lotus/Upgrades/Mods/Melee/WeaponCritFireRateBonusMod',
      name: 'Berserker Fury',
      type: 'MELEE',
    });
    expect(isModLockedOut(berserker, [fury])).toBe(true);
  });

  it('groups Archon school Exilus mods', () => {
    const a = mod({
      unique_name: '/Lotus/Upgrades/Mods/Sets/Amar/AmarExilusMod',
      name: "Amar's Anguish",
    });
    const b = mod({
      unique_name: '/Lotus/Upgrades/Mods/Sets/Boreal/BorealExilusMod',
      name: "Boreal's Anguish",
    });
    expect(isModLockedOut(b, [a])).toBe(true);
  });

  it('groups Critical Deceleration with Blunderbuss', () => {
    const blunder = mod({
      unique_name: '/Lotus/Upgrades/Mods/Shotgun/WeaponCritChanceMod',
      name: 'Blunderbuss',
      type: 'PRIMARY',
    });
    const critDec = mod({
      unique_name: '/Lotus/Upgrades/Mods/Shotgun/DualStat/CorruptedCritChanceFireRateShotgun',
      name: 'Critical Deceleration',
      type: 'PRIMARY',
    });
    expect(isModLockedOut(critDec, [blunder])).toBe(true);
  });

  it('does not flag unrelated mods as locked out', () => {
    const serration = mod({
      unique_name: '/Lotus/Upgrades/Mods/Rifle/WeaponDamageAmountMod',
      name: 'Serration',
      type: 'PRIMARY',
    });
    const splitChamber = mod({
      unique_name: '/Lotus/Upgrades/Mods/Rifle/WeaponFireIterationsMod',
      name: 'Split Chamber',
      type: 'PRIMARY',
    });
    expect(isModLockedOut(splitChamber, [serration])).toBe(false);
  });
});
