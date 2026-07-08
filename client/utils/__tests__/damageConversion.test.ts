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
      { type: 'Cold', value: 320 },
    ]);
    expect(result.totalDamage).toBe(420);
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
      { type: 'Cold', value: 260 },
      { type: 'Blast', value: 50 },
    ]);
    expect(result.totalDamage).toBe(410);
  });

  it('does not convert primaries when a combined-element claw mod is equipped', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod('Radon Claws', ['+60% Damage', '+80% Critical Damage']),
        rank: 0,
      },
    ];

    const result = calculateBuildDamage(makeWeapon(mixedPrimary), slots);

    expect(result.damageBreakdown.map((entry) => entry.type).sort()).toEqual([
      'Cold',
      'Electricity',
      'Heat',
      'Slash',
      'Toxin',
    ]);
    expect(result.damageBreakdown.find((entry) => entry.type === 'Radiation')).toBeUndefined();
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
      { type: 'Heat', value: 600 },
    ]);
    expect(result.totalDamage).toBe(840);
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
