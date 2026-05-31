import { describe, expect, it } from 'vitest';

import {
  AP_DISABLED,
  isArtifactSlotVisible,
  isWarframeSecondAuraConfigured,
  isWarframeSecondAuraSlotActive,
  warframeExilusArtifactIndex,
} from './artifactSlotState.js';

describe('artifactSlotState', () => {
  it('hides AP_DISABLED slots when artifact data is present', () => {
    const slots = ['AP_UNIVERSAL', AP_DISABLED];
    expect(isArtifactSlotVisible(slots, 0, true)).toBe(true);
    expect(isArtifactSlotVisible(slots, 1, true)).toBe(false);
  });

  it('uses index 10 for exilus on 11-slot warframe layouts', () => {
    const slots = Array.from({ length: 11 }, () => 'AP_UNIVERSAL');
    expect(warframeExilusArtifactIndex(slots)).toBe(10);
  });

  it('treats compact 10-slot layouts as having no configured second aura', () => {
    const compact = Array.from({ length: 10 }, () => 'AP_UNIVERSAL');
    expect(isWarframeSecondAuraConfigured(compact)).toBe(false);
    expect(isWarframeSecondAuraSlotActive(compact)).toBe(false);
  });

  it('shows second aura in builder when extended and not disabled', () => {
    const extended = [...Array.from({ length: 10 }, () => 'AP_UNIVERSAL'), 'AP_DEFENSE'];
    expect(isWarframeSecondAuraConfigured(extended)).toBe(true);
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(true);

    extended[9] = AP_DISABLED;
    expect(isWarframeSecondAuraConfigured(extended)).toBe(false);
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(false);
  });

  it('does not treat AP_UNIVERSAL at index 9 as a configured second aura', () => {
    const extended = [...Array.from({ length: 10 }, () => 'AP_UNIVERSAL'), 'AP_UNIVERSAL'];
    expect(isWarframeSecondAuraConfigured(extended)).toBe(false);
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(true);
  });
});
