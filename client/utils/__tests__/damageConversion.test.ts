import { describe, it, expect } from 'vitest';

import type { Mod, ModSlot, Weapon } from '../../types/warframe';
import { calculateBuildDamage } from '../damage';
import {
  applyDamageConversions,
  applyPhysicalConversion,
  applyPrimaryElementConversion,
  detectDamageConversions,
} from '../damageConversion';

function makeMod(name: string, descriptions: string[]): Mod {
  return {
    unique_name: `/test/${name.replace(/\s+/g, '_')}`,
    name,
    description: JSON.stringify(descriptions),
    fusion_limit: descriptions.length - 1,
  };
}

function makeWeapon(damagePerShot: number[]): Weapon {
  return {
    unique_name: '/test/claws',
    name: 'Test Claws',
    mastery_req: 0,
    total_damage: damagePerShot.reduce((sum, value) => sum + value, 0),
    damage_per_shot: JSON.stringify(damagePerShot),
    critical_chance: 0.1,
    critical_multiplier: 2,
    proc_chance: 0.1,
    fire_rate: 1,
    range: 1.5,
  };
}

describe('detectDamageConversions', () => {
  it('detects physical conditioning mods by name', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Precision Conditioning', ['+140% Melee Damage']),
        rank: 3,
      },
    ];

    expect(detectDamageConversions(slots)).toEqual({ physicalTarget: 'Slash' });
  });

  it('detects elemental claws mods by name', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Chilling Claws', ['+120% Cold Damage', '+120% Status Chance']),
        rank: 3,
      },
    ];

    expect(detectDamageConversions(slots)).toEqual({ elementalTarget: 'Cold' });
  });

  it('does not treat Radon Claws as a conversion mod', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Radon Claws', ['+60% Damage', '+80% Critical Damage']),
        rank: 0,
      },
    ];

    expect(detectDamageConversions(slots)).toEqual({});
  });

  it('detects conversion from description text', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Custom Conditioning', ['Convert all base Physical Damage to Impact Damage.']),
        rank: 0,
      },
    ];

    expect(detectDamageConversions(slots)).toEqual({ physicalTarget: 'Impact' });
  });
});

describe('applyPhysicalConversion', () => {
  it('combines all physical damage into the target type', () => {
    const result = applyPhysicalConversion(
      [
        { type: 'Impact', value: 30 },
        { type: 'Puncture', value: 20 },
        { type: 'Slash', value: 50 },
        { type: 'Heat', value: 25 },
      ],
      'Slash',
    );

    expect(result).toEqual([
      { type: 'Heat', value: 25 },
      { type: 'Slash', value: 100 },
    ]);
  });
});

describe('applyPrimaryElementConversion', () => {
  it('combines all primary elemental damage into the target type', () => {
    const result = applyPrimaryElementConversion(
      [
        { type: 'Heat', value: 40 },
        { type: 'Cold', value: 30 },
        { type: 'Electricity', value: 20 },
        { type: 'Toxin', value: 10 },
        { type: 'Blast', value: 15 },
      ],
      'Cold',
    );

    expect(result).toEqual([
      { type: 'Blast', value: 15 },
      { type: 'Cold', value: 100 },
    ]);
  });
});

