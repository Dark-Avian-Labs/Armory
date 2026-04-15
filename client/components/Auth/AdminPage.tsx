import { useEffect, useMemo, useRef, useState } from 'react';

import { useApi } from '../../hooks/useApi';
import { apiFetch } from '../../utils/api';
import type { ShardType } from '../ModBuilder/ArchonShardSlots';
import { Modal } from '../ui/Modal';

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
          Data import controls and read-only Archon Shard data from the wiki pipeline.
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

const SHARD_TABLE_ICON_FALLBACK = '/icons/shards/emptyBackground.png';

function shardTableIconSrc(iconPath: unknown): string {
  if (typeof iconPath === 'string' && iconPath.trim() !== '') {
    return iconPath.trim();
  }
  return SHARD_TABLE_ICON_FALLBACK;
}

function ArchonShardAdmin() {
  const { data, loading, error } = useApi<{ shards: ShardType[] }>('/api/archon-shards');
  const shards = data?.shards || [];

  return (
    <div className="glass-surface p-6">
      <h2 className="text-foreground mb-3 text-lg font-semibold">Archon Shards</h2>
      <p className="text-muted mb-4 text-xs">
        Shard types and buffs from the wiki import pipeline (read-only). Run a full import to
        refresh.
      </p>
      {error ? (
        <p className="text-danger mb-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-muted text-sm" role="status" aria-live="polite">
          Loading archon shard data...
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-glass)]/40">
          <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-glass-border)] bg-[var(--color-glass)]/60">
                <th className="text-foreground px-3 py-2 font-semibold">Shard</th>
                <th className="text-foreground px-3 py-2 font-semibold">Buff</th>
                <th className="text-foreground w-20 px-3 py-2 font-semibold">Base</th>
                <th className="text-foreground w-20 px-3 py-2 font-semibold">Tauforged</th>
                <th className="text-foreground w-16 px-3 py-2 font-semibold">Format</th>
              </tr>
            </thead>
            <tbody>
              {shards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted px-3 py-4 text-center">
                    No shard data in the database yet.
                  </td>
                </tr>
              ) : (
                shards.flatMap((shard) =>
                  shard.buffs.length === 0
                    ? [
                        <tr key={shard.id}>
                          <td className="border-border/40 border-t px-3 py-2 align-top">
                            <div className="flex items-center gap-2">
                              <img
                                src={shardTableIconSrc(shard.icon_path)}
                                alt={`${shard.name} shard icon`}
                                className="h-5 w-5 object-contain"
                              />
                              <span className="text-foreground font-medium">{shard.name}</span>
                            </div>
                          </td>
                          <td
                            colSpan={4}
                            className="border-border/40 text-muted border-t px-3 py-2 italic"
                          >
                            No buffs recorded
                          </td>
                        </tr>,
                      ]
                    : shard.buffs.map((buff, buffIdx) => (
                        <tr key={buff.id} className="border-border/40 border-t">
                          {buffIdx === 0 ? (
                            <td className="px-3 py-2 align-top" rowSpan={shard.buffs.length}>
                              <div className="flex items-center gap-2">
                                <img
                                  src={shardTableIconSrc(shard.icon_path)}
                                  alt={`${shard.name} shard icon`}
                                  className="h-5 w-5 object-contain"
                                />
                                <span className="text-foreground font-medium">{shard.name}</span>
                              </div>
                            </td>
                          ) : null}
                          <td className="text-muted px-3 py-2">{buff.description}</td>
                          <td className="text-foreground px-3 py-2 tabular-nums">
                            {buff.base_value}
                          </td>
                          <td className="text-warning px-3 py-2 tabular-nums">
                            {buff.tauforged_value}
                          </td>
                          <td className="text-muted px-3 py-2">{buff.value_format}</td>
                        </tr>
                      )),
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
