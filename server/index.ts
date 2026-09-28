import { createApp } from './app.js';
import { stopModListCacheCleanup } from './cache/modListCache.js';
import {
  APP_NAME,
  CODEX_WARFRAME_CATALOG_DB_PATH,
  HOST,
  NODE_ENV,
  PORT,
  SESSION_DB_PATH,
  SHUTDOWN_TIMEOUT_MS,
  USING_INSECURE_DEV_SESSION_SECRET,
  ensureDataDirs,
} from './config.js';
import { closeAll } from './db/connection.js';
import { repairPlaceholderArtifactSlots } from './db/repairArtifactSlots.js';
import { createAppSchema } from './db/schema.js';
import {
  isAdminCatalogSyncRunning,
  waitForAdminCatalogSyncIdle,
} from './import/adminCatalogSyncJob.js';
import {
  catalogWarframeCount,
  codexCatalogDbExists,
  syncCodexWarframeCatalog,
} from './import/codexCatalog.js';
import { log } from './logger.js';
import { createAppSentinelAgent } from './sentinelAgent.js';

ensureDataDirs();
createAppSchema();
repairPlaceholderArtifactSlots();

try {
  if (catalogWarframeCount() === 0 && codexCatalogDbExists()) {
    const summary = syncCodexWarframeCatalog({
      onLog: (message, level = 'info') => {
        log(level === 'error' ? 'error' : 'info', message, { source: 'catalogSync' });
      },
    });
    log('info', 'Boot-synced Codex Warframe catalog', {
      source: CODEX_WARFRAME_CATALOG_DB_PATH,
      tables: summary.tables,
      imagesCopied: summary.imagesCopied,
    });
  }
} catch (error) {
  log('warn', 'Codex catalog sync skipped on boot', {
    error: error instanceof Error ? error.message : String(error),
    source: CODEX_WARFRAME_CATALOG_DB_PATH,
  });
}
const sentinelAgent = createAppSentinelAgent({
  appId: 'armory',
  displayName: APP_NAME,
  nodeEnv: NODE_ENV,
});

const { app, sessionStore } = createApp({
  metricsMiddleware: sentinelAgent?.middleware,
});
log('info', 'Session DB ready', { path: SESSION_DB_PATH });

sentinelAgent?.start();

const server = app.listen(PORT, HOST, () => {
  log('info', `${APP_NAME} server listening`, { host: HOST, port: PORT, nodeEnv: NODE_ENV });
  if (USING_INSECURE_DEV_SESSION_SECRET) {
    const hostIsLoopback =
      HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1' || HOST === '[::1]';
    if (!hostIsLoopback) {
      log(
        'warn',
        'INSECURE DEV SESSION_SECRET is active while HOST is non-loopback. Set SESSION_SECRET or bind to 127.0.0.1.',
        { host: HOST },
      );
    } else {
      log(
        'warn',
        'Using insecure DEV SESSION_SECRET (ALLOW_INSECURE_DEV=1). Do not use in production.',
      );
    }
  }
});
server.headersTimeout = 65_000;
server.requestTimeout = 120_000;

function shutdown(baseExitCode = 0, signal?: string): void {
  if (baseExitCode === 0) sentinelAgent?.noteGracefulExit(signal);
  else sentinelAgent?.noteCrash(new Error(`shutdown exit ${baseExitCode}`));
  sentinelAgent?.stop();

  let done = false;
  function closeAndExit(exitCode: number): void {
    if (done) return;
    done = true;
    stopModListCacheCleanup();
    sessionStore.dispose();
    try {
      closeAll();
    } catch (err) {
      log('error', 'Failed to close DB connections during shutdown', {
        err: err instanceof Error ? err.message : String(err),
      });
      exitCode = 1;
    }
    process.exit(exitCode); // eslint-disable-line n/no-process-exit -- required for graceful shutdown
  }

  const hardTimeout = setTimeout(() => {
    log('warn', 'Shutdown timeout reached; forcing exit', { timeoutMs: SHUTDOWN_TIMEOUT_MS });
    closeAndExit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  void (async () => {
    if (isAdminCatalogSyncRunning()) {
      log('info', 'Waiting for admin catalog sync before shutdown');
      const syncWaitMs = Math.max(SHUTDOWN_TIMEOUT_MS - 2000, 1000);
      const finished = await waitForAdminCatalogSyncIdle(syncWaitMs);
      if (!finished) {
        log('warn', 'Admin catalog sync still running; proceeding with shutdown');
      }
    }

    server.close((err) => {
      clearTimeout(hardTimeout);
      if (err) {
        log('error', 'HTTP server close failed', {
          err: err instanceof Error ? err.message : String(err),
        });
        closeAndExit(1);
        return;
      }
      closeAndExit(baseExitCode);
    });
    server.closeIdleConnections();
    const forceCloseMs = Math.max(0, SHUTDOWN_TIMEOUT_MS - 500);
    setTimeout(() => {
      server.closeAllConnections();
    }, forceCloseMs);
  })();
}

process.on('SIGINT', () => shutdown(0, 'SIGINT'));
process.on('SIGTERM', () => shutdown(0, 'SIGTERM'));

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection; shutting down', {
    err: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  });
  sentinelAgent?.noteCrash(reason);
  shutdown(1);
});

process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception; shutting down', {
    err: err.stack ?? err.message,
  });
  sentinelAgent?.noteCrash(err);
  shutdown(1);
});

export default app;
