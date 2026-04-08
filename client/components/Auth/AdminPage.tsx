import { useEffect, useMemo, useRef, useState } from 'react';

import { useApi } from '../../hooks/useApi';
import { apiFetch } from '../../utils/api';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Modal } from '../ui/Modal';

interface ShardBuff {
  id: number;
  shard_type_id: string;
  description: string;
  base_value: number;
  tauforged_value: number;
  value_format: string;
}

interface ShardType {
  id: string;
  name: string;
  icon_path: string;
  tauforged_icon_path: string;
  buffs: ShardBuff[];
}

interface ImportLogLine {
  ts: string;
  level: 'info' | 'error';
  message: string;
}

interface ImportSummary {
  durationMs: number;
  blockingIssues: string[];
  sqliteFromExports: { outcome: 'ok' | 'skipped' | 'failed' | 'partial'; reason: string };
  officialExports: { outcome: 'ok' | 'skipped' | 'failed' | 'partial' };
  images: { outcome: 'ok' | 'skipped' | 'failed' | 'partial' };
  overframe: { outcome: 'ok' | 'skipped' | 'failed' | 'partial' };
  wiki: { outcome: 'ok' | 'skipped' | 'failed' | 'partial' };
}

interface ImportSnapshot {
  runId: number;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  requestedByUserId: number | null;
  lines: ImportLogLine[];
  summary: ImportSummary | null;
  error: string | null;
}

export function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="glass-shell p-6">
        <h1 className="text-foreground text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted mt-1 text-sm">
          Data import controls and Archon Shard configuration.
        </p>
      </div>
      <DataImportAdmin />
      <ArchonShardAdmin />
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

  const runImport = async () => {
    setErrorMessage(null);
    setShowLogs(true);
    setRunningImport(true);
    try {
      const response = await apiFetch('/api/admin/import/run', { method: 'POST' });
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
    <div className="glass-surface p-6">
      <h2 className="text-foreground mb-3 text-lg font-semibold">Data Import</h2>
      <p className="text-muted mb-3 text-xs">
        Run the full data pipeline manually (official exports, DB processing, Overframe sync, wiki
        enrichments, image updates).
      </p>
      <p className="text-muted mb-4 text-sm" role="status">
        {statusText}
      </p>
      {snapshot?.summary ? (
        <div className="text-muted mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span>Duration: {(snapshot.summary.durationMs / 1000).toFixed(1)}s</span>
          <span>Exports: {snapshot.summary.officialExports.outcome}</span>
          <span>DB import: {snapshot.summary.sqliteFromExports.outcome}</span>
          <span>Images: {snapshot.summary.images.outcome}</span>
          <span>Overframe: {snapshot.summary.overframe.outcome}</span>
          <span>Wiki: {snapshot.summary.wiki.outcome}</span>
        </div>
      ) : null}
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
          className="glass-button-secondary text-sm"
          onClick={() => setShowLogs(true)}
        >
          View Live Log
        </button>
      </div>

      <Modal
        open={showLogs}
        onClose={() => setShowLogs(false)}
        ariaLabelledBy="parametric-import-log-title"
        className="import-log-modal"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="parametric-import-log-title" className="text-foreground text-lg font-semibold">
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
  );
}

