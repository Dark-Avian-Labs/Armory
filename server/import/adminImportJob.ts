import type { PipelineStepKey } from '../../shared/pipelineSteps.js';
import { bustModListCache } from '../cache/modListCache.js';
import {
  createImportRun,
  forceReleaseImportLease,
  getActiveImportRunId,
  getImportRunRow,
  getLatestImportRunRow,
  isImportLeaseHeld,
  maskClerkUserId,
  parseImportRunSteps,
  persistImportRunSteps,
  releaseImportLease,
  tryAcquireImportLease,
  updateImportRun,
  type ImportLogLine,
} from './importRuns.js';
import type { StartupPipelineSummary } from './pipelineSummary.js';
import { runStartupPipeline } from './startupPipeline.js';

export type { ImportLogLine } from './importRuns.js';

export interface AdminImportSnapshot {
  runId: number;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  requestedByUserId: string | null;
  requestedByUserMasked: string | null;
  lines: ImportLogLine[];
  summary: StartupPipelineSummary | null;
  error: string | null;
}

type SnapshotListener = (snapshot: AdminImportSnapshot) => void;

const MAX_LINES = 4000;
const listeners = new Set<SnapshotListener>();

let state: AdminImportSnapshot = {
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

let hydratedFromDb = false;

function hydrateAdminImportFromDb(): void {
  if (hydratedFromDb) return;
  hydratedFromDb = true;
  if (state.runId > 0 || state.lines.length > 0) return;
  const activeRunId = getActiveImportRunId();
  const row =
    (activeRunId != null ? getImportRunRow(activeRunId) : null) ?? getLatestImportRunRow();
  if (!row) return;
  const steps = parseImportRunSteps(row.steps_json);
  state = {
    runId: row.id,
    running: false,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    requestedByUserId: null,
    requestedByUserMasked: null,
    lines: steps.lines,
    summary: steps.summary,
    error: row.error_text,
  };
}

function prepareAdminImportSnapshot(): void {
  hydrateAdminImportFromDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

function pushLine(level: 'info' | 'error', message: string): void {
  const line: ImportLogLine = {
    ts: nowIso(),
    level,
    message,
  };
  state.lines.push(line);
  if (state.lines.length > MAX_LINES) {
    state.lines.splice(0, state.lines.length - MAX_LINES);
  }
  persistCurrentSteps();
  notify();
}

function persistCurrentSteps(): void {
  if (state.runId < 1) return;
  persistImportRunSteps(state.runId, {
    lines: state.lines,
    summary: state.summary,
  });
}

function notify(): void {
  const snapshot = getAdminImportSnapshot();
  let index = 0;
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error(
        `[AdminImport] Snapshot listener ${index} failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }
    index += 1;
  }
}

export function getAdminImportSnapshot(): AdminImportSnapshot {
  prepareAdminImportSnapshot();
  return {
    ...state,
    running: state.running || isImportLeaseHeld(),
    lines: [...state.lines],
  };
}

export function resetAdminImportLock(): AdminImportSnapshot {
  forceReleaseImportLease();
  state.running = false;
  if (state.runId > 0 && !state.finishedAt) {
    state.finishedAt = nowIso();
    state.error = state.error ?? 'Import lock cleared by admin.';
    updateImportRun(state.runId, {
      status: 'failed',
      finished_at: state.finishedAt,
      error_text: state.error,
    });
    persistCurrentSteps();
  }
  notify();
  return getAdminImportSnapshot();
}

export function subscribeAdminImportSnapshot(listener: SnapshotListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isAdminImportRunning(): boolean {
  return state.running || isImportLeaseHeld();
}

export function waitForAdminImportIdle(timeoutMs: number): Promise<boolean> {
  if (!isAdminImportRunning()) {
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
    const unsubscribe = subscribeAdminImportSnapshot((snapshot) => {
      if (!snapshot.running) {
        finish(true);
      }
    });
  });
}

export interface AdminImportOptions {
  forceImport?: boolean;
  forceImages?: boolean;
  forceSteps?: PipelineStepKey[];
}

export function startAdminImportJob(
  requestedByUserId: string,
  options: AdminImportOptions = {},
): {
  started: boolean;
  snapshot: AdminImportSnapshot;
  reason?: string;
} {
  if (isAdminImportRunning()) {
    return {
      started: false,
      reason: 'An import job is already running.',
      snapshot: getAdminImportSnapshot(),
    };
  }

  const run = createImportRun(requestedByUserId);
  const masked = maskClerkUserId(requestedByUserId);
  state = {
    runId: run.id,
    running: true,
    startedAt: nowIso(),
    finishedAt: null,
    requestedByUserId,
    requestedByUserMasked: masked,
    lines: [],
    summary: null,
    error: null,
  };
  updateImportRun(run.id, { status: 'running' });
  pushLine('info', `[AdminImport] Run #${state.runId} queued by user ${masked}.`);

  void (async () => {
    const lockToken = tryAcquireImportLease(run.id);
    if (!lockToken) {
      const message = 'An import job is already running.';
      state.error = message;
      state.running = false;
      state.finishedAt = nowIso();
      updateImportRun(run.id, {
        status: 'failed',
        finished_at: state.finishedAt,
        error_text: message,
      });
      persistCurrentSteps();
      notify();
      return;
    }

    try {
      const summary = await runStartupPipeline({
        cliReport: true,
        forceImport: options.forceImport,
        forceImages: options.forceImages,
        forceSteps: options.forceSteps,
        importRunId: run.id,
        skipLease: true,
        reporter: (line, level) => {
          pushLine(level, line);
        },
      });
      state.summary = summary;
      pushLine(
        'info',
        `[AdminImport] Run #${state.runId} finished in ${(summary.durationMs / 1000).toFixed(1)}s.`,
      );
      updateImportRun(run.id, {
        status: 'succeeded',
        finished_at: nowIso(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.error = message;
      pushLine('error', `[AdminImport] Run #${state.runId} failed: ${message}`);
      updateImportRun(run.id, {
        status: 'failed',
        finished_at: nowIso(),
        error_text: message,
      });
    } finally {
      releaseImportLease(lockToken);
      state.running = false;
      state.finishedAt = nowIso();
      persistCurrentSteps();
      bustModListCache();
      notify();
    }
  })();

  return { started: true, snapshot: getAdminImportSnapshot() };
}
