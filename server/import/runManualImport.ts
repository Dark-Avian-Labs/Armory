import { ensureDataDirs } from '../config.js';
import { runStartupPipeline } from './startupPipeline.js';

async function main(): Promise<void> {
  console.log('[ManualImport] Starting full import pipeline...');
  ensureDataDirs();
  await runStartupPipeline({ includeHiddenCompanionWeapons: true });
  console.log('[ManualImport] Import pipeline completed.');
}

main().catch((error: unknown) => {
  console.error('[ManualImport] Import pipeline failed:', error);
  process.exitCode = 1;
});
