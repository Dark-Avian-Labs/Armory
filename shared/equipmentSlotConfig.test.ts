import { describe, expect, it } from 'vitest';

import {
  artifactSlotsStorageLength,
  EQUIPMENT_SLOT_CONFIGS,
  MAX_ARTIFACT_SLOTS_STORAGE_LENGTH,
} from './equipmentSlotConfig.js';

describe('artifactSlotsStorageLength', () => {
  it('uses 10 slots for warframes with aura and exilus', () => {
    expect(artifactSlotsStorageLength(EQUIPMENT_SLOT_CONFIGS.warframe)).toBe(10);
  });

  it('uses 12 slots for necramechs', () => {
    expect(artifactSlotsStorageLength(EQUIPMENT_SLOT_CONFIGS.necramech)).toBe(12);
  });

  it('exposes max length for server validation', () => {
    expect(MAX_ARTIFACT_SLOTS_STORAGE_LENGTH).toBe(12);
  });
});
