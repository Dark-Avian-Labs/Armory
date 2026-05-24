import { describe, expect, it } from 'vitest';

import type { IncarnonData } from '../../types/incarnon';
import { applyIncarnonUnlockCascade, createDefaultIncarnonSelections, selectIncarnonPerk } from '../incarnonSelections';

const sampleData: IncarnonData = {
  source: 'intrinsic',
  wikiSlug: 'Felarx',
  evolutions: [
    { tier: 1, options: [{ name: 'A', description: 'a' }] },
    {
      tier: 2,
      options: [
        { name: 'B', description: 'b' },
        { name: 'B2', description: 'b2' },
      ],
    },
    { tier: 3, options: [{ name: 'C', description: 'c' }] },
    { tier: 4, options: [{ name: 'D', description: 'd' }] },
    { tier: 5, options: [{ name: 'E', description: 'e' }] },
  ],
};

describe('incarnonSelections', () => {
  it('creates default unlocked selections with first perk per tier', () => {
    const defaults = createDefaultIncarnonSelections(sampleData);
    expect(defaults).toHaveLength(5);
    expect(defaults.every((entry) => entry.unlocked)).toBe(true);
    expect(defaults[1]?.perkName).toBe('B');
  });

  it('cascades disable from a tier through all higher tiers', () => {
    const defaults = createDefaultIncarnonSelections(sampleData);
    const cascaded = applyIncarnonUnlockCascade(defaults, 3);

    expect(cascaded.find((entry) => entry.tier === 2)?.unlocked).toBe(true);
    expect(cascaded.find((entry) => entry.tier === 3)?.unlocked).toBe(false);
    expect(cascaded.find((entry) => entry.tier === 4)?.unlocked).toBe(false);
    expect(cascaded.find((entry) => entry.tier === 5)?.unlocked).toBe(false);
    expect(cascaded.find((entry) => entry.tier === 3)?.perkName).toBeNull();
  });

  it('re-enabling a tier does not auto-enable higher tiers', () => {
    const defaults = createDefaultIncarnonSelections(sampleData);
    const cascaded = applyIncarnonUnlockCascade(defaults, 3);
    const reEnabled = selectIncarnonPerk(cascaded, 3, 'C');

    expect(reEnabled.find((entry) => entry.tier === 3)?.unlocked).toBe(true);
    expect(reEnabled.find((entry) => entry.tier === 4)?.unlocked).toBe(false);
    expect(reEnabled.find((entry) => entry.tier === 5)?.unlocked).toBe(false);
  });
});
