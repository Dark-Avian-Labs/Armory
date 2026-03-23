import { describe, it, expect } from 'vitest';

import type { Mod, ModSlot } from '../../types/warframe';
import { parseModEffects, aggregateAllMods } from '../modStatParser';
import { RIVEN_MOD_UNIQUE } from '../riven';

function makeMod(descriptions: string[], overrides?: Partial<Mod>): Mod {
  return {
    unique_name: '/test',
    name: 'Test Mod',
    description: JSON.stringify(descriptions),
    fusion_limit: descriptions.length - 1,
    ...overrides,
  };
}

describe('parseModEffects', () => {
  describe('weapon stats', () => {
    it('parses base damage', () => {
      const mod = makeMod(['+100% Damage', '+165% Damage']);
      expect(parseModEffects(mod, 1).baseDamage).toBeCloseTo(1.65);
    });

    it('parses multishot', () => {
      const mod = makeMod(['+60% Multishot', '+90% Multishot']);
      expect(parseModEffects(mod, 1).multishot).toBeCloseTo(0.9);
    });

    it('parses critical chance', () => {
      const mod = makeMod(['+150% Critical Chance']);
      expect(parseModEffects(mod, 0).critChance).toBeCloseTo(1.5);
    });

    it('parses fire rate and attack speed as same key', () => {
      const mod = makeMod(['+30% Fire Rate']);
      expect(parseModEffects(mod, 0).fireRate).toBeCloseTo(0.3);

      const melee = makeMod(['+30% Attack Speed']);
      expect(parseModEffects(melee, 0).fireRate).toBeCloseTo(0.3);
    });

    it('parses elemental damage with color tags', () => {
      const mod = makeMod(['+90% <DT_FIRE_COLOR>Heat']);
      const effects = parseModEffects(mod, 0);
      expect(effects.heatDamage).toBeCloseTo(0.9);
    });

    it('parses multi-line descriptions', () => {
      const mod = makeMod(['+60% Damage\n+60% Multishot']);
      const effects = parseModEffects(mod, 0);
      expect(effects.baseDamage).toBeCloseTo(0.6);
      expect(effects.multishot).toBeCloseTo(0.6);
    });
  });

  describe('warframe stats', () => {
    it('parses health', () => {
      const mod = makeMod(['+100% Health']);
      expect(parseModEffects(mod, 0).health).toBeCloseTo(1.0);
    });

    it('parses health with additional text (Archon mods)', () => {
      const mod = makeMod([
        '+100% Health\nStatus Effects from abilities that deal <DT_FIRE_COLOR>Heat Damage will be applied twice.',
      ]);
      expect(parseModEffects(mod, 0).health).toBeCloseTo(1.0);
    });

    it('parses shield capacity', () => {
      const mod = makeMod(['+100% Shield Capacity']);
      expect(parseModEffects(mod, 0).shield).toBeCloseTo(1.0);
    });

    it('parses armor', () => {
      const mod = makeMod(['+100% Armor']);
      expect(parseModEffects(mod, 0).armor).toBeCloseTo(1.0);
    });

    it('parses sprint speed', () => {
      const mod = makeMod(['+30% Sprint Speed']);
      expect(parseModEffects(mod, 0).sprintSpeed).toBeCloseTo(0.3);
    });

    it('parses ability strength', () => {
      const mod = makeMod(['+30% Ability Strength']);
      expect(parseModEffects(mod, 0).abilityStrength).toBeCloseTo(0.3);
    });

    it('parses ability duration', () => {
      const mod = makeMod(['+30% Ability Duration']);
      expect(parseModEffects(mod, 0).abilityDuration).toBeCloseTo(0.3);
    });

    it('parses ability efficiency', () => {
      const mod = makeMod(['+30% Ability Efficiency']);
      expect(parseModEffects(mod, 0).abilityEfficiency).toBeCloseTo(0.3);
    });

    it('parses ability range', () => {
      const mod = makeMod(['+45% Ability Range']);
      expect(parseModEffects(mod, 0).abilityRange).toBeCloseTo(0.45);
    });
  });

  it('clamps rank to available descriptions', () => {
    const mod = makeMod(['+10% Damage', '+20% Damage']);
    expect(parseModEffects(mod, 5).baseDamage).toBeCloseTo(0.2);
  });

  it('returns zeros for invalid description JSON', () => {
    const mod = makeMod([]);
    mod.description = 'not json';
    const effects = parseModEffects(mod, 0);
    expect(effects.baseDamage).toBe(0);
  });

  it('scales riven mod text by slot rank (stored max-rank values)', () => {
    const mod = makeMod(['+90% Damage'], {
      unique_name: RIVEN_MOD_UNIQUE,
      fusion_limit: 8,
    });
    expect(parseModEffects(mod, 0).baseDamage).toBeCloseTo(0.9 / 9);
    expect(parseModEffects(mod, 8).baseDamage).toBeCloseTo(0.9);
  });
});

describe('aggregateAllMods', () => {
  it('sums effects from multiple mods', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+100% Damage']),
        rank: 0,
      },
      {
        index: 1,
        type: 'general',
        mod: makeMod(['+60% Multishot']),
        rank: 0,
      },
    ];

    const total = aggregateAllMods(slots);
    expect(total.baseDamage).toBeCloseTo(1.0);
    expect(total.multishot).toBeCloseTo(0.6);
  });

  it('skips empty slots', () => {
    const slots: ModSlot[] = [
      { index: 0, type: 'general' },
      {
        index: 1,
        type: 'general',
        mod: makeMod(['+50% Damage']),
        rank: 0,
      },
    ];

    const total = aggregateAllMods(slots);
    expect(total.baseDamage).toBeCloseTo(0.5);
  });

  it('uses max rank when rank not specified', () => {
    const mod = makeMod(['+50% Damage', '+100% Damage', '+165% Damage']);
    const slots: ModSlot[] = [{ index: 0, type: 'general', mod }];

    const total = aggregateAllMods(slots);
    expect(total.baseDamage).toBeCloseTo(1.65);
  });
});
