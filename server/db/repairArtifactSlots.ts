import { hasMeaningfulArtifactSlotOverrides } from '../../shared/artifactSlotState.js';
import { log } from '../logger.js';
import { getCatalogDb } from './connection.js';

function parseArtifactSlots(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function repairPlaceholderArtifactSlots(): number {
  const db = getCatalogDb();
  let cleared = 0;

  const clearWarframe = db.prepare(
    'UPDATE warframes SET artifact_slots = NULL WHERE unique_name = ?',
  );
  const clearWeapon = db.prepare('UPDATE weapons SET artifact_slots = NULL WHERE unique_name = ?');
  const clearCompanion = db.prepare(
    'UPDATE companions SET artifact_slots = NULL WHERE unique_name = ?',
  );

  const warframes = db
    .prepare(`SELECT unique_name, artifact_slots FROM warframes WHERE artifact_slots IS NOT NULL`)
    .all() as Array<{ unique_name: string; artifact_slots: string }>;
  for (const row of warframes) {
    const slots = parseArtifactSlots(row.artifact_slots);
    if (slots.length > 0 && !hasMeaningfulArtifactSlotOverrides(slots)) {
      clearWarframe.run(row.unique_name);
      cleared += 1;
    }
  }

  const weapons = db
    .prepare(`SELECT unique_name, artifact_slots FROM weapons WHERE artifact_slots IS NOT NULL`)
    .all() as Array<{ unique_name: string; artifact_slots: string }>;
  for (const row of weapons) {
    const slots = parseArtifactSlots(row.artifact_slots);
    if (slots.length > 0 && !hasMeaningfulArtifactSlotOverrides(slots)) {
      clearWeapon.run(row.unique_name);
      cleared += 1;
    }
  }

  const companions = db
    .prepare(`SELECT unique_name, artifact_slots FROM companions WHERE artifact_slots IS NOT NULL`)
    .all() as Array<{ unique_name: string; artifact_slots: string }>;
  for (const row of companions) {
    const slots = parseArtifactSlots(row.artifact_slots);
    if (slots.length > 0 && !hasMeaningfulArtifactSlotOverrides(slots)) {
      clearCompanion.run(row.unique_name);
      cleared += 1;
    }
  }

  if (cleared > 0) {
    log('info', 'Cleared placeholder artifact_slots rows', { count: cleared });
  }

  return cleared;
}
