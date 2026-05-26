import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { MAX_MOD_CONFIG_JSON_BYTES, MAX_MOD_CONFIG_SLOTS } from './modConfigLimits.js';
import { MAX_MOD_CONFIG_NAME_LENGTH, minimalModConfig, ModConfigSchema, ModSlotSchema } from './modConfigValidation.js';

describe('ModConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const result = ModConfigSchema.safeParse(minimalModConfig());
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(ModConfigSchema.safeParse(minimalModConfig({ name: '' })).success).toBe(false);
  });

  it('rejects name over max length', () => {
    expect(
      ModConfigSchema.safeParse(minimalModConfig({ name: 'x'.repeat(MAX_MOD_CONFIG_NAME_LENGTH + 1) })).success,
    ).toBe(false);
  });

  it('rejects invalid equipment_type', () => {
    expect(ModConfigSchema.safeParse(minimalModConfig({ equipment_type: 'invalid' as 'warframe' })).success).toBe(
      false,
    );
  });

  it('rejects more than MAX_MOD_CONFIG_SLOTS slots', () => {
    const slots = Array.from({ length: MAX_MOD_CONFIG_SLOTS + 1 }, (_, index) => ({
      index,
      type: 'general' as const,
    }));
    expect(ModConfigSchema.safeParse(minimalModConfig({ slots })).success).toBe(false);
  });

  it('rejects oversized serialized payload', () => {
    const huge = 'x'.repeat(MAX_MOD_CONFIG_JSON_BYTES + 1);
    expect(ModConfigSchema.safeParse(minimalModConfig({ note: huge })).success).toBe(false);
  });

  it('rejects riven positive stat marked negative', () => {
    const config = minimalModConfig({
      slots: [
        {
          index: 0,
          type: 'general',
          riven_config: {
            positive: [{ stat: 'Damage', value: 100, isNegative: true }],
          },
        },
      ],
    });
    expect(ModConfigSchema.safeParse(config).success).toBe(false);
  });

  it('rejects invalid valence element', () => {
    expect(
      ModConfigSchema.safeParse(
        minimalModConfig({
          valenceBonus: { element: 'Void' as 'Heat', percent: 50 },
        }),
      ).success,
    ).toBe(false);
  });
});

describe('ModSlotSchema', () => {
  it('rejects unknown keys on strict slots', () => {
    expect(
      ModSlotSchema.safeParse({
        index: 0,
        type: 'general',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('accepts a valid slot', () => {
    expect(
      ModSlotSchema.safeParse({
        index: 0,
        type: 'general',
      }).success,
    ).toBe(true);
  });
});

describe('ModConfigSchema non-serializable', () => {
  it('rejects circular references via size refinement', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const payload = minimalModConfig();
    (payload as { note?: unknown }).note = circular;
    expect(ModConfigSchema.safeParse(payload).success).toBe(false);
  });

  it('adds custom issue code for oversize payloads', () => {
    const result = ModConfigSchema.safeParse(
      minimalModConfig({ note: '😀'.repeat(Math.floor(MAX_MOD_CONFIG_JSON_BYTES / 2)) }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === z.ZodIssueCode.custom)).toBe(true);
    }
  });
});
