import { describe, expect, it } from 'vitest';

import {
  AP_DISABLED,
  isArtifactSlotVisible,
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

  it('shows second aura only on extended layouts when not disabled', () => {
    const compact = Array.from({ length: 10 }, () => 'AP_UNIVERSAL');
    expect(isWarframeSecondAuraSlotActive(compact)).toBe(false);

    const extended = [...compact, 'AP_DEFENSE'];
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(true);

    extended[9] = AP_DISABLED;
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(false);
  });
});
