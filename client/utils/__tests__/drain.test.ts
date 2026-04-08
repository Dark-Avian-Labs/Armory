import { describe, it, expect } from 'vitest';

import { calculateEffectiveDrain, calculateTotalCapacity, polarityMatchForUi } from '../drain';

describe('calculateEffectiveDrain', () => {
  describe('general slots', () => {
    it('returns base drain + rank with no polarity', () => {
      expect(calculateEffectiveDrain(4, 5, 5, undefined, 'AP_ATTACK', 'general')).toBe(9);
    });

    it('halves drain (rounded up) when polarity matches', () => {
      expect(calculateEffectiveDrain(4, 5, 5, 'AP_ATTACK', 'AP_ATTACK', 'general')).toBe(5);
      expect(calculateEffectiveDrain(6, 0, 5, 'AP_ATTACK', 'AP_ATTACK', 'general')).toBe(3);
    });

    it('increases drain by 25% when polarity mismatches', () => {
      expect(calculateEffectiveDrain(4, 5, 5, 'AP_DEFENSE', 'AP_ATTACK', 'general')).toBe(11);
    });

    it('handles zero rank', () => {
      expect(calculateEffectiveDrain(7, 0, 5, undefined, undefined, 'general')).toBe(7);
    });

    it('treats Riven base_drain as max-rank total (linear scale by rank)', () => {
      expect(calculateEffectiveDrain(18, 8, 8, undefined, 'AP_ATTACK', 'general', true)).toBe(18);
      expect(calculateEffectiveDrain(18, 0, 8, undefined, 'AP_ATTACK', 'general', true)).toBe(2);
      expect(calculateEffectiveDrain(18, 4, 8, 'AP_ATTACK', 'AP_ATTACK', 'general', true)).toBe(5);
    });
  });

  describe('aura slots (capacity slots)', () => {
    it('returns negative drain (adds capacity) with no polarity', () => {
      expect(calculateEffectiveDrain(-7, 0, 5, undefined, 'AP_ATTACK', 'aura')).toBe(-7);
    });

    it('doubles capacity bonus when polarity matches', () => {
      expect(calculateEffectiveDrain(-7, 0, 5, 'AP_ATTACK', 'AP_ATTACK', 'aura')).toBe(-14);
    });

    it('reduces capacity bonus by 25% when polarity mismatches', () => {
      expect(calculateEffectiveDrain(-7, 0, 5, 'AP_DEFENSE', 'AP_ATTACK', 'aura')).toBe(-5);
    });

    it('increases capacity magnitude with rank', () => {
      expect(calculateEffectiveDrain(-7, 5, 5, undefined, 'AP_ATTACK', 'aura')).toBe(-12);
    });

    it('doubles increased capacity when polarity matches at max rank', () => {
      expect(calculateEffectiveDrain(-7, 5, 5, 'AP_ATTACK', 'AP_ATTACK', 'aura')).toBe(-24);
    });
  });

  describe('stance slots (capacity slots)', () => {
    it('adds capacity like aura', () => {
      expect(calculateEffectiveDrain(-5, 0, 3, 'AP_ATTACK', 'AP_ATTACK', 'stance')).toBe(-10);
    });
  });

  describe('universal polarity (AP_ANY)', () => {
    it('halves drain when slot is universal and mod is regular', () => {
      expect(calculateEffectiveDrain(4, 5, 5, 'AP_ANY', 'AP_ATTACK', 'general')).toBe(5);
    });

    it('halves drain when mod is universal and slot is regular', () => {
      expect(calculateEffectiveDrain(4, 5, 5, 'AP_DEFENSE', 'AP_ANY', 'general')).toBe(5);
    });

    it('halves drain when both are universal', () => {
      expect(calculateEffectiveDrain(4, 5, 5, 'AP_ANY', 'AP_ANY', 'general')).toBe(5);
    });

    it('doubles aura capacity when slot is universal', () => {
      expect(calculateEffectiveDrain(-7, 0, 5, 'AP_ANY', 'AP_ATTACK', 'aura')).toBe(-14);
    });

    it('returns neutral drain for universal slot + umbra mod (no bonus, no penalty)', () => {
      expect(calculateEffectiveDrain(4, 5, 5, 'AP_ANY', 'AP_UMBRA', 'general')).toBe(9);
    });

    it('returns neutral drain for umbra slot + universal mod', () => {
      expect(calculateEffectiveDrain(4, 5, 5, 'AP_UMBRA', 'AP_ANY', 'general')).toBe(9);
    });

    it('returns neutral aura capacity for universal slot + umbra mod', () => {
      expect(calculateEffectiveDrain(-7, 0, 5, 'AP_ANY', 'AP_UMBRA', 'aura')).toBe(-7);
    });
  });
});

describe('polarityMatchForUi', () => {
  it('returns undefined when slot or mod polarity is missing', () => {
    expect(polarityMatchForUi(undefined, 'AP_ATTACK')).toBeUndefined();
    expect(polarityMatchForUi('AP_ANY', undefined)).toBeUndefined();
  });

  it('returns match for universal slot with non-Umbra mod (same as drain)', () => {
    expect(polarityMatchForUi('AP_ANY', 'AP_ATTACK')).toBe('match');
  });

  it('returns match for regular slot with universal mod', () => {
    expect(polarityMatchForUi('AP_DEFENSE', 'AP_ANY')).toBe('match');
  });

  it('returns mismatch for incompatible regular polarities', () => {
    expect(polarityMatchForUi('AP_DEFENSE', 'AP_ATTACK')).toBe('mismatch');
  });

  it('returns undefined for universal + Umbra (neutral drain, default card styling)', () => {
    expect(polarityMatchForUi('AP_ANY', 'AP_UMBRA')).toBeUndefined();
    expect(polarityMatchForUi('AP_UMBRA', 'AP_ANY')).toBeUndefined();
  });
});

describe('calculateTotalCapacity', () => {
  it('returns base capacity with no mods', () => {
    const result = calculateTotalCapacity([], 30, false);
    expect(result.remaining).toBe(30);
    expect(result.totalDrain).toBe(0);
    expect(result.capacityBonus).toBe(0);
  });

  it('doubles base capacity with reactor', () => {
    const result = calculateTotalCapacity([], 30, true);
    expect(result.remaining).toBe(60);
    expect(result.baseCapacity).toBe(60);
  });

  it('accounts for aura capacity bonus and mod drain', () => {
    const result = calculateTotalCapacity(
      [
        {
          index: 0,
          type: 'aura',
          polarity: 'AP_ATTACK',
          mod: {
            unique_name: 'a',
            name: 'Aura',
            base_drain: -7,
            fusion_limit: 5,
            polarity: 'AP_ATTACK',
          },
          rank: 5,
        },
        {
          index: 1,
          type: 'general',
          mod: {
            unique_name: 'b',
            name: 'Mod',
            base_drain: 4,
            fusion_limit: 5,
            polarity: 'AP_ATTACK',
          },
          rank: 5,
        },
      ],
      30,
      true,
    );
    expect(result.baseCapacity).toBe(60);
    expect(result.capacityBonus).toBe(24);
    expect(result.totalDrain).toBe(9);
    expect(result.remaining).toBe(75);
  });
});
