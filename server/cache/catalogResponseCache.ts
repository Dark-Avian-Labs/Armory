import { createHash } from 'node:crypto';

import type { Request, Response } from 'express';

type CatalogResponseEntry = {
  payload: string;
  etag: string;
  expiresAt: number;
};

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 256;
const CACHE_CONTROL = 'public, max-age=300';

const cache = new Map<string, CatalogResponseEntry>();

function evictExcessEntries(): void {
  if (cache.size <= MAX_ENTRIES) return;
  const sorted = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const removeCount = cache.size - MAX_ENTRIES;
  for (let i = 0; i < removeCount; i++) {
    cache.delete(sorted[i]![0]);
  }
}

export function bustCatalogResponseCache(): void {
  cache.clear();
}

export function sendCachedCatalogJson(
  req: Request,
  res: Response,
  key: string,
  loader: () => unknown,
): void {
  const now = Date.now();
  let entry = cache.get(key);
  if (!entry || entry.expiresAt <= now) {
    const payload = JSON.stringify(loader());
    const hash = createHash('sha1').update(payload).digest('base64url').slice(0, 20);
    entry = {
      payload,
      etag: `W/"${hash}"`,
      expiresAt: now + TTL_MS,
    };
    cache.set(key, entry);
    evictExcessEntries();
  }

  res.setHeader('ETag', entry.etag);
  res.setHeader('Cache-Control', CACHE_CONTROL);
  if (req.headers['if-none-match'] === entry.etag) {
    res.status(304).end();
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(entry.payload);
}

export const __catalogResponseCacheTest = {
  TTL_MS,
  MAX_ENTRIES,
  size: () => cache.size,
  bust: bustCatalogResponseCache,
};
