import { describe, expect, it } from 'vitest';

import { AP_DISABLED } from '../../shared/artifactSlotState.js';
import { artifactSlotsFromEditorRows, buildArtifactSlotEditorRows } from './artifactSlotLayout.js';

describe('artifactSlotLayout', () => {
  it('shows Aura 2 as off for standard 10-slot warframes like Ash', () => {
    const slots = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_DEFENSE'];
    const rows = buildArtifactSlotEditorRows('warframe', slots, 'Ash');
    const aura2 = rows.find((r) => r.id === 'aura-2');
    expect(aura2?.enabled).toBe(false);
  });

  it('shows export default polarities when artifact_slots are empty', () => {
    const rows = buildArtifactSlotEditorRows('warframe', [], 'Ash', {
      aura_polarity: 'AP_ANY',
      exilus_polarity: 'AP_POWER',
      polarities: JSON.stringify([
        'AP_TACTIC',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
        'AP_UNIVERSAL',
      ]),
    });
    expect(rows.find((r) => r.id === 'aura')?.polarity).toBe('AP_ANY');
    expect(rows.find((r) => r.id === 'exilus')?.polarity).toBe('AP_POWER');
    expect(rows.find((r) => r.id === 'general-0')?.polarity).toBe('AP_TACTIC');
  });

  it('saves compact 10-slot arrays when Aura 2 is off', () => {
    const rows = buildArtifactSlotEditorRows('warframe', [], 'Ash');
    const saved = artifactSlotsFromEditorRows('warframe', rows);
    expect(saved).toHaveLength(10);
    expect(saved[9]).not.toBe(AP_DISABLED);
  });

  it('saves extended 11-slot arrays when Aura 2 is on', () => {
    const rows = buildArtifactSlotEditorRows('warframe', [], 'Jade');
    const aura2 = rows.find((r) => r.id === 'aura-2');
    expect(aura2).toBeDefined();
    const enabled = rows.map((row) =>
      row.id === 'aura-2' ? { ...row, enabled: true, polarity: 'AP_DEFENSE' as const } : row,
    );
    const saved = artifactSlotsFromEditorRows('warframe', enabled);
    expect(saved).toHaveLength(11);
    expect(saved[9]).toBe('AP_DEFENSE');
  });

  it('loads Aura 2 on for 11-slot Jade data', () => {
    const slots = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_DEFENSE', 'AP_UNIVERSAL'];
    const rows = buildArtifactSlotEditorRows('warframe', slots, 'Jade');
    const aura2 = rows.find((r) => r.id === 'aura-2');
    expect(aura2?.enabled).toBe(true);
    expect(aura2?.polarity).toBe('AP_DEFENSE');
    expect(rows.find((r) => r.id === 'exilus')?.artifactIndex).toBe(10);
  });

  it('round-trips Jade extended layout to 11 slots on save', () => {
    const slots = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_DEFENSE', 'AP_UNIVERSAL'];
    const rows = buildArtifactSlotEditorRows('warframe', slots, 'Jade');
    const saved = artifactSlotsFromEditorRows('warframe', rows);
    expect(saved).toHaveLength(11);
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
