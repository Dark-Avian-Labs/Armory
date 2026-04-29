import { describe, expect, it } from 'vitest';

import {
  getDispositionPips,
  getEffectiveRivenDisposition,
  getRivenStatBounds,
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

  it('treats float noise at 0.7 boundary as rank 2 (matches 0.700 display)', () => {
    expect(getDispositionPips(0.69999999)).toBe(2);
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
    expect(result.config.positive[1].value).toBeCloseTo(60.8, 1);
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
    expect(result.config.negative?.value).toBeCloseTo(-22.3, 1);
  });
});

describe('resolveRivenConfig', () => {
  it('clamps an excessive curse toward wiki-style bounds and surfaces a warning', () => {
    const rollRule3Pos1Neg = { positiveMultiplier: 0.9375, negativeMultiplier: 0.75 };
    const { adjusted, warnings, config } = resolveRivenConfig(
      {
        polarity: 'AP_ATTACK',
        positive: [
          { stat: 'Heat', value: 61.9, isNegative: false },
          { stat: 'Status Chance', value: 63.1, isNegative: false },
          { stat: 'Electricity', value: 63.6, isNegative: false },
        ],
        negative: { stat: 'Zoom', value: 80, isNegative: true },
      },
      {
        weaponType: 'primary',
        disposition: 0.7,
        assumeValuesAreMaxRank: true,
        manualRank: 8,
      },
    );

    expect(adjusted).toBe(true);
    expect(warnings.some((w) => /Zoom|curse/i.test(w))).toBe(true);

    const neg = config.negative;
    expect(neg?.stat).toBe('Zoom');
    expect(neg?.value).toBeDefined();
    expect(neg!.value).toBeLessThan(0);
    expect(neg!.value).toBeCloseTo(-34.6, 1);

    const bounds = getRivenStatBounds('Zoom', 'primary', 0.7, true, rollRule3Pos1Neg);
    expect(bounds).not.toBeNull();
    const mag = Math.abs(neg!.value);
    const lo = Math.min(Math.abs(bounds!.min), Math.abs(bounds!.max));
    const hi = Math.max(Math.abs(bounds!.min), Math.abs(bounds!.max));
    expect(mag).toBeGreaterThanOrEqual(lo);
    expect(mag).toBeLessThanOrEqual(hi);
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
