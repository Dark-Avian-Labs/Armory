type ModListCacheEntry = {
  expiresAt: number;
  items: Array<Record<string, unknown>>;
};

const TTL_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = TTL_MS;
const MAX_ENTRIES = 128;

const cache = new Map<string, ModListCacheEntry>();
const inFlight = new Map<string, Promise<Array<Record<string, unknown>>>>();

function pruneExpired(now = Date.now()): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function evictExcessEntries(): void {
  if (cache.size <= MAX_ENTRIES) return;
  const sorted = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const removeCount = cache.size - MAX_ENTRIES;
  for (let i = 0; i < removeCount; i++) {
    cache.delete(sorted[i]![0]);
  }
}

function runCacheCleanup(): void {
  pruneExpired();
  evictExcessEntries();
}

let cleanupTimer: ReturnType<typeof setInterval> | undefined;

function startCacheCleanup(): void {
  if (cleanupTimer) return;
  runCacheCleanup();
  cleanupTimer = setInterval(runCacheCleanup, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

export function stopModListCacheCleanup(): void {
  if (!cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = undefined;
}

startCacheCleanup();

export async function getCachedModList(
  key: string,
  loader: () => Array<Record<string, unknown>> | Promise<Array<Record<string, unknown>>>,
): Promise<Array<Record<string, unknown>>> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.items;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return await pending;
  }

  const loadPromise = Promise.resolve()
    .then(() => loader())
    .then((items) => {
      cache.set(key, { items, expiresAt: Date.now() + TTL_MS });
      evictExcessEntries();
      return items;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, loadPromise);
  return await loadPromise;
}

export function bustModListCache(): void {
  cache.clear();
  inFlight.clear();
}

export const __modListCacheTest = {
  TTL_MS,
  MAX_ENTRIES,
  size: () => cache.size,
  runCacheCleanup,
  stopModListCacheCleanup,
  startCacheCleanup,
  bust: bustModListCache,
};
