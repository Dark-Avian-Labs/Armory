import type Database from 'better-sqlite3';

export function syncCodexWeaponIncarnonFlags(
  armoryDb: Database.Database,
  codexDb: Database.Database,
): number {
  const flagged = armoryDb
    .prepare(`SELECT unique_name FROM weapons WHERE has_incarnon = 1`)
    .all() as Array<{ unique_name: string }>;

  const resetStmt = codexDb.prepare('UPDATE codex_weapons SET has_incarnon = 0');
  const updateStmt = codexDb.prepare(
    'UPDATE codex_weapons SET has_incarnon = 1 WHERE unique_name = ?',
  );

  let count = 0;
  const tx = codexDb.transaction(() => {
    resetStmt.run();
    for (const row of flagged) {
      const result = updateStmt.run(row.unique_name);
      count += result.changes;
    }
  });
  tx();

  return count;
}
