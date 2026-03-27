import type { StartupPipelineSummary } from './pipelineSummary.js';
import { runStartupPipeline } from './startupPipeline.js';

export interface ImportLogLine {
  ts: string;
  level: 'info' | 'error';
  message: string;
}

export interface AdminImportSnapshot {
  runId: number;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  requestedByUserId: number | null;
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
  lines: [],
  summary: null,
  error: null,
};

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
  notify();
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
  return {
    ...state,
    lines: [...state.lines],
  };
}

export function subscribeAdminImportSnapshot(listener: SnapshotListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startAdminImportJob(requestedByUserId: number): {
  started: boolean;
  snapshot: AdminImportSnapshot;
  reason?: string;
} {
  if (state.running) {
    return {
      started: false,
      reason: 'An import job is already running.',
      snapshot: getAdminImportSnapshot(),
    };
  }

  state = {
    runId: state.runId + 1,
    running: true,
    startedAt: nowIso(),
    finishedAt: null,
    requestedByUserId,
    lines: [],
    summary: null,
    error: null,
  };
  pushLine('info', `[AdminImport] Run #${state.runId} queued by user ${requestedByUserId}.`);

  void (async () => {
    try {
      const summary = await runStartupPipeline({
        includeHiddenCompanionWeapons: true,
        includeExaltedStanceMods: true,
        cliReport: true,
        reporter: (line, level) => {
          pushLine(level, line);
        },
      });
      state.summary = summary;
      pushLine(
        'info',
        `[AdminImport] Run #${state.runId} finished in ${(summary.durationMs / 1000).toFixed(1)}s.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.error = message;
      pushLine('error', `[AdminImport] Run #${state.runId} failed: ${message}`);
    } finally {
      state.running = false;
      state.finishedAt = nowIso();
      notify();
    }
  })();

  return { started: true, snapshot: getAdminImportSnapshot() };
}
