import { useEffect, useState } from 'react';

import type { Mod } from '../types/warframe';
import { apiFetch } from '../utils/api';

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = { promise: Promise<Mod[]>; at: number };

const catalogCache = new Map<string, CacheEntry>();

function loadModCatalog(url: string): Promise<Mod[]> {
  const now = Date.now();
  const cached = catalogCache.get(url);
  if (cached && now - cached.at < TTL_MS) {
    return cached.promise;
  }
  const promise = (async () => {
    const response = await apiFetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = (await response.json()) as { items?: Mod[] };
    return Array.isArray(body.items) ? body.items : [];
  })().catch((error: unknown) => {
    if (catalogCache.get(url)?.promise === promise) {
      catalogCache.delete(url);
    }
    throw error;
  });
  catalogCache.set(url, { promise, at: now });
  return promise;
}

interface ModCatalogState {
  data: { items: Mod[] } | null;
  loading: boolean;
  error: string | null;
}

export function useModCatalog(url: string | null): ModCatalogState {
  const [state, setState] = useState<ModCatalogState>(() => ({
    data: null,
    loading: Boolean(url),
    error: null,
  }));

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    let alive = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    loadModCatalog(url)
      .then((items) => {
        if (alive) {
          setState({ data: { items }, loading: false, error: null });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        if (alive) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load mods',
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return state;
}
