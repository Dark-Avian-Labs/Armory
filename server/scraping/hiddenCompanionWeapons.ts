import { getDb } from '../db/connection.js';

const OVERFRAME_BASE_URL = 'https://overframe.gg';

const HIDDEN_BEAST_CLAW_BUILD_PAGES = [
  '/build/new/7150/sly-claws/',
  '/build/new/7151/chesa-claws/',
  '/build/new/7152/helminth-claws/',
  '/build/new/7153/vasca-claws/',
  '/build/new/7154/sunika-claws/',
  '/build/new/7156/adarza-claws/',
  '/build/new/7157/huras-claws/',
  '/build/new/7158/crescent-claws/',
  '/build/new/7160/smeeta-claws/',
  '/build/new/7161/pharaoh-claws/',
  '/build/new/7162/medjay-claws/',
  '/build/new/7163/vizier-claws/',
  '/build/new/7164/raksa-claws/',
  '/build/new/7165/panzer-claws/',
  '/build/new/7166/sahasa-claws/',
  '/build/new/7167/kubrow-claws/',
  '/build/new/7168/claws/',
  '/build/new/7169/venari-claws/',
  '/build/new/7170/kavat-claws/',
  '/build/new/7171/venari-prime-claws/',
];

interface OverframeWeaponData {
  name: string;
  uniqueName: string;
  iconPath?: string;
  artifactSlots?: string[];
  behaviors?: Record<string, unknown>[];
  criticalChance?: number;
  criticalMultiplier?: number;
  procChance?: number;
  totalDamage?: number;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function sumDamageFromBehavior(
  behavior: Record<string, unknown>,
): number | null {
  const impact = behavior['impact:WeaponImpactBehavior'] as
    | Record<string, unknown>
    | undefined;
  const attackData = impact?.AttackData as Record<string, unknown> | undefined;
  const amount = toNumber(attackData?.Amount);
  return amount;
}

function extractWeaponDataFromNextData(
  nextData: unknown,
): OverframeWeaponData | null {
  if (!nextData || typeof nextData !== 'object') return null;
  const root = nextData as Record<string, unknown>;
  const item = (
    (root.props as Record<string, unknown> | undefined)?.pageProps as
      | Record<string, unknown>
      | undefined
  )?.item;
  if (!item || typeof item !== 'object') return null;

  const itemRecord = item as Record<string, unknown>;
  const data = itemRecord.data as Record<string, unknown> | undefined;

  const name = String(itemRecord.name ?? '').trim();
  const uniqueName = String(itemRecord.path ?? '').trim();
  if (!name || !uniqueName) return null;

  const productCategory = String(data?.ProductCategory ?? '');
  if (productCategory !== 'SentinelWeapons') return null;

  const behaviorsRaw = Array.isArray(data?.Behaviors)
    ? (data?.Behaviors as unknown[])
    : [];
  const behaviors = behaviorsRaw.filter(
    (value): value is Record<string, unknown> =>
      !!value && typeof value === 'object' && !Array.isArray(value),
  );
  if (behaviors.length === 0) return null;

  const firstBehavior = behaviors[0];
  const impact = firstBehavior['impact:WeaponImpactBehavior'] as
    | Record<string, unknown>
    | undefined;

  const totalDamage = sumDamageFromBehavior(firstBehavior);

  const artifactSlots = Array.isArray(data?.ArtifactSlots)
    ? (data?.ArtifactSlots as unknown[]).filter(
        (slot): slot is string => typeof slot === 'string',
      )
    : undefined;

  const iconPath = typeof data?.Icon === 'string' ? data.Icon : undefined;

  return {
    name,
    uniqueName,
    iconPath,
    artifactSlots,
    behaviors,
    criticalChance: toNumber(impact?.criticalHitChance) ?? undefined,
    criticalMultiplier:
      toNumber(impact?.criticalHitDamageMultiplier) ?? undefined,
    procChance:
      toNumber((impact?.AttackData as Record<string, unknown>)?.ProcChance) ??
      undefined,
    totalDamage: totalDamage ?? undefined,
  };
}

async function fetchOverframeNextData(
  relativeUrl: string,
): Promise<OverframeWeaponData | null> {
  const url = `${OVERFRAME_BASE_URL}${relativeUrl}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;

      const html = await response.text();
      const marker = '<script id="__NEXT_DATA__" type="application/json">';
      const markerStart = html.indexOf(marker);
      if (markerStart < 0) return null;
      const scriptEnd = html.indexOf('</script>', markerStart);
      if (scriptEnd < 0) return null;

      const json = html.slice(markerStart + marker.length, scriptEnd);
      const parsed = JSON.parse(json) as unknown;
      return extractWeaponDataFromNextData(parsed);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Ignore
    return null;
  }
}

export async function syncHiddenCompanionWeaponsFromOverframe(
  onProgress?: (msg: string) => void,
): Promise<{ insertedOrUpdated: number; found: number }> {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO weapons (
      unique_name,
      name,
      product_category,
      slot,
      mastery_req,
      total_damage,
      critical_chance,
      critical_multiplier,
      proc_chance,
      sentinel,
      image_path,
      artifact_slots,
      fire_behaviors
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_name) DO UPDATE SET
      name = excluded.name,
      product_category = excluded.product_category,
      slot = excluded.slot,
      total_damage = excluded.total_damage,
      critical_chance = excluded.critical_chance,
      critical_multiplier = excluded.critical_multiplier,
      proc_chance = excluded.proc_chance,
      sentinel = excluded.sentinel,
      image_path = COALESCE(weapons.image_path, excluded.image_path),
      artifact_slots = COALESCE(excluded.artifact_slots, weapons.artifact_slots),
      fire_behaviors = COALESCE(excluded.fire_behaviors, weapons.fire_behaviors)
  `);

  let found = 0;
  let insertedOrUpdated = 0;
  for (const page of HIDDEN_BEAST_CLAW_BUILD_PAGES) {
    onProgress?.(`Overframe hidden claw sync: fetching ${page}`);
    const weapon = await fetchOverframeNextData(page);
    if (!weapon) continue;
    found += 1;

    const result = upsert.run(
      weapon.uniqueName,
      weapon.name,
      'SentinelWeapons',
      5,
      0,
      weapon.totalDamage ?? null,
      weapon.criticalChance ?? null,
      weapon.criticalMultiplier ?? null,
      weapon.procChance ?? null,
      1,
      weapon.iconPath ?? null,
      weapon.artifactSlots ? JSON.stringify(weapon.artifactSlots) : null,
      weapon.behaviors ? JSON.stringify(weapon.behaviors) : null,
    );
    if (result.changes > 0) insertedOrUpdated += result.changes;
  }

  onProgress?.(
    `Overframe hidden claw sync complete: ${found} found, ${insertedOrUpdated} rows changed`,
  );
  return { insertedOrUpdated, found };
}
