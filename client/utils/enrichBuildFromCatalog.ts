import type { StoredBuild } from '../types/warframe';

type CatalogRow = {
  unique_name: string;
  name?: string;
  image_path?: string | null;
};

export function enrichBuildFromCatalog(
  build: StoredBuild,
  lookup: Record<string, CatalogRow>,
): StoredBuild {
  const rec = lookup[build.equipment_unique_name];
  if (!rec) return build;
  const catalogImagePath = rec.image_path?.trim();
  const imageFromCatalog =
    catalogImagePath && catalogImagePath.length > 0
      ? catalogImagePath.startsWith('/')
        ? `/images${catalogImagePath}`
        : `/images/${catalogImagePath}`
      : undefined;
  return {
    ...build,
    equipment_name:
      build.equipment_name && build.equipment_name !== build.equipment_unique_name
        ? build.equipment_name
        : (rec.name ?? build.equipment_name ?? build.equipment_unique_name),
    equipment_image: build.equipment_image ?? imageFromCatalog,
  };
}
