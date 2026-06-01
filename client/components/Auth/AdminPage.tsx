import { useEffect, useMemo, useRef, useState } from 'react';

import { PIPELINE_STEPS, type PipelineStepKey } from '../../../shared/pipelineSteps';
import type {
  StartupPipelineSummary,
  StepSummaryBase,
  SummaryOutcome,
} from '../../../shared/pipelineSummaryTypes';
import { apiFetch } from '../../utils/api';
import { ArtifactSlotsAdminTool } from '../Admin/ArtifactSlotsAdminTool';
import { Modal } from '../ui/Modal';

interface ImportLogLine {
  ts: string;
  level: 'info' | 'error';
  message: string;
}

type ImportSummaryStepKey = Exclude<keyof StartupPipelineSummary, 'durationMs' | 'blockingIssues'>;

interface RunImportOptions {
  forceImport?: boolean;
  forceImages?: boolean;
  forceSteps?: PipelineStepKey[];
}

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

function formatImportSummaryLines(
  s: StartupPipelineSummary,
): Array<{ title: string; outcome: string; detail: string }> {
  return PIPELINE_STEPS.map(({ key, label }) => {
    const step = s[key as ImportSummaryStepKey] as StepSummaryBase;
    return {
      title: label,
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
  requestedByUserId: string | null;
  requestedByUserMasked?: string | null;
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
      <ArtifactSlotsAdminTool />
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
  const [forcedSteps, setForcedSteps] = useState<PipelineStepKey[]>([]);
  const [confirmForceImport, setConfirmForceImport] = useState(false);
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

    const stream = new EventSource('/api/admin/import/stream', { withCredentials: true });
    stream.addEventListener('snapshot', (event) => {
      if (isDisposed) return;
      try {
        const next = JSON.parse((event as MessageEvent).data) as ImportSnapshot;
        setSnapshot(next);
        setRunningImport(next.running);
        if (next.running) {
          setErrorMessage(null);
        }
      } catch {
        // ignore
      }
    });
    stream.onerror = () => {
      if (isDisposed) return;
      setErrorMessage((prev) =>
        prev?.includes('already running')
          ? prev
          : 'Live import log disconnected. Polling will keep updating while a job runs.',
      );
    };

    return () => {
      isDisposed = true;
      stream.close();
    };
  }, []);

  useEffect(() => {
    if (!runningImport && !snapshot?.running) return;

    const poll = window.setInterval(() => {
      void (async () => {
        try {
          const res = await apiFetch('/api/admin/import/state');
          const body = (await res.json().catch(() => null)) as ImportSnapshot | null;
          if (!res.ok || !body) return;
          setSnapshot(body);
          setRunningImport(body.running);
          if (!body.running) {
            setErrorMessage((prev) => (prev?.includes('already running') ? prev : null));
          }
        } catch {
          // ignore transient poll errors
        }
      })();
    }, 2000);

    return () => window.clearInterval(poll);
  }, [runningImport, snapshot?.running]);

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
    if (snapshot.error && !snapshot.startedAt) {
      return 'Import lock may be stuck. Use Reset import lock below, then try again.';
    }
    if (!snapshot.startedAt) return 'No import run has been started yet.';
    if (snapshot.error) return `Last run #${snapshot.runId} failed.`;
    return `Last run #${snapshot.runId} finished ${snapshot.finishedAt ? 'successfully' : 'with unknown state'}.`;
  }, [snapshot]);

  const refreshImportState = async (): Promise<ImportSnapshot | null> => {
    const res = await apiFetch('/api/admin/import/state');
    const body = (await res.json().catch(() => null)) as ImportSnapshot | { error?: string } | null;
    if (!res.ok || !body || !('runId' in body)) {
      const message =
        body && 'error' in body && typeof body.error === 'string'
          ? body.error
          : 'Failed to load import state.';
      throw new Error(message);
    }
    const snapshot = body as ImportSnapshot;
    setSnapshot(snapshot);
    setRunningImport(snapshot.running);
    return snapshot;
  };

  const resetImportLock = async () => {
    setErrorMessage(null);
    try {
      const res = await apiFetch('/api/admin/import/reset', { method: 'POST' });
      const body = (await res.json().catch(() => null)) as {
        snapshot?: ImportSnapshot;
        error?: string;
      } | null;
      if (!res.ok || body?.error) {
        throw new Error(body?.error || 'Failed to reset import lock.');
      }
      if (body?.snapshot) {
        setSnapshot(body.snapshot);
        setRunningImport(body.snapshot.running);
      } else {
        await refreshImportState();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reset import lock.');
    }
  };

  const runImport = async (options?: RunImportOptions) => {
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
      if (body?.snapshot) {
        setSnapshot(body.snapshot);
        setRunningImport(body.snapshot.running);
      }
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to start import.');
      }
      if (body && body.started === false) {
        setRunningImport(false);
        throw new Error(body.error || 'Import did not start.');
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

  const stepOutcomes = useMemo(() => {
    const summary = snapshot?.summary;
    if (!summary) return new Map<PipelineStepKey, StepSummaryBase>();
    return new Map(
      PIPELINE_STEPS.map(({ key }) => [
        key,
        summary[key as ImportSummaryStepKey] as StepSummaryBase,
      ]),
    );
  }, [snapshot?.summary]);

  const forcedStepSet = useMemo(() => new Set(forcedSteps), [forcedSteps]);

  const toggleForcedStep = (key: PipelineStepKey, checked: boolean) => {
    setForcedSteps((prev) => {
      if (checked) return prev.includes(key) ? prev : [...prev, key];
      return prev.filter((step) => step !== key);
    });
  };

  const clearForcedSteps = () => {
    setForcedSteps([]);
  };

  return (
    <>
      <div className="glass-surface space-y-5 p-6">
        <div>
          <h2 className="text-foreground mb-2 text-lg font-semibold">Data Import</h2>
          <p className="text-muted text-xs">
            Run the full pipeline with smart skips, or force individual steps when you need a
            targeted refresh. Overframe steps are manual-only; wiki covers fire behaviors and
            Helminth flags.
          </p>
        </div>

        <p className="text-muted text-sm" role="status">
          {statusText}
        </p>
        {errorMessage ? (
          <p className="text-danger text-sm" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {errorMessage?.includes('already running') ? (
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => {
              void resetImportLock();
            }}
          >
            Reset import lock
          </button>
        ) : null}

        <div>
          <h3 className="text-foreground mb-2 text-sm font-semibold">Quick actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-accent text-sm"
              onClick={() => {
                void runImport();
              }}
              disabled={runningImport}
            >
              {runningImport ? 'Import running...' : 'Run Full Import'}
            </button>
            <button
              type="button"
              className="btn btn-secondary text-warning text-sm"
              onClick={() => setConfirmForceImport(true)}
              disabled={runningImport}
            >
              Force Full Re-import
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => {
                void runImport({ forceImages: true });
              }}
              disabled={runningImport}
            >
              Re-download Images
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => setShowLogs(true)}
            >
              View Live Log
            </button>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-foreground text-sm font-semibold">Force selected steps</h3>
              <p className="text-muted mt-1 text-xs">
                Runs the full pipeline but overrides skip logic for checked steps. Other steps still
                follow normal missing-data rules.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => setForcedSteps(PIPELINE_STEPS.map((step) => step.key))}
                disabled={runningImport}
              >
                Select all
              </button>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={clearForcedSteps}
                disabled={runningImport || forcedSteps.length === 0}
              >
                Clear
              </button>
            </div>
          </div>

          <ul className="list-none space-y-1">
            {PIPELINE_STEPS.map(({ key, label, description }) => {
              const step = stepOutcomes.get(key);
              const checked = forcedStepSet.has(key);
              return (
                <li
                  key={key}
                  className="border-border/60 border-b border-dashed py-3 last:border-0"
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="accent-accent mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                      checked={checked}
                      disabled={runningImport}
                      onChange={(event) => toggleForcedStep(key, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-foreground text-sm font-medium">{label}</span>
                        {step ? (
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${outcomeBadgeClass(step.outcome)}`}
                          >
                            {step.outcome}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted mt-1 block text-xs leading-snug">
                        {description}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-accent text-sm"
              onClick={() => {
                void runImport({ forceSteps: forcedSteps });
              }}
              disabled={runningImport || forcedSteps.length === 0}
            >
              {runningImport
                ? 'Import running...'
                : forcedSteps.length === 0
                  ? 'Run with forced steps'
                  : `Run with ${forcedSteps.length} forced step${forcedSteps.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>

        <Modal
          open={showLogs}
          onClose={() => setShowLogs(false)}
          ariaLabelledBy="armory-import-log-title"
          className="glass-modal-surface armory-import-modal"
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
                  className="btn btn-secondary text-sm"
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
              ) : snapshot?.error ? (
                <div className="text-danger">{snapshot.error}</div>
              ) : snapshot?.running ? (
                <div className="text-muted">Waiting for pipeline output…</div>
              ) : (
                <div className="text-muted">No output yet.</div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-cancel text-sm"
                onClick={() => setShowLogs(false)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      </div>

      <Modal
        open={confirmForceImport}
        onClose={() => setConfirmForceImport(false)}
        ariaLabelledBy="armory-force-import-title"
        className="glass-modal-surface max-w-md"
      >
        <h3 id="armory-force-import-title" className="text-foreground mb-2 text-lg font-semibold">
          Reset catalog and re-import?
        </h3>
        <p className="text-muted text-sm">
          This wipes all catalog game data (warframes, mods, abilities, archon shards, etc.) and
          re-downloads exports. Saved builds and loadouts in the user database are not affected.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-cancel text-sm"
            onClick={() => setConfirmForceImport(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger text-sm"
            onClick={() => {
              setConfirmForceImport(false);
              void runImport({ forceImport: true, forceImages: true });
            }}
            disabled={runningImport}
          >
            Reset catalog and re-import
          </button>
        </div>
      </Modal>

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
