import type Database from 'better-sqlite3';

export function syncCodexWeaponIncarnonFlags(
  armoryDb: Database.Database,
  codexDb: Database.Database,
): number {
  codexDb.prepare('UPDATE codex_weapons SET has_incarnon = 0').run();

  const flagged = armoryDb
    .prepare(`SELECT unique_name FROM weapons WHERE has_incarnon = 1`)
    .all() as Array<{ unique_name: string }>;

  const updateStmt = codexDb.prepare(
    'UPDATE codex_weapons SET has_incarnon = 1 WHERE unique_name = ?',
  );

  let count = 0;
  const tx = codexDb.transaction(() => {
    for (const row of flagged) {
      const result = updateStmt.run(row.unique_name);
      count += result.changes;
    }
  });
  tx();

  return count;
}
