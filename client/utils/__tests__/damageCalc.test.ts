import { describe, it, expect } from 'vitest';

import type { Weapon, Mod, ModSlot } from '../../types/warframe';
import { calculateWeaponDps } from '../damageCalc';

function makeWeapon(overrides?: Partial<Weapon>): Weapon {
  return {
    unique_name: '/test/weapon',
    name: 'Test Gun',
    mastery_req: 0,
    total_damage: 100,
    critical_chance: 0.2,
    critical_multiplier: 2.0,
    proc_chance: 0.25,
    fire_rate: 5,
    multishot: 1,
    magazine_size: 30,
    reload_time: 2.0,
    ...overrides,
  };
}

function makeMod(descriptions: string[]): Mod {
  return {
    unique_name: '/test/mod',
    name: 'Test',
    description: JSON.stringify(descriptions),
    fusion_limit: descriptions.length - 1,
  };
}

describe('calculateWeaponDps', () => {
  it('returns correct base stats with no mods', () => {
    const result = calculateWeaponDps(makeWeapon(), []);
    expect(result.base.totalDamage).toBe(100);
    expect(result.modded.totalDamage).toBe(100);
    expect(result.isMelee).toBe(false);
  });

  it('applies base damage mod', () => {
    const slots: ModSlot[] = [{ index: 0, type: 'general', mod: makeMod(['+165% Damage']), rank: 0 }];
    const result = calculateWeaponDps(makeWeapon(), slots);
    expect(result.modded.totalDamage).toBeCloseTo(265);
  });

  it('applies multishot mod', () => {
    const slots: ModSlot[] = [{ index: 0, type: 'general', mod: makeMod(['+90% Multishot']), rank: 0 }];
    const result = calculateWeaponDps(makeWeapon(), slots);
    expect(result.modded.multishot).toBeCloseTo(1.9);
  });

  it('applies critical chance mod', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+150% Critical Chance']),
        rank: 0,
      },
    ];
    const result = calculateWeaponDps(makeWeapon(), slots);
    expect(result.modded.critChance).toBeCloseTo(0.5);
  });

  it('derives burst and sustained DPS consistently from the same modded stats', () => {
    const result = calculateWeaponDps(makeWeapon(), []);
    const expectedAvgCritMult = 1 + 0.2 * (2.0 - 1);
    expect(result.averageHit).toBeCloseTo(100 * expectedAvgCritMult);
    expect(result.burstDps).toBeCloseTo(result.averageHit * 5);
    const fireTime = 30 / 5;
    expect(result.sustainedDps).toBeCloseTo(result.burstDps * (fireTime / (fireTime + 2.0)));
    expect(result.statusPerSec).toBeCloseTo(0.25 * 1 * 5);
  });

  it('identifies melee weapons by range field', () => {
    const melee = makeWeapon({
      range: 2.5,
      magazine_size: undefined,
      reload_time: undefined,
    });
    const result = calculateWeaponDps(melee, []);
    expect(result.isMelee).toBe(true);
    expect(result.sustainedDps).toBe(result.burstDps);
  });

  it('handles custom ammo cost from fire_behaviors', () => {
    const weapon = makeWeapon({
      fire_behaviors: JSON.stringify([{ ammoRequirement: 5 }]),
      magazine_size: 50,
    });
    const result = calculateWeaponDps(weapon, []);
    const shotsPerMag = Math.floor(50 / 5);
    const fireTime = shotsPerMag / 5;
    const expectedSustained = result.burstDps * (fireTime / (fireTime + 2.0));
    expect(result.sustainedDps).toBeCloseTo(expectedSustained);
  });

  it('applies Valence / progenitor bonus as base damage', () => {
    const weapon = makeWeapon({
      damage_per_shot: JSON.stringify([100, 0, 0]),
      total_damage: 100,
    });
    const result = calculateWeaponDps(weapon, [], { element: 'Heat', percent: 60 });
    expect(result.modded.totalDamage).toBeCloseTo(160);
  });
});
