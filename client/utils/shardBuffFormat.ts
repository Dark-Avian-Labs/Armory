const SHARD_BUFF_BASE_TAU_PATTERN = /([+-]?\d+\.?\d*%?)\s*\(([+-]?\d+\.?\d*%?)\)/g;

export function formatShardBuffDescription(
  buff: { description: string } | undefined,
  tauforged: boolean,
): string {
  if (!buff) return '';

  if (!SHARD_BUFF_BASE_TAU_PATTERN.test(buff.description)) {
    SHARD_BUFF_BASE_TAU_PATTERN.lastIndex = 0;
    return buff.description;
  }

  SHARD_BUFF_BASE_TAU_PATTERN.lastIndex = 0;
  return buff.description.replace(SHARD_BUFF_BASE_TAU_PATTERN, (_, base, tau) =>
    tauforged ? tau : base,
  );
}
