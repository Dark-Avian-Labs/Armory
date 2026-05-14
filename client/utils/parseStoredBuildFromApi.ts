import type { BuildConfig, BuildVisibility, StoredBuild } from '../types/warframe';

export function parseStoredBuildFromApi(row: Record<string, unknown>): StoredBuild | null {
  const id = String(row.id ?? '');
  if (!id) return null;
  const modConfig =
    row.mod_config && typeof row.mod_config === 'object'
      ? (row.mod_config as Partial<StoredBuild>)
      : ({} as Partial<StoredBuild>);

  const visRaw = row.visibility;
  const visibility: BuildVisibility | undefined =
    visRaw === 'public' || visRaw === 'private' || visRaw === 'unlisted' ? visRaw : 'private';

  return {
    ...(modConfig as BuildConfig),
    id,
    name: typeof row.name === 'string' ? row.name : (modConfig.name ?? 'Untitled Build'),
    equipment_type:
      (typeof row.equipment_type === 'string' ? row.equipment_type : modConfig.equipment_type) ??
      'warframe',
    equipment_unique_name:
      (typeof row.equipment_unique_name === 'string'
        ? row.equipment_unique_name
        : modConfig.equipment_unique_name) ?? '',
    equipment_name: modConfig.equipment_name ?? modConfig.equipment_unique_name ?? '',
    equipment_image:
      typeof modConfig.equipment_image === 'string' ? modConfig.equipment_image : undefined,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    visibility,
  } as StoredBuild;
}
