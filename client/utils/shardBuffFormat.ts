/** Matches paired base/(tau) values in shard buff descriptions from the database. */
const SHARD_BUFF_BASE_TAU_PATTERN =
  /([+-]?\d+\.?\d*%?)\s*\(([+-]?\d+\.?\d*%?)\)/g;

/**
 * Formats shard buff descriptions that contain paired base/tau values.
 *
 * Expected format for each pair is, for example: "15% (20%)" or "10 (15)".
 * The first captured value is the base, the second is the tau value.
 */
export function formatShardBuffDescription(
  buff: { description: string } | undefined,
  tauforged: boolean,
): string {
  if (!buff) return '';

  // If the description does not contain any base/tau pairs in the expected format,
  // return it unchanged to avoid applying an unintended transformation.
  if (!SHARD_BUFF_BASE_TAU_PATTERN.test(buff.description)) {
    // Reset lastIndex because SHARD_BUFF_BASE_TAU_PATTERN is global and test() advances it.
    SHARD_BUFF_BASE_TAU_PATTERN.lastIndex = 0;
    return buff.description;
  }

  // Reset lastIndex before using the global regex with replace().
  SHARD_BUFF_BASE_TAU_PATTERN.lastIndex = 0;
  return buff.description.replace(
    SHARD_BUFF_BASE_TAU_PATTERN,
    (_, base, tau) => (tauforged ? tau : base),
  );
}
