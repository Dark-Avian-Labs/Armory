import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  StartupPipelineSummary,
  StepSummaryBase,
  SummaryOutcome,
} from '../../../shared/pipelineSummaryTypes';
import { apiFetch } from '../../utils/api';
import { Modal } from '../ui/Modal';

interface ImportLogLine {
  ts: string;
  level: 'info' | 'error';
  message: string;
}

type ImportSummaryStepKey = Exclude<keyof StartupPipelineSummary, 'durationMs' | 'blockingIssues'>;

function outcomeBadgeClass(outcome: SummaryOutcome | string | undefined): string {
  switch (outcome) {
    case 'ok':
      return 'bg-success/15 text-success';
    case 'partial':
      return 'bg-warning/15 text-warning';
    case 'failed':
      return 'bg-danger/15 text-danger';
    case 'skipped':
    default:
      return 'bg-muted/20 text-muted';
  }
}

const STEP_TITLES: Array<{ key: ImportSummaryStepKey; title: string }> = [
  { key: 'schema', title: 'Schema' },
  { key: 'officialExports', title: 'Exports' },
  { key: 'sqliteFromExports', title: 'Database' },
  { key: 'exaltedStanceMods', title: 'Exalted Stances' },
  { key: 'images', title: 'Images' },
  { key: 'hiddenCompanionWeapons', title: 'Companion Weapons' },
  { key: 'overframe', title: 'Overframe' },
  { key: 'wiki', title: 'Wiki' },
  { key: 'helminthWiki', title: 'Helminth' },
  { key: 'incarnonWiki', title: 'Incarnon' },
  { key: 'warframeMarketLinks', title: 'Warframe Market' },
];

function formatImportSummaryLines(
  s: StartupPipelineSummary,
): Array<{ title: string; outcome: string; detail: string }> {
  return STEP_TITLES.map(({ key, title }) => {
    const step = s[key] as StepSummaryBase;
    return {
      title,
      outcome: step.outcome,
      detail: step.error ? `${step.detail} — ${step.error}` : step.detail,
    };
  });
}

interface ImportSnapshot {
  runId: number;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  requestedByUserId: number | null;
  lines: ImportLogLine[];
  summary: StartupPipelineSummary | null;
  error: string | null;
}

export function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="glass-shell p-6">
        <h1 className="text-foreground text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted mt-1 text-sm">Data import controls.</p>
      </div>
      <DataImportAdmin />
    </div>
  );
}

