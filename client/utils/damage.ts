import {
  DAMAGE_TYPES,
  PRIMARY_ELEMENTS,
  type DamageType,
  type ModSlot,
  type Weapon,
} from '../types/warframe';
import { calculateFinalDamage, type DamageEntry } from './elements';
import { aggregateAllMods, type StatEffects } from './modStatParser';

export function parseDamageArray(weapon: Weapon): number[] {
  const emptyDamageArray = Array.from({ length: 20 }, () => 0);
  if (!weapon.damage_per_shot) return emptyDamageArray;
  try {
    const arr = JSON.parse(weapon.damage_per_shot);
    if (Array.isArray(arr)) return arr;
    return emptyDamageArray;
  } catch {
    return emptyDamageArray;
  }
}

export function getInnateSecondaryElements(baseDamage: number[]): DamageEntry[] {
  const result: DamageEntry[] = [];
  const secondaryIndices = [7, 8, 9, 10, 11, 12];
  for (const idx of secondaryIndices) {
    if (baseDamage[idx] > 0) {
      result.push({
        type: DAMAGE_TYPES[idx],
        value: baseDamage[idx],
      });
    }
  }
  return result;
}

export function extractElementMods(slots: ModSlot[]): Array<{
  slotIndex: number;
  element: (typeof PRIMARY_ELEMENTS)[number];
  value: number;
}> {
  const result: Array<{
    slotIndex: number;
    element: (typeof PRIMARY_ELEMENTS)[number];
    value: number;
  }> = [];

  for (const slot of slots) {
    if (!slot.mod || slot.type !== 'general') continue;

    const modDesc = slot.mod.description;
    if (!modDesc) continue;

    try {
      const descriptions: string[] = JSON.parse(modDesc);
      if (!Array.isArray(descriptions) || descriptions.length === 0) continue;

      const currentRank = (slot as ModSlot & { currentRank?: number }).currentRank;
      const rankValue =
        typeof slot.rank === 'number'
          ? slot.rank
          : typeof currentRank === 'number'
            ? currentRank
            : descriptions.length - 1;
      const rankIndex = Math.min(Math.max(Math.trunc(rankValue), 0), descriptions.length - 1);
      const desc = descriptions[rankIndex];
      if (typeof desc !== 'string') continue;

      const lower = desc.toLowerCase();
      for (const element of PRIMARY_ELEMENTS) {
        const elementLower = element.toLowerCase();
        if (!lower.includes(`${elementLower} damage`) && !lower.includes(elementLower)) {
          continue;
        }

        const escapedElement = element.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const elementSpecificMatch =
          desc.match(new RegExp(`${escapedElement}\\s+damage[^\\d+\\-]*\\+?([\\d.]+)%`, 'i')) ??
          desc.match(
            new RegExp(`\\+?([\\d.]+)%\\s*(?:<[^>]+>\\s*)?${escapedElement}(?:\\s+damage)?`, 'i'),
          );

        const match = elementSpecificMatch ?? desc.match(/\+?([\d.]+)%/);
        const value = match ? parseFloat(match[1]) : 0;
        result.push({
          slotIndex: slot.index,
          element,
          value,
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[extractElementMods] Failed to parse mod description', {
          error: err,
          modDesc,
        });
      }
    }
  }

  return result;
}

export function calculateBuildDamage(
  weapon: Weapon,
  slots: ModSlot[],
  precomputedEffects?: StatEffects,
): {
  totalDamage: number;
  damageBreakdown: DamageEntry[];
  innateSecondary: DamageEntry[];
} {
  const baseDamage = parseDamageArray(weapon);
  const elementMods = extractElementMods(slots);
  const innateSecondary = getInnateSecondaryElements(baseDamage);

  const effects = precomputedEffects ?? aggregateAllMods(slots);

  const damageMultipliers: Partial<Record<DamageType, number>> = {};
  for (const dt of DAMAGE_TYPES) {
    let mult = effects.baseDamage;
    if (dt === 'Impact') mult += effects.impactDamage;
    else if (dt === 'Puncture') mult += effects.punctureDamage;
    else if (dt === 'Slash') mult += effects.slashDamage;
    if (mult !== 0) damageMultipliers[dt] = mult;
  }

  const damageBreakdown = calculateFinalDamage(baseDamage, elementMods, damageMultipliers);

  for (const innate of innateSecondary) {
    const existing = damageBreakdown.find((d) => d.type === innate.type);
    if (existing) {
      existing.value += innate.value * (1 + effects.baseDamage);
    } else {
      damageBreakdown.push({
        type: innate.type,
        value: innate.value * (1 + effects.baseDamage),
      });
    }
  }

  const totalDamage = damageBreakdown.reduce((sum, d) => sum + d.value, 0);

  return {
    totalDamage: Math.round(totalDamage * 10) / 10,
    damageBreakdown,
    innateSecondary,
  };
}

export function formatDamage(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(1);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
