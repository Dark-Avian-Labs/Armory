import type { EquipmentLookupRow } from './buildCatalogCategory';

export type EquipmentPolaritySource = EquipmentLookupRow & {
  artifact_slots?: string;
  polarities?: string;
  aura_polarity?: string;
  exilus_polarity?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedLookupPromise: Promise<Record<string, EquipmentPolaritySource>> | null = null;
let cachedAt = 0;

export function bustEquipmentLookupCache(): void {
  cachedLookupPromise = null;
  cachedAt = 0;
}

export function loadEquipmentLookup(): Promise<Record<string, EquipmentPolaritySource>> {
  const now = Date.now();
  if (cachedLookupPromise && now - cachedAt < CACHE_TTL_MS) {
    return cachedLookupPromise;
  }
  cachedAt = now;
  const promise = fetchEquipmentLookup().then((lookup) => {
    if (cachedLookupPromise === promise && Object.keys(lookup).length === 0) {
      cachedLookupPromise = null;
    }
    return lookup;
  });
  cachedLookupPromise = promise;
  return promise;
}

async function fetchEquipmentLookup(): Promise<Record<string, EquipmentPolaritySource>> {
  const { apiFetch } = await import('./api');

  const endpoints = [
    '/api/warframes',
    '/api/companions',
    '/api/weapons?type=LongGuns',
    '/api/weapons?type=Pistols',
    '/api/weapons?type=Melee',
    '/api/weapons?type=SpaceGuns',
    '/api/weapons?type=SpaceMelee',
    '/api/weapons?type=SentinelWeapons',
    '/api/weapons?type=SpecialItems',
  ];

  const responses = await Promise.all(
    endpoints.map(async (url) => {
      try {
        const response = await apiFetch(url);
        if (!response.ok) return [] as EquipmentPolaritySource[];
        const body = (await response.json()) as {
          items?: EquipmentPolaritySource[];
        };
        return Array.isArray(body.items) ? body.items : [];
      } catch {
        return [] as EquipmentPolaritySource[];
      }
    }),
  );

  const nextLookup: Record<string, EquipmentPolaritySource> = {};
  for (const items of responses) {
    for (const item of items) {
      if (!item || typeof item.unique_name !== 'string') continue;
      if (item.unique_name.length === 0) continue;
      if (!nextLookup[item.unique_name]) {
        nextLookup[item.unique_name] = item;
      }
    }
  }

  return nextLookup;
}
