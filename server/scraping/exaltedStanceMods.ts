import { getDb } from '../db/connection.js';

const OVERFRAME_BASE_URL = 'https://overframe.gg';

interface ExaltedStanceSeed {
  id: number;
  slug: string;
  name: string;
  compatName: string;
  rarity: 'COMMON' | 'RARE';
  description: string;
}

const EXALTED_STANCE_SEEDS: ExaltedStanceSeed[] = [
  {
    id: 7447,
    slug: 'hysteria',
    name: 'Hysteria',
    compatName: 'Valkyr Talons',
    rarity: 'COMMON',
    description:
      'Stance: Valkyr is imbued with energy and becomes a ball of vicious rage, capable of unleashing a torrent of deadly claw attacks on unsuspecting foes.',
  },
  {
    id: 7444,
    slug: 'serene-storm',
    name: 'Serene Storm',
    compatName: 'Desert Wind',
    rarity: 'COMMON',
    description:
      'Stance: With his Restraint eroded, Baruuk commands the Desert Wind to deliver powerful radial strikes with his fists and feet. Each moment commanding the storm restores his Restraint.',
  },
  {
    id: 7440,
    slug: 'exalted-blade',
    name: 'Exalted Blade',
    compatName: 'Exalted Blade',
    rarity: 'COMMON',
    description: 'Stance: Summon a sword of pure light and immense power.',
  },
  {
    id: 7450,
    slug: 'ravenous-wraith',
    name: 'Ravenous Wraith',
    compatName: 'Shadow Claws',
    rarity: 'COMMON',
    description:
      "Stance: When the Death Well fills, Sevagoth's Shadow form is ready to be released. Tear the enemy asunder with a collection of melee-focused abilities.",
  },
  {
    id: 7441,
    slug: 'primal-fury',
    name: 'Primal Fury',
    compatName: 'Iron Staff',
    rarity: 'RARE',
    description: 'Stance: Summon the iron staff and unleash fury.',
  },
];

interface OverframeStanceData {
  uniqueName: string;
  name: string;
  imagePath: string | null;
}

function extractOverframeStanceData(
  nextData: unknown,
): OverframeStanceData | null {
  if (!nextData || typeof nextData !== 'object') return null;
  const root = nextData as Record<string, unknown>;
  const item = (
    (root.props as Record<string, unknown> | undefined)?.pageProps as
      | Record<string, unknown>
      | undefined
  )?.item as Record<string, unknown> | undefined;
  if (!item || typeof item !== 'object') return null;

  const uniqueName = String(item.path ?? '').trim();
  const name = String(item.name ?? '').trim();
  const imagePathRaw = item.texture_new ?? item.texture;
  const imagePath =
    typeof imagePathRaw === 'string' && imagePathRaw.trim().length > 0
      ? imagePathRaw.trim()
      : null;

  if (!uniqueName || !name) return null;
  return { uniqueName, name, imagePath };
}

async function fetchOverframeStance(
  seed: ExaltedStanceSeed,
): Promise<OverframeStanceData | null> {
  const url = `${OVERFRAME_BASE_URL}/items/arsenal/${seed.id}/${seed.slug}/`;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        return extractOverframeStanceData(parsed);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.warn(
        `[exaltedStanceMods] fetch attempt ${attempt}/${maxAttempts} failed for ${seed.id}/${seed.slug}:`,
        error,
      );
      if (attempt < maxAttempts) {
        const backoffMs = attempt * 400;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }
  return null;
}

export async function syncExaltedStanceModsFromOverframe(
  onProgress?: (msg: string) => void,
): Promise<{ found: number; insertedOrUpdated: number }> {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO mods (
      unique_name,
      name,
      polarity,
      rarity,
      type,
      compat_name,
      base_drain,
      fusion_limit,
      is_utility,
      is_augment,
      subtype,
      description,
      image_path,
      codex_secret,
      exclude_from_codex
    )
    VALUES (
      :unique_name,
      :name,
      :polarity,
      :rarity,
      :type,
      :compat_name,
      :base_drain,
      :fusion_limit,
      :is_utility,
      :is_augment,
      :subtype,
      :description,
      :image_path,
      :codex_secret,
      :exclude_from_codex
    )
    ON CONFLICT(unique_name) DO UPDATE SET
      name = excluded.name,
      polarity = excluded.polarity,
      rarity = excluded.rarity,
      type = excluded.type,
      compat_name = excluded.compat_name,
      base_drain = excluded.base_drain,
      fusion_limit = excluded.fusion_limit,
      is_utility = excluded.is_utility,
      is_augment = excluded.is_augment,
      subtype = excluded.subtype,
      description = excluded.description,
      image_path = COALESCE(excluded.image_path, mods.image_path),
      codex_secret = excluded.codex_secret,
      exclude_from_codex = excluded.exclude_from_codex
  `);

  let found = 0;
  let insertedOrUpdated = 0;

  for (const seed of EXALTED_STANCE_SEEDS) {
    onProgress?.(
      `Overframe exalted stance sync: fetching ${seed.name} (${seed.id})`,
    );
    const scraped = await fetchOverframeStance(seed);
    if (!scraped) continue;

    found += 1;
    const result = upsert.run({
      unique_name: scraped.uniqueName,
      name: seed.name,
      polarity: 'AP_TACTIC',
      rarity: seed.rarity,
      type: 'STANCE',
      compat_name: seed.compatName,
      base_drain: -2,
      fusion_limit: 3,
      is_utility: 0,
      is_augment: 0,
      subtype: null,
      description: JSON.stringify([seed.description]),
      image_path: scraped.imagePath,
      codex_secret: 0,
      exclude_from_codex: 0,
    });
    if (result.changes > 0) {
      insertedOrUpdated += result.changes;
    }
  }

  onProgress?.(
    `Overframe exalted stance sync complete: ${found} found, ${insertedOrUpdated} rows changed`,
  );
  return { found, insertedOrUpdated };
}
