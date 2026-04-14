export const APP_PATHS = {
  home: '/builder/builds',
  buildsExplore: '/builder/builds',
  myBuilds: '/builder/my-builds',
  buildNew: '/builder/new/:equipmentType/:equipmentId',
  buildEdit: '/builder/:buildId',
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

export function buildEquipmentBuildsListPath(
  equipmentType: string,
  equipmentUniqueName: string,
): string {
  return `/builder/builds/${encodeURIComponent(equipmentType)}/${encodeURIComponent(equipmentUniqueName)}`;
}
