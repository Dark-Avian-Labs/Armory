/** Slot turned off in admin; mod builder omits this slot entirely. */
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

/** Whether the mod builder should render a slot backed by artifact data. */
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

/** Second aura exists in data and is not admin-disabled. */
export function isWarframeSecondAuraSlotActive(artifactSlots: string[], generalSlots = 8): boolean {
  if (!warframeUsesExtendedArtifactLayout(artifactSlots)) return false;
  const ap = artifactSlots[warframeSecondAuraArtifactIndex(generalSlots)];
  return ap != null && !isArtifactSlotDisabled(ap);
}
