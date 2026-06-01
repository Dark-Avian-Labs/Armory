import { abilityPathBasename } from './helminthAbilityResolve.js';

const ARMORY_ABILITY_PREFIX = '/Armory/Ability/';

export function abilitySlugFromDisplayName(name: string): string {
  return name
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function buildAbilityKey(slug: string): string {
  return `${ARMORY_ABILITY_PREFIX}${slug}`;
}

export function parseAbilityKey(key: string): string | null {
  if (!key.startsWith(ARMORY_ABILITY_PREFIX)) return null;
  const slug = key.slice(ARMORY_ABILITY_PREFIX.length);
  return slug.length > 0 ? slug : null;
}

export function abilitySlugFromDePath(deUniqueName: string): string {
  const base = abilityPathBasename(deUniqueName);
  if (base.endsWith('Ability')) {
    const stem = base.slice(0, -'Ability'.length);
    if (stem.length > 0) {
      return stem.charAt(0).toUpperCase() + stem.slice(1);
    }
  }
  return base;
}

export function buildAbilityKeyFromDePath(deUniqueName: string, displayName?: string): string {
  const slug =
    displayName && displayName.trim().length > 0
      ? abilitySlugFromDisplayName(displayName)
      : abilitySlugFromDePath(deUniqueName);
  return buildAbilityKey(slug);
}
