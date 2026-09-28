import { bustCatalogResponseCache } from '../cache/catalogResponseCache.js';
import { bustModListCache } from '../cache/modListCache.js';
import { log } from '../logger.js';
import { syncCodexWarframeCatalog, type CatalogSyncSummary } from './codexCatalog.js';

export interface SyncLogLine {
  ts: string;
  level: 'info' | 'error';
  message: string;
}

export interface AdminCatalogSyncSnapshot {
  runId: number;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  requestedByUserId: string | null;
  requestedByUserMasked: string | null;
  lines: SyncLogLine[];
  summary: CatalogSyncSummary | null;
  error: string | null;
}

type SnapshotListener = (snapshot: AdminCatalogSyncSnapshot) => void;

const MAX_LINES = 4000;
const listeners = new Set<SnapshotListener>();

let runCounter = 0;
let activeJobPromise: Promise<void> | null = null;

let state: AdminCatalogSyncSnapshot = {
  runId: 0,
  running: false,
  startedAt: null,
  finishedAt: null,
  requestedByUserId: null,
  requestedByUserMasked: null,
  lines: [],
  summary: null,
  error: null,
};

function nowIso(): string {
  return new Date().toISOString();
}

function maskClerkUserId(userId: string | null): string | null {
  if (!userId) return null;
  if (userId.length <= 8) return userId;
  return `${userId.slice(0, 4)}…${userId.slice(-4)}`;
}

function pushLine(level: 'info' | 'error', message: string): void {
  const line: SyncLogLine = { ts: nowIso(), level, message };
  state.lines.push(line);
  if (state.lines.length > MAX_LINES) {
    state.lines.splice(0, state.lines.length - MAX_LINES);
  }
  notify();
}

function notify(): void {
  const snapshot = getAdminCatalogSyncSnapshot();
  let index = 0;
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (error) {
      log('error', 'Admin catalog sync snapshot listener failed', {
        index,
        err: error instanceof Error ? error.message : String(error),
      });
    }
    index += 1;
  }
}

export function getAdminCatalogSyncSnapshot(): AdminCatalogSyncSnapshot {
  return {
    ...state,
    lines: [...state.lines],
  };
}

export function subscribeAdminCatalogSyncSnapshot(listener: SnapshotListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isAdminCatalogSyncRunning(): boolean {
  return activeJobPromise !== null || state.running;
}

export function waitForAdminCatalogSyncIdle(timeoutMs: number): Promise<boolean> {
  if (!isAdminCatalogSyncRunning()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const unsubscribe = subscribeAdminCatalogSyncSnapshot(() => {
      if (!isAdminCatalogSyncRunning()) {
        finish(true);
      }
    });
  });
}

export function startAdminCatalogSyncJob(requestedByUserId: string | null = null): {
  started: boolean;
  snapshot: AdminCatalogSyncSnapshot;
  reason?: string;
} {
  if (isAdminCatalogSyncRunning()) {
    return {
      started: false,
      reason: 'A catalog sync job is already running.',
      snapshot: getAdminCatalogSyncSnapshot(),
    };
  }

  runCounter += 1;
  const masked = maskClerkUserId(requestedByUserId);
  state = {
    runId: runCounter,
    running: true,
    startedAt: nowIso(),
    finishedAt: null,
    requestedByUserId,
    requestedByUserMasked: masked,
    lines: [],
    summary: null,
    error: null,
  };
  pushLine(
    'info',
    `[CatalogSync] Run #${state.runId} queued${masked ? ` by user ${masked}` : ''}.`,
  );

  activeJobPromise = (async () => {
    try {
      const summary = syncCodexWarframeCatalog({
        onLog: (message, level = 'info') => {
          pushLine(level, message);
        },
      });
      state.summary = summary;
      const tableTotal = Object.values(summary.tables).reduce((sum, n) => sum + n, 0);
      pushLine(
        'info',
        `[CatalogSync] Run #${state.runId} finished: ${tableTotal} catalog rows, ${summary.imagesCopied} images copied.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.error = message;
      pushLine('error', `[CatalogSync] Run #${state.runId} failed: ${message}`);
    } finally {
      state.running = false;
      state.finishedAt = nowIso();
      bustModListCache();
      bustCatalogResponseCache();
      activeJobPromise = null;
      notify();
    }
  })();

  return { started: true, snapshot: getAdminCatalogSyncSnapshot() };
}