describe('calculateBuildDamage with conversion mods', () => {
  const mixedPhysical = [30, 20, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const mixedPrimary = [0, 0, 100, 40, 30, 20, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  it('converts physical damage with Precision Conditioning', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Precision Conditioning', ['+140% Melee Damage']),
        rank: 3,
      },
    ];

    const result = calculateBuildDamage(makeWeapon(mixedPhysical), slots);

    expect(result.damageBreakdown).toEqual([{ type: 'Slash', value: 240 }]);
    expect(result.totalDamage).toBe(240);
  });

  it('converts physical damage with Brute Conditioning', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Brute Conditioning', ['+140% Melee Damage']),
        rank: 3,
      },
    ];

    const result = calculateBuildDamage(makeWeapon(mixedPhysical), slots);

    expect(result.damageBreakdown).toEqual([{ type: 'Impact', value: 240 }]);
  });

  it('converts primary elemental damage with Chilling Claws', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Chilling Claws', ['+120% Cold Damage', '+120% Status Chance']),
        rank: 0,
      },
    ];

    const result = calculateBuildDamage(makeWeapon(mixedPrimary), slots);

    expect(result.damageBreakdown).toEqual([
      { type: 'Slash', value: 100 },
      { type: 'Cold', value: 220 },
    ]);
    expect(result.totalDamage).toBe(320);
  });

  it('converts other primary element mods into the claws conversion target', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Chilling Claws', ['+330% Cold\n+330% Status Chance']),
        rank: 0,
      },
      {
        index: 1,
        type: 'general',
        mod: makeMod('Shock Collar', ['+60% Electricity\n+60% Status Chance']),
        rank: 3,
      },
      {
        index: 2,
        type: 'general',
        mod: makeMod('Flame Gland', ['+60% Heat\n+60% Status Chance']),
        rank: 3,
      },
    ];

    const result = calculateBuildDamage(
      makeWeapon([0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      slots,
    );

    expect(result.damageBreakdown).toEqual([
      { type: 'Slash', value: 100 },
      { type: 'Cold', value: 450 },
    ]);
  });

  it('leaves combined elemental damage unchanged when converting primaries', () => {
    const withSecondary = [0, 0, 100, 40, 30, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Chilling Claws', ['+120% Cold Damage', '+120% Status Chance']),
        rank: 0,
      },
    ];

    const result = calculateBuildDamage(makeWeapon(withSecondary), slots);

    expect(result.damageBreakdown).toEqual([
      { type: 'Slash', value: 100 },
      { type: 'Cold', value: 190 },
      { type: 'Blast', value: 50 },
    ]);
    expect(result.totalDamage).toBe(340);
  });

  it('does not convert primaries when a combined-element claw mod is equipped', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Radon Claws', ['+60% Radiation\n+80% Critical Damage']),
        rank: 3,
      },
    ];

    const result = calculateBuildDamage(makeWeapon(mixedPrimary), slots);

    expect(result.damageBreakdown.map((entry) => entry.type).sort()).toEqual([
      'Cold',
      'Electricity',
      'Heat',
      'Radiation',
      'Slash',
      'Toxin',
    ]);
    expect(result.damageBreakdown.find((entry) => entry.type === 'Radiation')?.value).toBe(60);
  });

  it('applies both physical and elemental conversions when both mods are equipped', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Precision Conditioning', ['+140% Melee Damage']),
        rank: 3,
      },
      {
        index: 1,
        type: 'general',
        mod: makeMod('Burning Claws', ['+120% Heat Damage', '+120% Status Chance']),
        rank: 0,
      },
    ];

    const result = calculateBuildDamage(
      makeWeapon([30, 20, 50, 40, 30, 20, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      slots,
    );

    expect(result.damageBreakdown).toEqual([
      { type: 'Slash', value: 240 },
      { type: 'Heat', value: 360 },
    ]);
    expect(result.totalDamage).toBe(600);
  });

  it('matches the Panzer Claws companion build breakdown', () => {
    const panzerClaws: Weapon = {
      unique_name: '/test/panzer-claws',
      name: 'Panzer Claws',
      mastery_req: 0,
      total_damage: 90,
      damage_per_shot: JSON.stringify([0, 0, 45, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      critical_chance: 0.25,
      critical_multiplier: 2,
      proc_chance: 0.125,
      fire_rate: 1,
      range: 1.5,
    };

    const slots: ModSlot[] = [
      { index: 0, type: 'general', mod: makeMod('Precision Conditioning', ['+385% Melee Damage']), rank: 0 },
      { index: 1, type: 'general', mod: makeMod('Chilling Claws', ['+330% Cold\n+330% Status Chance']), rank: 0 },
      { index: 2, type: 'general', mod: makeMod('Maul', ['+330% Melee Damage']), rank: 0 },
      { index: 3, type: 'general', mod: makeMod('Radon Claws', ['+60% Radiation\n+80% Critical Damage']), rank: 0 },
      { index: 4, type: 'general', mod: makeMod('Shock Collar', ['+60% Electricity\n+60% Status Chance']), rank: 0 },
      { index: 5, type: 'general', mod: makeMod('Flame Gland', ['+60% Heat\n+60% Status Chance']), rank: 0 },
    ];

    const result = calculateBuildDamage(panzerClaws, slots);

    expect(result.damageBreakdown.find((entry) => entry.type === 'Slash')?.value).toBeCloseTo(366.8);
    expect(result.damageBreakdown.find((entry) => entry.type === 'Cold')?.value).toBeCloseTo(816.8);
    expect(result.damageBreakdown.find((entry) => entry.type === 'Radiation')?.value).toBe(60);
    expect(result.damageBreakdown.find((entry) => entry.type === 'Magnetic')).toBeUndefined();
    expect(result.damageBreakdown.find((entry) => entry.type === 'Heat')).toBeUndefined();
  });
});

describe('applyDamageConversions', () => {
  it('rounds converted values to one decimal place', () => {
    const result = applyDamageConversions(
      [
        { type: 'Impact', value: 33.33 },
        { type: 'Slash', value: 33.33 },
      ],
      { physicalTarget: 'Slash' },
    );

    expect(result).toEqual([{ type: 'Slash', value: 66.7 }]);
  });
});