function DataImportAdmin() {
  const [snapshot, setSnapshot] = useState<ImportSnapshot | null>(null);
  const [runningImport, setRunningImport] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'error'>('idle');
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const copyFeedbackResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isDisposed = false;

    void (async () => {
      try {
        const res = await apiFetch('/api/admin/import/state');
        const body = (await res.json().catch(() => null)) as
          | ImportSnapshot
          | { error?: string }
          | null;
        if (!res.ok || (body && 'error' in body && body.error)) {
          throw new Error(
            (body && 'error' in body && body.error) || 'Failed to load import state.',
          );
        }
        if (!isDisposed) {
          setSnapshot(body as ImportSnapshot);
          setRunningImport((body as ImportSnapshot).running);
        }
      } catch (error) {
        if (!isDisposed) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load import state.');
        }
      }
    })();

    const stream = new EventSource('/api/admin/import/stream');
    stream.addEventListener('snapshot', (event) => {
      if (isDisposed) return;
      try {
        const next = JSON.parse((event as MessageEvent).data) as ImportSnapshot;
        setSnapshot(next);
        setRunningImport(next.running);
      } catch {
        // ignore
      }
    });
    stream.onerror = () => {
      if (isDisposed) return;
      setErrorMessage('Live import log disconnected. Reload page if updates stop.');
    };

    return () => {
      isDisposed = true;
      stream.close();
    };
  }, []);

  useEffect(() => {
    return () => {
      const id = copyFeedbackResetTimeoutRef.current;
      if (id != null) {
        window.clearTimeout(id);
        copyFeedbackResetTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showLogs) return;
    if (!logContainerRef.current) return;
    const el = logContainerRef.current;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const NEAR_BOTTOM_THRESHOLD_PX = 24;
    if (distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX) {
      el.scrollTop = el.scrollHeight;
    }
  }, [showLogs, snapshot?.lines.length]);

  const statusText = useMemo(() => {
    if (!snapshot) return 'Loading import state...';
    if (snapshot.running) return `Import #${snapshot.runId} is running...`;
    if (!snapshot.startedAt) return 'No import run has been started yet.';
    return `Last run #${snapshot.runId} finished ${snapshot.finishedAt ? 'successfully' : 'with unknown state'}.`;
  }, [snapshot]);

  const runImport = async (options?: { forceImport?: boolean; forceImages?: boolean }) => {
    setErrorMessage(null);
    setShowLogs(true);
    setRunningImport(true);
    try {
      const response = await apiFetch('/api/admin/import/run', {
        method: 'POST',
        body: JSON.stringify(options ?? {}),
      });
      const body = (await response.json().catch(() => null)) as {
        started?: boolean;
        snapshot?: ImportSnapshot;
        error?: string;
      } | null;
      if (!response.ok || (body && body.error)) {
        throw new Error(body?.error || 'Failed to start import.');
      }
      if (body?.snapshot) {
        setSnapshot(body.snapshot);
      }
    } catch (error) {
      setRunningImport(false);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start import.');
    }
  };

  const copyLogToClipboard = async () => {
    const lines = snapshot?.lines ?? [];
    const text =
      lines.length === 0
        ? 'No output yet.'
        : lines
            .map((line) => `[${new Date(line.ts).toLocaleTimeString()}] ${line.message}`)
            .join('\n');
    const prevResetId = copyFeedbackResetTimeoutRef.current;
    if (prevResetId != null) {
      window.clearTimeout(prevResetId);
      copyFeedbackResetTimeoutRef.current = null;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('copied');
    } catch {
      setCopyFeedback('error');
    }
    copyFeedbackResetTimeoutRef.current = window.setTimeout(() => {
      copyFeedbackResetTimeoutRef.current = null;
      setCopyFeedback('idle');
    }, 2000);
  };

  return (
    <>
      <div className="glass-surface p-6">
        <h2 className="text-foreground mb-3 text-lg font-semibold">Data Import</h2>
        <p className="text-muted mb-3 text-xs">
          Run the full data pipeline (official exports, database processing, Overframe sync, wiki
          enrichments, Helminth sync, image downloads).
        </p>
        <p className="text-muted mb-4 text-sm" role="status">
          {statusText}
        </p>
        {errorMessage ? (
          <p className="text-danger mb-3 text-sm" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="glass-button text-sm"
            onClick={() => {
              void runImport();
            }}
            disabled={runningImport}
          >
            {runningImport ? 'Import running...' : 'Run Full Import'}
          </button>
          <button
            type="button"
            className="glass-button-secondary text-warning text-sm"
            onClick={() => {
              void runImport({ forceImport: true, forceImages: true });
            }}
            disabled={runningImport}
          >
            Force Full Re-import
          </button>
          <button
            type="button"
            className="glass-button-secondary text-sm"
            onClick={() => {
              void runImport({ forceImages: true });
            }}
            disabled={runningImport}
          >
            Force Re-download Images
          </button>
          <button
            type="button"
            className="glass-button-secondary text-sm"
            onClick={() => setShowLogs(true)}
          >
            View Live Log
          </button>
        </div>

        <Modal
          open={showLogs}
          onClose={() => setShowLogs(false)}
          ariaLabelledBy="armory-import-log-title"
          className="armory-import-modal"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 id="armory-import-log-title" className="text-foreground text-lg font-semibold">
                Import Console
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-xs ${snapshot?.running ? 'text-warning' : 'text-muted'}`}
                  role="status"
                >
                  {snapshot?.running ? 'Running' : 'Idle'}
                </span>
                <button
                  type="button"
                  className="glass-button-secondary text-sm"
                  onClick={() => {
                    void copyLogToClipboard();
                  }}
                  aria-label="Copy import log to clipboard"
                >
                  {copyFeedback === 'copied'
                    ? 'Copied'
                    : copyFeedback === 'error'
                      ? 'Copy failed'
                      : 'Copy log'}
                </button>
              </div>
            </div>
            {snapshot?.summary?.blockingIssues?.length ? (
              <div className="error-msg text-xs">{snapshot.summary.blockingIssues.join(' ')}</div>
            ) : null}
            <div ref={logContainerRef} className="import-log-terminal">
              {snapshot?.lines.length ? (
                snapshot.lines.map((line, index) => (
                  <div
                    key={`${line.ts}-${index}`}
                    className={line.level === 'error' ? 'text-danger' : 'text-foreground'}
                  >
                    <span className="text-muted">[{new Date(line.ts).toLocaleTimeString()}]</span>{' '}
                    {line.message}
                  </div>
                ))
              ) : (
                <div className="text-muted">No output yet.</div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="glass-button-secondary text-sm"
                onClick={() => setShowLogs(false)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      </div>

      {snapshot?.summary ? (
        <div className="glass-surface p-6">
          <h2 className="text-foreground mb-2 text-lg font-semibold">
            Last Run Summary
            <span className="text-muted ml-2 text-xs font-normal">
              ({(snapshot.summary.durationMs / 1000).toFixed(1)}s)
            </span>
          </h2>
          <ul className="list-none space-y-0 text-xs">
            {formatImportSummaryLines(snapshot.summary).map((row) => (
              <li
                key={row.title}
                className="border-border/60 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-b border-dashed py-2 last:border-0 sm:grid-cols-[minmax(10rem,14rem)_5.75rem_minmax(0,1fr)] sm:items-start sm:gap-y-1"
              >
                <span className="text-foreground col-span-2 font-medium sm:col-span-1">
                  {row.title}
                </span>
                <span
                  className={`col-start-1 row-start-2 inline-flex w-fit shrink-0 self-start justify-self-start rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase sm:col-start-2 sm:row-start-1 ${outcomeBadgeClass(row.outcome as SummaryOutcome)}`}
                >
                  {row.outcome}
                </span>
                <span className="text-muted col-start-2 row-start-2 min-w-0 self-start leading-snug sm:col-start-3 sm:row-start-1">
                  {row.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
