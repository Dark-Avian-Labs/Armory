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

type SummaryOutcome = 'ok' | 'skipped' | 'failed' | 'partial';

interface ImportPipelineStats {
  requiredCount: number;
  downloaded: string[];
  skippedUnchanged: string[];
  failed: Array<{ category: string; error: string }>;
}

interface ImportSummary {
  durationMs: number;
  blockingIssues: string[];
  schema: { outcome: SummaryOutcome; detail?: string };
  officialExports: {
    outcome: SummaryOutcome;
    error?: string;
    stats?: ImportPipelineStats;
  };
  sqliteFromExports: {
    outcome: SummaryOutcome;
    reason: string;
    rows?: {
      warframes: number;
      weapons: number;
      companions: number;
      mods: number;
      modSets: number;
      arcanes: number;
      abilities: number;
    };
    modDescriptionsBackfilled?: number;
    error?: string;
  };
  exaltedStanceMods: {
    outcome: SummaryOutcome;
    reason?: string;
    found?: number;
    insertedOrUpdated?: number;
    error?: string;
  };
  images: {
    outcome: SummaryOutcome;
    total?: number;
    downloaded?: number;
    skipped?: number;
    failed?: number;
    error?: string;
  };
  hiddenCompanionWeapons: {
    outcome: SummaryOutcome;
    reason?: string;
    found?: number;
    insertedOrUpdated?: number;
    error?: string;
  };
  overframe: {
    outcome: SummaryOutcome;
    totalIndexed?: number;
    matchedNeedingWork?: number;
    pagesScraped?: number;
    merge?: {
      warframesUpdated: number;
      weaponsUpdated: number;
      companionsUpdated: number;
      abilitiesUpdated: number;
      helminthUpdated: number;
    };
    skipReason?: string;
    error?: string;
  };
  wiki: {
    outcome: SummaryOutcome;
    merge?: {
      abilitiesUpdated: number;
      passivesUpdated: number;
      augmentsUpdated: number;
      shardTypes: number;
      shardBuffs: number;
      rivenDispositionsSyncedFromOmega: number;
      rivenDispositionsWikiFallback: number;
      weaponsProjectileSpeedsUpdated: number;
    };
    error?: string;
    skipReason?: string;
  };
  helminthFandom?: {
    outcome: SummaryOutcome;
    wikiNamesFound?: number;
    abilitiesFlagged?: number;
    fetchOk?: boolean;
    error?: string;
    skipReason?: string;
  };
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
  s: ImportSummary,
): Array<{ title: string; outcome: string; detail: string }> {
  const lines: Array<{ title: string; outcome: string; detail: string }> = [];

  lines.push({
    title: 'Schema',
    outcome: s.schema.outcome,
    detail: s.schema.detail ?? '—',
  });

  const ex = s.officialExports;
  if (ex.error) {
    lines.push({ title: 'Official exports', outcome: ex.outcome, detail: ex.error });
  } else if (ex.stats) {
    const st = ex.stats;
    const failedN = st.failed.length;
    lines.push({
      title: 'Official exports',
      outcome: ex.outcome,
      detail:
        `Required ${st.requiredCount}; updated ${st.downloaded.length}; unchanged ${st.skippedUnchanged.length}` +
        (failedN ? `; ${failedN} download failure(s)` : ''),
    });
  } else {
    lines.push({ title: 'Official exports', outcome: ex.outcome, detail: '—' });
  }

  const db = s.sqliteFromExports;
  lines.push({
    title: 'SQLite ← exports',
    outcome: db.outcome,
    detail:
      db.reason +
      (db.rows
        ? ` — ${db.rows.warframes} wf, ${db.rows.weapons} wp, ${db.rows.mods} mods, ${db.rows.abilities} abilities`
        : '') +
      (db.modDescriptionsBackfilled != null
        ? `; mod desc backfill ${db.modDescriptionsBackfilled}`
        : '') +
      (db.error ? ` (${db.error})` : ''),
  });

  const es = s.exaltedStanceMods;
  const esParts = [
    es.reason,
    es.found != null ? `${es.found} found, ${es.insertedOrUpdated ?? 0} upserted` : '',
    es.error,
  ].filter(Boolean);
  lines.push({
    title: 'Exalted stances',
    outcome: es.outcome,
    detail: esParts.length > 0 ? esParts.join(' — ') : '—',
  });

  const im = s.images;
  lines.push({
    title: 'Images',
    outcome: im.outcome,
    detail:
      im.total != null
        ? `${im.total} considered; ${im.downloaded ?? 0} dl, ${im.skipped ?? 0} skip, ${im.failed ?? 0} fail` +
          (im.error ? ` — ${im.error}` : '')
        : (im.error ?? '—'),
  });

  const hi = s.hiddenCompanionWeapons;
  const hiParts = [
    hi.reason,
    hi.found != null ? `${hi.found} pages, ${hi.insertedOrUpdated ?? 0} rows` : '',
    hi.error,
  ].filter(Boolean);
  lines.push({
    title: 'Hidden companions',
    outcome: hi.outcome,
    detail: hiParts.length > 0 ? hiParts.join(' — ') : '—',
  });

  const ov = s.overframe;
  const ovDetail =
    ov.skipReason ??
    (ov.totalIndexed != null
      ? `Index ${ov.totalIndexed}; need work ${ov.matchedNeedingWork ?? 0}; scraped ${ov.pagesScraped ?? 0}` +
        (ov.merge
          ? ` — merged wf ${ov.merge.warframesUpdated}, wp ${ov.merge.weaponsUpdated}, ab ${ov.merge.abilitiesUpdated}, helminth+${ov.merge.helminthUpdated}`
          : '')
      : '') + (ov.error ? ` — ${ov.error}` : '');
  lines.push({ title: 'Overframe', outcome: ov.outcome, detail: ovDetail || '—' });

  const wk = s.wiki;
  const wkDetail =
    wk.skipReason ??
    (wk.merge
      ? `Abilities ${wk.merge.abilitiesUpdated}, passives ${wk.merge.passivesUpdated}, augments ${wk.merge.augmentsUpdated}, shards ${wk.merge.shardTypes}/${wk.merge.shardBuffs}, riven Ω/Wiki ${wk.merge.rivenDispositionsSyncedFromOmega}/${wk.merge.rivenDispositionsWikiFallback}, proj ${wk.merge.weaponsProjectileSpeedsUpdated}`
      : '') + (wk.error ? ` — ${wk.error}` : '');
  lines.push({ title: 'Wiki', outcome: wk.outcome, detail: wkDetail || '—' });

  const hm = s.helminthFandom;
  if (hm) {
    const hmParts = [
      hm.skipReason,
      hm.wikiNamesFound != null
        ? `Wiki tokens ${hm.wikiNamesFound}, flagged ${hm.abilitiesFlagged ?? 0}`
        : '',
      hm.error,
    ].filter(Boolean);
    lines.push({
      title: 'Helminth (Fandom)',
      outcome: hm.outcome,
      detail: hmParts.length > 0 ? hmParts.join(' — ') : '—',
    });
  }

  return lines;
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
        enrichments, Helminth Fandom sync, image updates).
      </p>
      <p className="text-muted mb-4 text-sm" role="status">
        {statusText}
      </p>
      {snapshot?.summary ? (
        <div className="mb-4 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-glass)]/40 p-3">
          <p className="text-foreground mb-2 text-xs font-semibold">
            Last run summary ({(snapshot.summary.durationMs / 1000).toFixed(1)}s)
          </p>
          <ul className="max-h-64 list-none space-y-0 overflow-y-auto text-xs">
            {formatImportSummaryLines(snapshot.summary).map((row) => (
              <li
                key={row.title}
                className="border-border/60 flex flex-col gap-1 border-b border-dashed py-2 last:border-0 sm:flex-row sm:items-start sm:gap-3"
              >
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="text-foreground min-w-[10rem] font-medium">{row.title}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${outcomeBadgeClass(row.outcome as SummaryOutcome)}`}
                  >
                    {row.outcome}
                  </span>
                </div>
                <span className="text-muted min-w-0 flex-1 leading-snug">{row.detail}</span>
              </li>
            ))}
          </ul>
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
