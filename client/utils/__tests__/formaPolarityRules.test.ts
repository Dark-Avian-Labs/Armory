import { describe, expect, it } from 'vitest';

import { canEditSlotPolarityInFormaMode, supportsUmbraForma } from '../formaPolarityRules';

describe('formaPolarityRules', () => {
  it('allows umbra forma on warframes and stance-slot melee weapons', () => {
    expect(supportsUmbraForma('warframe')).toBe(true);
    expect(supportsUmbraForma('melee')).toBe(true);
    expect(supportsUmbraForma('melee', 'Exalted Blade')).toBe(true);
    expect(supportsUmbraForma('melee', 'Exalted Umbra Blade')).toBe(true);
    expect(supportsUmbraForma('primary')).toBe(false);
    expect(supportsUmbraForma('primary', 'Artemis Bow')).toBe(false);
    expect(supportsUmbraForma('secondary')).toBe(false);
    expect(supportsUmbraForma('secondary', 'Dex Pixia')).toBe(false);
  });

  it('treats posture slots as fixed in forma mode', () => {
    expect(canEditSlotPolarityInFormaMode('posture')).toBe(false);
    expect(canEditSlotPolarityInFormaMode('stance')).toBe(true);
    expect(canEditSlotPolarityInFormaMode('aura')).toBe(true);
  });
});
