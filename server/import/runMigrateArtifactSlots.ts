import path from 'path';

import Database from 'better-sqlite3';

import { migrateArtifactSlotsFromOverframe } from './migrateArtifactSlotsFromOverframe.js';

function resolveDbPath(): string {
  const arg = process.argv.find((a) => !a.startsWith('-') && a.endsWith('.db'));
  if (arg) return path.resolve(arg);
  const env = process.env.ARMORY_DB_PATH?.trim();
  if (env) return path.resolve(env);
  return path.resolve('data', 'armory.db');
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const dbPath = resolveDbPath();
  const db = new Database(dbPath);
  const summary = migrateArtifactSlotsFromOverframe(db, { dryRun });
  db.close();

  const prefix = dryRun ? '[dry-run] ' : '';
  console.log(`${prefix}Artifact slot migration (${dbPath})`);
  console.log(
    `${prefix}Warframes cleared: ${summary.warframesCleared}, Jade updated: ${summary.warframesJadeUpdated}, ` +
      `Necramech updated: ${summary.warframesNecramechUpdated}`,
  );
  console.log(
    `${prefix}Weapons cleared: ${summary.weaponsCleared}, companions cleared: ${summary.companionsCleared}`,
  );
}

main();
