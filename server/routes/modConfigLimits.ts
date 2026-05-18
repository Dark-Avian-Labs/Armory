import { z } from 'zod';

export const MAX_MOD_CONFIG_SLOTS = 14;
export const MAX_ARCANE_SLOTS = 2;
export const MAX_SHARD_SLOTS = 5;
export const MAX_MOD_CONFIG_JSON_BYTES = 512 * 1024;

export function modConfigExceedsSizeLimit(data: unknown): boolean {
  try {
    const serialized = JSON.stringify(data);
    return Buffer.byteLength(serialized, 'utf8') > MAX_MOD_CONFIG_JSON_BYTES;
  } catch {
    return true;
  }
}

export function appendModConfigSizeIssues(data: unknown, ctx: z.RefinementCtx): void {
  if (modConfigExceedsSizeLimit(data)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `mod_config must be at most ${MAX_MOD_CONFIG_JSON_BYTES} bytes when serialized`,
    });
  }
}
