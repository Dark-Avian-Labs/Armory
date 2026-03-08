export type ArcaneCompatTag =
  | 'warframe'
  | 'primary'
  | 'secondary'
  | 'melee'
  | 'weapon'
  | 'kitgun'
  | 'zaw'
  | 'operator'
  | 'amp';

export function classifyArcaneCompatTags(
  uniqueNameRaw: unknown,
  nameRaw: unknown,
): ArcaneCompatTag[] {
  const uniqueName = String(uniqueNameRaw ?? '').toLowerCase();
  const name = String(nameRaw ?? '').toLowerCase();
  const tags = new Set<ArcaneCompatTag>();

  if (uniqueName.includes('/operatoramps/') || name.startsWith('virtuos ')) {
    tags.add('amp');
  }
  if (uniqueName.includes('/operatorarmour/') || name.startsWith('magus ')) {
    tags.add('operator');
  }
  if (name.startsWith('pax ')) {
    tags.add('kitgun');
    tags.add('secondary');
    tags.add('weapon');
  }
  if (name.startsWith('exodia ')) {
    tags.add('zaw');
    tags.add('melee');
    tags.add('weapon');
  }
  if (name.startsWith('primary ') || name.includes(' primary ')) {
    tags.add('primary');
    tags.add('weapon');
  }
  if (name.startsWith('secondary ') || name.includes(' secondary ')) {
    tags.add('secondary');
    tags.add('weapon');
  }
  if (name.startsWith('melee ') || name.includes(' melee ')) {
    tags.add('melee');
    tags.add('weapon');
  }
  if (
    name.startsWith('residual ') ||
    name.startsWith('theorem ') ||
    name.includes('merciless') ||
    name.includes('dexterity') ||
    name.includes('deadhead')
  ) {
    tags.add('weapon');
  }

  if (uniqueName.includes('/zariman/')) {
    if (name.includes('amp ')) tags.add('amp');
    if (name.includes('operator ')) tags.add('operator');
    if (name.includes('primary')) tags.add('primary');
    if (name.includes('secondary')) tags.add('secondary');
    if (name.includes('melee')) tags.add('melee');
  }

  if (
    !tags.has('amp') &&
    !tags.has('operator') &&
    !tags.has('kitgun') &&
    !tags.has('zaw') &&
    !tags.has('primary') &&
    !tags.has('secondary') &&
    !tags.has('melee')
  ) {
    tags.add('warframe');
  }

  if (
    tags.has('primary') ||
    tags.has('secondary') ||
    tags.has('melee') ||
    tags.has('kitgun') ||
    tags.has('zaw')
  ) {
    tags.add('weapon');
  }

  return Array.from(tags).sort();
}
