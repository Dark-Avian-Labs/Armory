import type { IncarnonData, IncarnonSelection, IncarnonStatModifier } from '../types/incarnon';
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

function applyModifier(stats: IncarnonAdjustedWeaponStats, modifier: IncarnonStatModifier): void {
  const keyMap: Record<IncarnonStatModifier['stat'], keyof IncarnonAdjustedWeaponStats | null> = {
    baseDamage: 'totalDamage',
    critChance: 'criticalChance',
    statusChance: 'procChance',
    fireRate: 'fireRate',
    multishot: 'multishot',
    magazineSize: 'magazineSize',
    reloadSpeed: 'reloadTime',
    projectileSpeed: null,
    punchThrough: null,
    accuracy: null,
  };

  const key = keyMap[modifier.stat];
  if (!key) return;

  const current = stats[key] ?? 0;
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

export function parseIncarnonData(raw: unknown): IncarnonData | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as IncarnonData;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as IncarnonData;
  } catch {
    return null;
  }
}

export function weaponHasIncarnon(weapon: { has_incarnon?: number | boolean }): boolean {
  return weapon.has_incarnon === 1 || weapon.has_incarnon === true;
}
