import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  MAX_MOD_CONFIG_JSON_BYTES,
  MAX_MOD_CONFIG_SLOTS,
  appendModConfigSizeIssues,
  modConfigExceedsSizeLimit,
} from './modConfigLimits.js';

type CapturedIssue = { code: string; message: string };

function createRefinementCtx(): { ctx: z.RefinementCtx; issues: CapturedIssue[] } {
  const issues: CapturedIssue[] = [];
  const ctx = {
    addIssue: (issue: { code: string; message?: string }) => {
      issues.push({
        code: issue.code,
        message: issue.message ?? '',
      });
    },
  } as z.RefinementCtx;
  return { ctx, issues };
}

describe('modConfigExceedsSizeLimit', () => {
  it('allows configs within the slot cap', () => {
    const slots = Array.from({ length: MAX_MOD_CONFIG_SLOTS }, (_, index) => ({
      index,
      type: 'general' as const,
    }));
    expect(
      modConfigExceedsSizeLimit({ slots, name: 'x', equipment_type: 'warframe', equipment_unique_name: '/x' }),
    ).toBe(false);
  });

  it('rejects configs above the serialized byte cap', () => {
    const huge = 'x'.repeat(MAX_MOD_CONFIG_JSON_BYTES + 1);
    expect(modConfigExceedsSizeLimit({ note: huge })).toBe(true);
  });

  it('measures UTF-8 byte length, not UTF-16 code units', () => {
    const repeats = Math.floor(MAX_MOD_CONFIG_JSON_BYTES / 4) + 1;
    const payload = { t: '😀'.repeat(repeats) };
    const serialized = JSON.stringify(payload);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeGreaterThan(MAX_MOD_CONFIG_JSON_BYTES);
    expect(serialized.length).toBeLessThan(MAX_MOD_CONFIG_JSON_BYTES);
    expect(modConfigExceedsSizeLimit(payload)).toBe(true);
  });

  it('rejects non-serializable configs', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(modConfigExceedsSizeLimit(circular)).toBe(true);
    expect(modConfigExceedsSizeLimit({ value: 1n })).toBe(true);
  });
});

describe('appendModConfigSizeIssues', () => {
  it('adds a custom issue when the payload exceeds the byte cap', () => {
    const { ctx, issues } = createRefinementCtx();
    const huge = 'x'.repeat(MAX_MOD_CONFIG_JSON_BYTES + 1);

    appendModConfigSizeIssues({ note: huge }, ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(z.ZodIssueCode.custom);
    expect(issues[0]?.message).toContain('bytes when serialized');
    expect(issues[0]?.message).toContain(String(MAX_MOD_CONFIG_JSON_BYTES));
  });

  it('does not add issues for payloads within the byte cap', () => {
    const { ctx, issues } = createRefinementCtx();

    appendModConfigSizeIssues({ note: 'small' }, ctx);

    expect(issues).toHaveLength(0);
  });

  it('adds an issue for non-serializable payloads', () => {
    const { ctx, issues } = createRefinementCtx();
    const circular: { self?: unknown } = {};
    circular.self = circular;

    appendModConfigSizeIssues(circular, ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(z.ZodIssueCode.custom);
    expect(issues[0]?.message).toContain('bytes when serialized');
  });

  it('adds an issue for multi-byte payloads over the cap', () => {
    const { ctx, issues } = createRefinementCtx();
    const repeats = Math.floor(MAX_MOD_CONFIG_JSON_BYTES / 4) + 1;
    const payload = { t: '😀'.repeat(repeats) };

    appendModConfigSizeIssues(payload, ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(z.ZodIssueCode.custom);
  });
});
