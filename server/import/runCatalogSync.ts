import { ensureDataDirs } from '../config.js';
import { createAppSchema } from '../db/schema.js';
import { syncCodexWarframeCatalog } from './codexCatalog.js';

function main(): void {
  console.log('[CatalogSync] Copying Codex warframe-catalog into ARMORY_DB_PATH.');
  ensureDataDirs();
  createAppSchema();
  const summary = syncCodexWarframeCatalog({
    onLog: (message, level = 'info') => {
      const prefix = level === 'error' ? '[CatalogSync:error]' : '[CatalogSync]';
      console.log(`${prefix} ${message}`);
    },
  });
  console.log('[CatalogSync] Done.', JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (error: unknown) {
  console.error('[CatalogSync] Failed:', error);
  process.exitCode = 1;
}
