export function stripArchwingTag(value: string): string {
  return value.replace(/^<[^>]+>\s*/i, '');
}

export function stripKnownModeQualifier(value: string): string {
  return value.replace(
    /\s*\((primary|secondary|dual(?:\s+\w+)?|heavy(?:\s+\w+)?|archgun|archmelee|rifle|shotgun|sniper|bow|pistol|sword|blade|scythe|staff|hammer|nikana|tonfa|whip|glaive)\)\s*$/i,
    '',
  );
}

export function stripPrimeSuffix(value: string): string {
  return value.replace(/\s+prime$/i, '');
}

export function normalizeDisplayName(value: string): string {
  const normalized = value.normalize('NFKC').trim();
  const withoutArchwingTag = stripArchwingTag(normalized);
  const withoutQualifier = stripKnownModeQualifier(withoutArchwingTag);
  return withoutQualifier.trim();
}

export function normalizeNameForKey(value: string): string {
  return normalizeDisplayName(value).toLowerCase();
}

export const MATCH_NAME_ALIASES = new Map<string, string>([
  ['pangolin', 'pangolin sword'],
  ['prime laser rifle', 'laser rifle'],
  ['venari prime claws', 'venari claws'],
  ['venani prime claws', 'venari claws'],
]);

export function resolveCanonicalKey(value: string): string {
  const key = stripPrimeSuffix(normalizeNameForKey(value));
  return MATCH_NAME_ALIASES.get(key) ?? key;
}
