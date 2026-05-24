import type { IncarnonData, IncarnonSelection } from '../types/incarnon';

export function createDefaultIncarnonSelections(data: IncarnonData): IncarnonSelection[] {
  return data.evolutions.map((tier) => ({
    tier: tier.tier,
    unlocked: true,
    perkName: tier.options[0]?.name ?? null,
  }));
}

export function applyIncarnonUnlockCascade(
  selections: IncarnonSelection[],
  disabledTier: number,
): IncarnonSelection[] {
  return selections.map((entry) => {
    if (entry.tier >= disabledTier) {
      return { ...entry, unlocked: false, perkName: null };
    }
    return entry;
  });
}

export function selectIncarnonPerk(
  selections: IncarnonSelection[],
  tier: number,
  perkName: string,
): IncarnonSelection[] {
  return selections.map((entry) =>
    entry.tier === tier ? { ...entry, unlocked: true, perkName } : entry,
  );
}

export function getSelectionForTier(
  selections: IncarnonSelection[] | undefined,
  tier: number,
): IncarnonSelection | undefined {
  return selections?.find((entry) => entry.tier === tier);
}

export function getSelectedPerk(
  data: IncarnonData | null | undefined,
  selections: IncarnonSelection[] | undefined,
  tier: number,
) {
  const selection = getSelectionForTier(selections, tier);
  if (!selection?.unlocked || !selection.perkName || !data) return null;
  const evolution = data.evolutions.find((e) => e.tier === tier);
  return evolution?.options.find((o) => o.name === selection.perkName) ?? null;
}
