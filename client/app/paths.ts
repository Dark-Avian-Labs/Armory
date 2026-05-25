export const APP_PATHS = {
  home: '/builder/builds',
  buildsExplore: '/builder/builds',
  myBuilds: '/builder/my-builds',
  favorites: '/builder/favorites',
  userBuilds: '/builder/users/:userSlug/builds',
  buildNew: '/builder/new/:equipmentType/:equipmentId',
  buildEdit: '/builder/:buildId',
  loadoutView: '/builder/loadouts/:loadoutId',
  admin: '/admin',
  login: '/login',
  legal: '/legal',
} as const;

export function buildNewPath(equipmentType: string, equipmentId: string): string {
  return `/builder/new/${encodeURIComponent(equipmentType)}/${encodeURIComponent(equipmentId)}`;
}

export function buildEditPath(buildId: string): string {
  return `/builder/${encodeURIComponent(buildId)}`;
}

export function buildReadOnlyPath(buildId: string): string {
  return `/builder/${encodeURIComponent(buildId)}?view=1`;
}

export function buildLoadoutPath(loadoutId: string): string {
  return `/builder/loadouts/${encodeURIComponent(loadoutId)}`;
}

export function userBuildsPath(userSlug: string): string {
  return `/builder/users/${encodeURIComponent(userSlug)}/builds`;
}

export function buildEquipmentBuildsListPath(
  equipmentType: string,
  equipmentUniqueName: string,
  equipmentName?: string,
): string {
  const base = `/builder/builds/${encodeURIComponent(equipmentType)}/${encodeURIComponent(equipmentUniqueName)}`;
  const trimmedName = equipmentName?.trim();
  if (!trimmedName) return base;
  return `${base}?name=${encodeURIComponent(trimmedName)}`;
}
