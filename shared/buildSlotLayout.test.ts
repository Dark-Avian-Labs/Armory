import { describe, expect, it } from 'vitest';

import {
  buildModSlotsAreEquivalent,
  buildModSlotsFromArtifactSlots,
  reconcileBuildModSlots,
  reconcileStoredBuildModSlots,
} from './buildSlotLayout.js';

describe('buildSlotLayout', () => {
  it('adds a missing exilus slot while preserving general mods', () => {
    const existing = Array.from({ length: 8 }, (_, index) => ({
      index,
      type: 'general' as const,
      mod: { unique_name: `/Lotus/Upgrades/Mods/Pistol/TestMod${index}`, name: `Mod ${index}` },
    }));

    // Primary/secondary storage is 9 slots: 0-7 general, 8 exilus
    const artifactSlots = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_POWER'];

    const reconciled = reconcileStoredBuildModSlots(existing, {
      equipmentType: 'secondary',
      equipmentName: 'Regulators Prime',
      artifactSlotsRaw: artifactSlots,
    });

    expect(reconciled).toHaveLength(9);
    expect(reconciled.filter((slot) => slot.type === 'general')).toHaveLength(8);
    expect(reconciled[8]).toMatchObject({ type: 'exilus', polarity: 'AP_POWER' });
    expect(reconciled[0]?.mod).toEqual(existing[0]?.mod);
    expect(reconciled[7]?.mod).toEqual(existing[7]?.mod);
  });

  it('shows exilus for length-9 primary artifact_slots (exilus at index 8)', () => {
    const slots = buildModSlotsFromArtifactSlots({
      equipmentType: 'primary',
      equipmentName: 'Boltor Prime',
      artifactSlotsRaw: [
        'AP_ATTACK',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_DEFENSE',
        'AP_TACTIC',
      ],
    });
    expect(slots).toHaveLength(9);
    expect(slots[8]).toMatchObject({ type: 'exilus', polarity: 'AP_TACTIC' });
  });

  it('returns equivalent slots when layout already matches', () => {
    const target = buildModSlotsFromArtifactSlots({
      equipmentType: 'secondary',
      equipmentName: 'Regulators Prime',
      artifactSlotsRaw: [
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_POWER',
      ],
    });
    const withMods = target.map((slot, index) =>
      index === 0
        ? {
            ...slot,
            mod: { unique_name: '/Lotus/Upgrades/Mods/Pistol/TestMod', name: 'Test Mod' },
          }
        : slot,
    );

    const reconciled = reconcileBuildModSlots(withMods, target);
    expect(buildModSlotsAreEquivalent(withMods, reconciled)).toBe(true);
  });
});
