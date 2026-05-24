import type {
  IncarnonData,
  IncarnonEvolutionTier,
  IncarnonPerkOption,
  IncarnonSelection,
  IncarnonStatModifier,
} from '../types/incarnon';
import { getSelectedPerk } from './incarnonSelections';

export interface IncarnonAdjustedWeaponStats {
  totalDamage?: number;
  criticalChance?: number;
  procChance?: number;
  fireRate?: number;
  multishot?: number;
  magazineSize?: number;
  reloadTime?: number;
}

const INCARNON_STAT_LIST: readonly IncarnonStatModifier['stat'][] = [
  'baseDamage',
  'critChance',
  'statusChance',
  'fireRate',
  'multishot',
  'magazineSize',
  'reloadSpeed',
  'projectileSpeed',
  'punchThrough',
  'accuracy',
];

const INCARNON_STAT_WEAPON_KEY_BY_NAME: Partial<
  Record<IncarnonStatModifier['stat'], keyof IncarnonAdjustedWeaponStats>
> = {
  baseDamage: 'totalDamage',
  critChance: 'criticalChance',
  statusChance: 'procChance',
  fireRate: 'fireRate',
  multishot: 'multishot',
  magazineSize: 'magazineSize',
  reloadSpeed: 'reloadTime',
};

const INCARNON_STAT_NAMES = new Set(INCARNON_STAT_LIST);

const INCARNON_STAT_KEY_MAP = Object.fromEntries(
  INCARNON_STAT_LIST.map((stat) => [stat, INCARNON_STAT_WEAPON_KEY_BY_NAME[stat] ?? null]),
) as Record<IncarnonStatModifier['stat'], keyof IncarnonAdjustedWeaponStats | null>;

function applyModifier(stats: IncarnonAdjustedWeaponStats, modifier: IncarnonStatModifier): void {
  const key = INCARNON_STAT_KEY_MAP[modifier.stat];
  if (!key) return;

  const current = stats[key];
  if (current === undefined) return;

  if (modifier.mode === 'flat') {
    stats[key] = current + modifier.value;
    return;
  }

  if (key === 'reloadTime') {
    stats[key] = current / (1 + modifier.value);
    return;
  }

  stats[key] = current * (1 + modifier.value);
}

export function applyIncarnonStatBonuses(
  base: IncarnonAdjustedWeaponStats,
  data: IncarnonData | null | undefined,
  selections: IncarnonSelection[] | undefined,
  enabled: boolean,
): IncarnonAdjustedWeaponStats {
  if (!enabled || !data || !selections) {
    return { ...base };
  }

  const adjusted: IncarnonAdjustedWeaponStats = { ...base };

  for (const tier of data.evolutions) {
    const selection = selections.find((s) => s.tier === tier.tier);
    if (!selection?.unlocked) continue;

    const perk = getSelectedPerk(data, selections, tier.tier);
    if (!perk?.statModifiers) continue;

    for (const modifier of perk.statModifiers) {
      applyModifier(adjusted, modifier);
    }
  }

  return adjusted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIncarnonStatModifier(value: unknown): value is IncarnonStatModifier {
  if (!isRecord(value)) return false;
  return (
    typeof value.stat === 'string' &&
    INCARNON_STAT_NAMES.has(value.stat as IncarnonStatModifier['stat']) &&
    (value.mode === 'flat' || value.mode === 'percent') &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value)
  );
}

function isIncarnonPerkOption(value: unknown): value is IncarnonPerkOption {
  if (!isRecord(value)) return false;
  if (typeof value.name !== 'string' || typeof value.description !== 'string') return false;
  if (value.notes !== undefined && typeof value.notes !== 'string') return false;
  if (value.imagePath !== undefined && typeof value.imagePath !== 'string') return false;
  if (value.statModifiers !== undefined) {
    if (!Array.isArray(value.statModifiers) || !value.statModifiers.every(isIncarnonStatModifier)) {
      return false;
    }
  }
  return true;
}

function isIncarnonEvolutionTier(value: unknown): value is IncarnonEvolutionTier {
  if (!isRecord(value)) return false;
  if (typeof value.tier !== 'number' || !Number.isFinite(value.tier)) return false;
  if (value.challenge !== undefined && typeof value.challenge !== 'string') return false;
  if (!Array.isArray(value.options) || value.options.length === 0) return false;
  return value.options.every(isIncarnonPerkOption);
}

export function isIncarnonData(value: unknown): value is IncarnonData {
  if (!isRecord(value)) return false;
  if (value.source !== 'genesis' && value.source !== 'intrinsic') return false;
  if (typeof value.wikiSlug !== 'string' || value.wikiSlug.length === 0) return false;
  if (value.genesisUniqueName !== undefined && typeof value.genesisUniqueName !== 'string') {
    return false;
  }
  if (value.overview !== undefined && typeof value.overview !== 'string') return false;
  if (!Array.isArray(value.evolutions) || value.evolutions.length === 0) return false;
  return value.evolutions.every(isIncarnonEvolutionTier);
}

export function parseIncarnonData(raw: unknown): IncarnonData | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    try {
      return parseIncarnonData(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  return isIncarnonData(raw) ? raw : null;
}

export function weaponHasIncarnon(weapon: { has_incarnon?: number | boolean }): boolean {
  return weapon.has_incarnon === 1 || weapon.has_incarnon === true;
}
