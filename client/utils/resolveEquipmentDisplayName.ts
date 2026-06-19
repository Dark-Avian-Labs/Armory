import { formatSiriusOrionBuildDisplayName } from '../../shared/siriusOrionRegistry.js';
import { normalizeEquipmentName } from './specialItems';

export function isLotusUniqueName(value: string): boolean {
  return value.startsWith('/Lotus/');
}

export function resolveEquipmentDisplayName(
  uniqueName: string,
  options: {
    storedName?: string;
    queryName?: string | null;
    catalogName?: string | null;
  },
): string {
  const siriusOrionLabel = formatSiriusOrionBuildDisplayName(uniqueName);
  if (siriusOrionLabel) {
    return siriusOrionLabel;
  }
  if (options.queryName?.trim()) {
    return normalizeEquipmentName(options.queryName.trim());
  }
  if (options.catalogName?.trim()) {
    return normalizeEquipmentName(options.catalogName.trim());
  }
  const stored = options.storedName?.trim() ?? '';
  if (stored && !isLotusUniqueName(stored)) {
    return normalizeEquipmentName(stored);
  }
  if (uniqueName && !isLotusUniqueName(uniqueName)) {
    return normalizeEquipmentName(uniqueName);
  }
  return normalizeEquipmentName(stored || uniqueName);
}
