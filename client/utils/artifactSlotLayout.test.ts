import { describe, expect, it } from 'vitest';

import { AP_DISABLED } from '../../shared/artifactSlotState.js';
import { artifactSlotsFromEditorRows, buildArtifactSlotEditorRows } from './artifactSlotLayout.js';

describe('artifactSlotLayout', () => {
  it('shows Aura 2 for all warframes in the admin editor', () => {
    const rows = buildArtifactSlotEditorRows('warframe', [], 'Excalibur');
    expect(rows.some((r) => r.id === 'aura-2')).toBe(true);
  });

  it('saves disabled Aura 2 as AP_DISABLED on 11-slot warframe arrays', () => {
    const rows = buildArtifactSlotEditorRows('warframe', [], 'Excalibur');
    const aura2 = rows.find((r) => r.id === 'aura-2');
    expect(aura2).toBeDefined();
    const saved = artifactSlotsFromEditorRows('warframe', rows);
    expect(saved).toHaveLength(11);
    expect(saved[9]).toBe(AP_DISABLED);
  });

  it('round-trips Jade extended layout with active Aura 2', () => {
    const slots = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_DEFENSE', 'AP_UNIVERSAL'];
    const rows = buildArtifactSlotEditorRows('warframe', slots, 'Jade');
    const saved = artifactSlotsFromEditorRows('warframe', rows);
    expect(saved).toHaveLength(11);
    expect(saved[8]).toBe('AP_ANY');
    expect(saved[9]).toBe('AP_DEFENSE');
  });

  it('round-trips 12 necramech general slots', () => {
    const slots = Array.from({ length: 12 }, (_, i) => (i === 0 ? 'AP_ATTACK' : 'AP_UNIVERSAL'));
    const rows = buildArtifactSlotEditorRows('necramech', slots);
    const saved = artifactSlotsFromEditorRows('necramech', rows);
    expect(saved).toHaveLength(12);
    expect(saved[0]).toBe('AP_ATTACK');
  });
});
