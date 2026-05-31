import { describe, expect, it } from 'vitest';

import { artifactSlotsFromEditorRows, buildArtifactSlotEditorRows } from './artifactSlotLayout.js';

describe('artifactSlotLayout', () => {
  it('round-trips 12 necramech general slots', () => {
    const slots = Array.from({ length: 12 }, (_, i) => (i === 0 ? 'AP_ATTACK' : 'AP_UNIVERSAL'));
    const rows = buildArtifactSlotEditorRows('necramech', slots);
    const saved = artifactSlotsFromEditorRows('necramech', rows);
    expect(saved).toHaveLength(12);
    expect(saved[0]).toBe('AP_ATTACK');
  });
});