function ArchonShardAdmin() {
  const { data, loading, error, refetch } = useApi<{ shards: ShardType[] }>('/api/archon-shards');
  const shards = data?.shards || [];
  const [editingBuff, setEditingBuff] = useState<ShardBuff | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const handleApiCall = async (
    apiCall: () => Promise<Response>,
    successMessage: string,
    failureMessage: string,
  ) => {
    try {
      const response = await apiCall();
      if (!response.ok) {
        throw new Error(failureMessage);
      }
      setStatusMessage(successMessage);
      setErrorMessage(null);
      refetch();
      return true;
    } catch {
      setStatusMessage(null);
      setErrorMessage(failureMessage);
      return false;
    }
  };

  const handleSaveBuff = async () => {
    if (!editingBuff) return;
    const didSave = await handleApiCall(
      () =>
        apiFetch(`/api/archon-shards/buffs/${editingBuff.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingBuff),
        }),
      'Shard buff saved.',
      'Failed to save shard buff.',
    );
    if (didSave) {
      setEditingBuff(null);
    }
  };

  const closeDeleteConfirm = () => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const handleDeleteBuff = (id: number) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDeleteBuff = async () => {
    if (pendingDeleteId === null) return;
    const didDelete = await handleApiCall(
      () =>
        apiFetch(`/api/archon-shards/buffs/${pendingDeleteId}`, {
          method: 'DELETE',
        }),
      'Shard buff deleted.',
      'Failed to delete shard buff.',
    );
    if (didDelete) {
      closeDeleteConfirm();
    }
  };

  const handleAddBuff = async (shardTypeId: string) => {
    await handleApiCall(
      () =>
        apiFetch('/api/archon-shards/buffs', {
          method: 'POST',
          body: JSON.stringify({
            shard_type_id: shardTypeId,
            description: 'New Buff',
            base_value: 0,
            tauforged_value: 0,
            value_format: '%',
            sort_order: 99,
          }),
        }),
      'Shard buff added.',
      'Failed to add shard buff.',
    );
  };

  return (
    <>
      <div className="glass-surface p-6">
        <h2 className="text-foreground mb-4 text-lg font-semibold">Archon Shards</h2>
        <p className="text-muted mb-3 text-xs">Edit shard types and their buff values.</p>
        {statusMessage ? (
          <p className="text-success mb-3 text-sm" role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage || error ? (
          <p className="text-danger mb-3 text-sm" role="alert" aria-live="assertive">
            {errorMessage || error}
          </p>
        ) : null}
        {loading ? (
          <p className="text-muted mb-3 text-sm" role="status" aria-live="polite">
            Loading archon shard configuration...
          </p>
        ) : null}

        <div className="space-y-4">
          {shards.map((shard) => (
            <div key={shard.id} className="glass-surface rounded-lg p-3">
              <div className="mb-2 flex items-center gap-2">
                <img src={shard.icon_path} alt="" className="h-5 w-5 object-contain" />
                <span className="text-foreground text-sm font-semibold">{shard.name}</span>
              </div>
              <div className="space-y-1">
                {shard.buffs.map((buff) => (
                  <div key={buff.id} className="flex items-center gap-2 text-xs">
                    {editingBuff?.id === buff.id ? (
                      <>
                        <input
                          type="text"
                          aria-label={`Description for ${shard.name} buff`}
                          value={editingBuff.description}
                          onChange={(e) =>
                            setEditingBuff({
                              ...editingBuff,
                              description: e.target.value,
                            })
                          }
                          className="form-input flex-1 text-xs"
                        />
                        <input
                          type="number"
                          aria-label={`Base value for ${shard.name} buff`}
                          value={editingBuff.base_value}
                          onChange={(e) =>
                            setEditingBuff({
                              ...editingBuff,
                              base_value: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="form-input w-16 text-xs"
                          step="0.1"
                        />
                        <input
                          type="number"
                          aria-label={`Tauforged value for ${shard.name} buff`}
                          value={editingBuff.tauforged_value}
                          onChange={(e) =>
                            setEditingBuff({
                              ...editingBuff,
                              tauforged_value: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="form-input w-16 text-xs"
                          step="0.1"
                        />
                        <select
                          aria-label={`Value format for ${shard.name} buff`}
                          value={editingBuff.value_format}
                          onChange={(e) =>
                            setEditingBuff({
                              ...editingBuff,
                              value_format: e.target.value,
                            })
                          }
                          className="form-input w-16 text-xs"
                        >
                          <option value="%">%</option>
                          <option value="+flat">+flat</option>
                          <option value="/s">/s</option>
                          <option value="proc">proc</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleSaveBuff}
                          className="text-success hover:text-success/80"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBuff(null)}
                          className="text-muted hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-muted flex-1">{buff.description}</span>
                        <span className="text-foreground w-16 text-center">{buff.base_value}</span>
                        <span className="text-warning w-16 text-center">
                          {buff.tauforged_value}
                        </span>
                        <span className="text-muted/50 w-10 text-center">{buff.value_format}</span>
                        <button
                          type="button"
                          onClick={() => setEditingBuff({ ...buff })}
                          className="text-accent hover:text-accent/80"
                          aria-label={`Edit buff ${buff.description}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBuff(buff.id)}
                          className="text-danger hover:text-danger/80"
                          aria-label={`Delete buff ${buff.description}`}
                        >
                          &times;
                        </button>
                      </>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddBuff(shard.id)}
                  className="text-accent hover:text-accent/80 mt-1 text-xs"
                  aria-label={`Add buff for ${shard.name}`}
                >
                  + Add buff
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmModal
        open={confirmOpen}
        title="Delete shard buff?"
        message="This will permanently remove the selected buff."
        confirmLabel="Delete"
        onConfirm={() => {
          void handleConfirmDeleteBuff();
        }}
        onCancel={closeDeleteConfirm}
      />
    </>
  );
}
