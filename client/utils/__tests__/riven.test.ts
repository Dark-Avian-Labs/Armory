import { describe, expect, it } from 'vitest';

import {
  getDispositionPips,
  getEffectiveRivenDisposition,
  resolveRivenConfig,
  verifyAndAdjustRivenConfig,
} from '../riven';

describe('getEffectiveRivenDisposition', () => {
  it('prefers omega_attenuation over riven_disposition', () => {
    expect(getEffectiveRivenDisposition({ omega_attenuation: 0.85, riven_disposition: 0.5 })).toBe(0.85);
  });

  it('falls back to riven_disposition when omega is absent', () => {
    expect(getEffectiveRivenDisposition({ riven_disposition: 0.9 })).toBe(0.9);
  });

  it('returns null when neither is set', () => {
    expect(getEffectiveRivenDisposition({})).toBeNull();
  });
});

describe('getDispositionPips', () => {
  it('maps multiplier bands to 1–5 pips', () => {
    expect(getDispositionPips(0.65)).toBe(1);
    expect(getDispositionPips(0.75)).toBe(2);
    expect(getDispositionPips(1.0)).toBe(3);
    expect(getDispositionPips(1.2)).toBe(4);
    expect(getDispositionPips(1.35)).toBe(5);
  });
});

describe('verifyAndAdjustRivenConfig', () => {
  it('clamps 3 positive no negative values to valid range', () => {
    const result = verifyAndAdjustRivenConfig(
      {
        polarity: 'AP_ATTACK',
        positive: [
          { stat: 'Damage', value: 500, isNegative: false },
          { stat: 'Multishot', value: 1, isNegative: false },
          { stat: 'Critical Chance', value: 999, isNegative: false },
        ],
      },
      'primary',
    );

    expect(result.adjusted).toBe(true);
    expect(result.config.positive[0].value).toBeCloseTo(136.1, 1);
    expect(result.config.positive[1].value).toBeCloseTo(66.8, 1);
    expect(result.config.positive[2].value).toBeCloseTo(123.7, 1);
  });

  it('clamps negative stat for 2 positive + 1 negative and enforces sign', () => {
    const result = verifyAndAdjustRivenConfig(
      {
        polarity: 'AP_ATTACK',
        positive: [
          { stat: 'Damage', value: 190, isNegative: false },
          { stat: 'Multishot', value: 130, isNegative: false },
        ],
        negative: { stat: 'Reload Speed', value: 5, isNegative: true },
      },
      'primary',
    );

    expect(result.adjusted).toBe(true);
    expect(result.config.negative?.value).toBeCloseTo(-26.7, 1);
  });
});

describe('resolveRivenConfig', () => {
  it('clamps negative Zoom when curse magnitude exceeds disposition cap (e.g. −32.1 → −25.9 at ~0.7 disp)', () => {
    const { config, warnings, adjusted } = resolveRivenConfig(
      {
        polarity: 'AP_ATTACK',
        positive: [
          { stat: 'Heat', value: 61.9, isNegative: false },
          { stat: 'Status Chance', value: 63.1, isNegative: false },
          { stat: 'Electricity', value: 63.6, isNegative: false },
        ],
        negative: { stat: 'Zoom', value: 32.1, isNegative: true },
      },
      {
        weaponType: 'primary',
        disposition: 0.7,
        assumeValuesAreMaxRank: true,
        manualRank: 8,
      },
    );

    expect(adjusted).toBe(true);
    expect(config.negative?.value).toBeCloseTo(-25.9, 1);
    expect(warnings.some((w) => w.includes('Zoom'))).toBe(true);
  });

  it('scales displayed stats to max-rank when not assume max', () => {
    const { config, rank } = resolveRivenConfig(
      {
        polarity: 'AP_ATTACK',
        positive: [
          { stat: 'Damage', value: 50, isNegative: false },
          { stat: 'Multishot', value: 30, isNegative: false },
        ],
      },
      {
        weaponType: 'primary',
        disposition: 1,
        assumeValuesAreMaxRank: false,
        manualRank: 3,
      },
    );
    expect(rank).toBe(3);
    expect(config.positive[0]!.value).toBeGreaterThan(50);
    expect(config.rivenRank).toBe(3);
  });
});
