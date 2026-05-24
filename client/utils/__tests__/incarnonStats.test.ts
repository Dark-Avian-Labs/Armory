import { describe, expect, it } from 'vitest';

import type { IncarnonData, IncarnonSelection } from '../../types/incarnon';
import { applyIncarnonStatBonuses } from '../incarnonStats';

const sampleData: IncarnonData = {
  source: 'genesis',
  wikiSlug: 'Boltor_Incarnon_Genesis',
  evolutions: [
    {
      tier: 1,
      options: [{ name: 'Incarnon Form', description: 'Transform' }],
    },
    {
      tier: 2,
      options: [
        {
          name: 'Damage Boost',
          description: '+50% damage',
          statModifiers: [{ stat: 'baseDamage', mode: 'percent', value: 0.5 }],
        },
      ],
    },
    {
      tier: 3,
      options: [
        {
          name: 'Crit Boost',
          description: '+20% crit',
          statModifiers: [{ stat: 'critChance', mode: 'percent', value: 0.2 }],
        },
      ],
    },
    {
      tier: 4,
      options: [
        {
          name: 'Fire Rate Boost',
          description: '+10% fire rate',
          statModifiers: [{ stat: 'fireRate', mode: 'percent', value: 0.1 }],
        },
      ],
    },
  ],
};

const allUnlocked: IncarnonSelection[] = [
  { tier: 1, unlocked: true, perkName: 'Incarnon Form' },
  { tier: 2, unlocked: true, perkName: 'Damage Boost' },
  { tier: 3, unlocked: true, perkName: 'Crit Boost' },
  { tier: 4, unlocked: true, perkName: 'Fire Rate Boost' },
];

describe('applyIncarnonStatBonuses', () => {
  const base = {
    totalDamage: 100,
    criticalChance: 0.1,
    procChance: 0.1,
    fireRate: 1,
    multishot: 1,
    magazineSize: 30,
    reloadTime: 2,
  };

  it('returns unchanged stats when incarnon is disabled', () => {
    const result = applyIncarnonStatBonuses(base, sampleData, allUnlocked, false);
    expect(result).toEqual(base);
  });

  it('aggregates modifiers from all unlocked tiers', () => {
    const result = applyIncarnonStatBonuses(base, sampleData, allUnlocked, true);
    expect(result.totalDamage).toBeCloseTo(150);
    expect(result.criticalChance).toBeCloseTo(0.12);
    expect(result.fireRate).toBeCloseTo(1.1);
  });

  it('skips disabled tiers and cascaded-off higher tiers', () => {
    const selections: IncarnonSelection[] = [
      { tier: 1, unlocked: true, perkName: 'Incarnon Form' },
      { tier: 2, unlocked: true, perkName: 'Damage Boost' },
      { tier: 3, unlocked: false, perkName: null },
      { tier: 4, unlocked: false, perkName: null },
    ];

    const result = applyIncarnonStatBonuses(base, sampleData, selections, true);
    expect(result.totalDamage).toBeCloseTo(150);
    expect(result.criticalChance).toBeCloseTo(0.1);
    expect(result.fireRate).toBeCloseTo(1);
  });
});
