import { createApp } from './app.js';
import { stopModListCacheCleanup } from './cache/modListCache.js';
import {
  APP_NAME,
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
import { isAdminImportRunning, waitForAdminImportIdle } from './import/adminImportJob.js';
import { recoverImportLeaseOnStartup } from './import/importRuns.js';
import { log } from './logger.js';

ensureDataDirs();
createAppSchema();
repairPlaceholderArtifactSlots();
recoverImportLeaseOnStartup();

const { app, sessionStore } = createApp();
log('info', 'Session DB ready', { path: SESSION_DB_PATH });

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

function shutdown(baseExitCode = 0): void {
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
    if (isAdminImportRunning()) {
      log('info', 'Waiting for admin import job before shutdown');
      const importWaitMs = Math.max(SHUTDOWN_TIMEOUT_MS - 2000, 1000);
      const finished = await waitForAdminImportIdle(importWaitMs);
      if (!finished) {
        log('warn', 'Admin import still running; proceeding with shutdown');
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

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection; shutting down', {
    err: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  });
  shutdown(1);
});

process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception; shutting down', {
    err: err.stack ?? err.message,
  });
  shutdown(1);
});

export default app;
