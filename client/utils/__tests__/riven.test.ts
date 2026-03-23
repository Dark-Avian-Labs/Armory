import { describe, expect, it } from 'vitest';

import { resolveRivenConfig, verifyAndAdjustRivenConfig } from '../riven';

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
