import { describe, expect, it } from 'vitest';

import {
  AP_DISABLED,
  isArtifactSlotVisible,
  isWarframeSecondAuraSlotActive,
  warframeExilusArtifactIndex,
  warframeSecondAuraApFromStorage,
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

  it('treats compact 10-slot layouts as no second aura', () => {
    const compact = Array.from({ length: 10 }, () => 'AP_UNIVERSAL');
    expect(warframeSecondAuraApFromStorage(compact)).toBe(AP_DISABLED);
    expect(isWarframeSecondAuraSlotActive(compact)).toBe(false);
    expect(warframeExilusArtifactIndex(compact)).toBe(9);
  });

  it('loads 11-slot second aura from index 9 including AP_UNIVERSAL', () => {
    const extended = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_UNIVERSAL', 'AP_DEFENSE'];
    expect(warframeSecondAuraApFromStorage(extended)).toBe('AP_UNIVERSAL');
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(true);

    extended[9] = 'AP_DEFENSE';
    expect(warframeSecondAuraApFromStorage(extended)).toBe('AP_DEFENSE');
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(true);

    extended[9] = AP_DISABLED;
    expect(warframeSecondAuraApFromStorage(extended)).toBe(AP_DISABLED);
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(false);
  });
});
