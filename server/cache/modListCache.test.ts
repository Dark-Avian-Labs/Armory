import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __modListCacheTest, getCachedModList } from './modListCache.js';

describe('modListCache', () => {
  beforeEach(() => {
    __modListCacheTest.stopModListCacheCleanup();
    __modListCacheTest.bust();
    __modListCacheTest.startCacheCleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    __modListCacheTest.stopModListCacheCleanup();
    __modListCacheTest.bust();
    vi.useRealTimers();
  });

  it('returns cached items until TTL expires', async () => {
    let loads = 0;
    const loader = () => {
      loads += 1;
      return [{ id: loads }];
    };

    await expect(getCachedModList('a', loader)).resolves.toEqual([{ id: 1 }]);
    await expect(getCachedModList('a', loader)).resolves.toEqual([{ id: 1 }]);
    expect(loads).toBe(1);

    vi.advanceTimersByTime(__modListCacheTest.TTL_MS + 1);
    __modListCacheTest.runCacheCleanup();

    await expect(getCachedModList('a', loader)).resolves.toEqual([{ id: 2 }]);
    expect(loads).toBe(2);
  });

  it('prunes expired entries on periodic cleanup', async () => {
    await getCachedModList('stale', () => [{ id: 1 }]);
    expect(__modListCacheTest.size()).toBe(1);

    vi.advanceTimersByTime(__modListCacheTest.TTL_MS + 1);
    __modListCacheTest.runCacheCleanup();

    expect(__modListCacheTest.size()).toBe(0);
  });

  it('evicts oldest entries when max size is exceeded', async () => {
    const max = __modListCacheTest.MAX_ENTRIES;
    for (let i = 0; i < max + 5; i++) {
      await getCachedModList(`key-${i}`, () => [{ id: i }]);
    }
    expect(__modListCacheTest.size()).toBeLessThanOrEqual(max);
  });

  it('deduplicates concurrent loads for the same key', async () => {
    let loads = 0;
    let resolveLoad: (items: Array<Record<string, unknown>>) => void = () => undefined;
    const loader = () =>
      new Promise<Array<Record<string, unknown>>>((resolve) => {
        loads += 1;
        resolveLoad = resolve;
      });

    const first = getCachedModList('concurrent', loader);
    const second = getCachedModList('concurrent', loader);
    const third = getCachedModList('concurrent', loader);

    await Promise.resolve();
    expect(loads).toBe(1);
    resolveLoad([{ id: 1 }]);

    const results = await Promise.all([first, second, third]);
    expect(results).toEqual([[{ id: 1 }], [{ id: 1 }], [{ id: 1 }]]);
  });
});
