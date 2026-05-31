export const AP_DISABLED = 'AP_DISABLED' as const;

export const ARTIFACT_SLOT_STORAGE_VALUES = new Set([
  'AP_UNIVERSAL',
  AP_DISABLED,
  'AP_ATTACK',
  'AP_DEFENSE',
  'AP_TACTIC',
  'AP_WARD',
  'AP_POWER',
  'AP_PRECEPT',
  'AP_UMBRA',
  'AP_ANY',
]);

export function isArtifactSlotDisabled(ap: string | undefined): boolean {
  return ap === AP_DISABLED;
}

export function isArtifactSlotVisible(
  artifactSlots: string[],
  index: number,
  hasArtifactSlots: boolean,
): boolean {
  if (!hasArtifactSlots) return true;
  if (index >= artifactSlots.length) return false;
  return !isArtifactSlotDisabled(artifactSlots[index]);
}

export function warframeUsesExtendedArtifactLayout(artifactSlots: string[]): boolean {
  return artifactSlots.length >= 11;
}

export function warframeSecondAuraArtifactIndex(generalSlots = 8): number {
  return generalSlots + 1;
}

export function warframeExilusArtifactIndex(artifactSlots: string[], generalSlots = 8): number {
  return warframeUsesExtendedArtifactLayout(artifactSlots) ? generalSlots + 2 : generalSlots + 1;
}

export function isWarframeSecondAuraConfigured(artifactSlots: string[], generalSlots = 8): boolean {
  if (!warframeUsesExtendedArtifactLayout(artifactSlots)) return false;
  const ap = artifactSlots[warframeSecondAuraArtifactIndex(generalSlots)];
  if (ap == null || isArtifactSlotDisabled(ap) || ap === 'AP_UNIVERSAL') return false;
  return true;
}

export function isWarframeSecondAuraSlotActive(artifactSlots: string[], generalSlots = 8): boolean {
  if (!warframeUsesExtendedArtifactLayout(artifactSlots)) return false;
  const ap = artifactSlots[warframeSecondAuraArtifactIndex(generalSlots)];
  return ap != null && !isArtifactSlotDisabled(ap);
}

export function warframeArtifactWriteIndex(
  rowId: string,
  artifactIndex: number,
  extendedLayout: boolean,
  generalSlots = 8,
): number {
  if (rowId === 'aura-2') return warframeSecondAuraArtifactIndex(generalSlots);
  if (rowId === 'exilus') return extendedLayout ? generalSlots + 2 : generalSlots + 1;
  return artifactIndex;
}

export const WARFRAME_COMPACT_ARTIFACT_SLOT_COUNT = 10;
export const WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT = 11;
