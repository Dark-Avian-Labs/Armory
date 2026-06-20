import { describe, it, expect } from 'vitest';

import type { Mod, ModSlot, Warframe } from '../../types/warframe';
import { calculateWarframeStats } from '../warframeCalc';

function makeWarframe(overrides?: Partial<Warframe>): Warframe {
  return {
    unique_name: '/test/warframe',
    name: 'Test Frame',
    health: 300,
    shield: 300,
    armor: 200,
    power: 150,
    sprint_speed: 1.0,
    mastery_req: 0,
    ...overrides,
  };
}

function makeMod(descriptions: string[], overrides?: Partial<Mod>): Mod {
  return {
    unique_name: '/test/mod',
    name: 'Test',
    description: JSON.stringify(descriptions),
    fusion_limit: descriptions.length - 1,
    ...overrides,
  };
}

describe('calculateWarframeStats', () => {
  it('returns rank-30 base values with no mods', () => {
    const result = calculateWarframeStats(makeWarframe(), []);
    expect(result.health.base).toBe(400);
    expect(result.health.modded).toBe(400);
    expect(result.abilityStrength.base).toBe(100);
    expect(result.abilityStrength.modded).toBe(100);
  });

  it('applies health mod correctly', () => {
    const slots: ModSlot[] = [{ index: 0, type: 'general', mod: makeMod(['+100% Health']), rank: 0 }];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.health.modded).toBe(800);
  });

  it('applies shield mod correctly', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+100% Shield Capacity']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.shield.modded).toBe(800);
  });

  it('applies armor mod correctly', () => {
    const slots: ModSlot[] = [{ index: 0, type: 'general', mod: makeMod(['+100% Armor']), rank: 0 }];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.armor.modded).toBe(400);
  });

  it('applies sprint speed mod correctly', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+30% Sprint Speed']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.sprintSpeed.modded).toBeCloseTo(1.3);
  });

  it('applies ability strength mod correctly', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+30% Ability Strength']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.abilityStrength.modded).toBe(130);
  });

  it('stacks multiple ability mods', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+30% Ability Strength']),
        rank: 0,
      },
      {
        index: 1,
        type: 'general',
        mod: makeMod(['+30% Ability Duration']),
        rank: 0,
      },
      {
        index: 2,
        type: 'general',
        mod: makeMod(['+30% Ability Efficiency']),
        rank: 0,
      },
      {
        index: 3,
        type: 'general',
        mod: makeMod(['+45% Ability Range']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.abilityStrength.modded).toBe(130);
    expect(result.abilityDuration.modded).toBe(130);
    expect(result.abilityEfficiency.modded).toBe(130);
    expect(result.abilityRange.modded).toBe(145);
  });

  it('handles negative ability mods (e.g. Blind Rage drawback)', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+99% Ability Strength\n-55% Ability Efficiency']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.abilityStrength.modded).toBeCloseTo(199);
    expect(result.abilityEfficiency.modded).toBeCloseTo(45);
  });

  it('handles missing warframe stats gracefully', () => {
    const wf = makeWarframe({ health: undefined, shield: undefined });
    const result = calculateWarframeStats(wf, []);
    expect(result.health.base).toBe(100);
    expect(result.shield.base).toBe(0);
  });

  it('scales Inaros Prime to rank 30 before applying mods', () => {
    const inarosPrime = makeWarframe({
      unique_name: '/Lotus/Powersuits/Sandman/InarosPrime',
      name: 'Inaros Prime',
      health: 2215,
      shield: 0,
      armor: 240,
      power: 140,
      sprint_speed: 1.05,
    });

    const noMods = calculateWarframeStats(inarosPrime, []);
    expect(noMods.health.base).toBe(2415);
    expect(noMods.energy.base).toBe(190);
    expect(noMods.energy.modded).toBe(190);
  });
});

describe('Inaros Prime Immortal build health regression', () => {
  function umbraMod(name: string, rank10Line: string, unique_name: string): Mod {
    const lines = [
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.1))),
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.2))),
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.3))),
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.4))),
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.5))),
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.6))),
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.7))),
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.8))),
      rank10Line.replace(/(\d+)/, (m) => String(Math.round(Number(m) * 0.9))),
      rank10Line,
      rank10Line,
    ];
    return {
      unique_name,
      name,
      mod_set: '/Lotus/Upgrades/ModSets/Umbra/UmbraModSet',
      description: JSON.stringify(lines),
      fusion_limit: 10,
    };
  }

  it('matches in-game energy and reports post-rank-fix health delta', () => {
    const inarosPrime = makeWarframe({
      unique_name: '/Lotus/Powersuits/Sandman/InarosPrime',
      name: 'Inaros Prime',
      health: 2215,
      shield: 0,
      armor: 240,
      power: 140,
      sprint_speed: 1.05,
    });

    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'aura',
        mod: makeMod(
          [
            'Squad gains +3% Maximum Health',
            'Squad gains +7% Maximum Health',
            'Squad gains +10% Maximum Health',
            'Squad gains +13% Maximum Health',
            'Squad gains +17% Maximum Health',
            'Squad gains +20% Maximum Health',
          ],
          { name: 'Physique', fusion_limit: 5 },
        ),
        rank: 5,
      },
      {
        index: 1,
        type: 'general',
        mod: umbraMod('Umbral Vitality', '+100% Health', '/u/vit'),
        rank: 10,
      },
      {
        index: 2,
        type: 'general',
        mod: umbraMod('Umbral Fiber', '+100% Armor', '/u/fiber'),
        rank: 10,
      },
      {
        index: 3,
        type: 'general',
        mod: umbraMod('Umbral Intensify', '+44% Ability Strength', '/u/int'),
        rank: 10,
      },
    ];

    const result = calculateWarframeStats(inarosPrime, slots);

    expect(result.energy.modded).toBe(190);
    expect(result.abilityStrength.modded).toBeCloseTo(177);
    expect(result.health.modded).toBe(7245);
  });
});
