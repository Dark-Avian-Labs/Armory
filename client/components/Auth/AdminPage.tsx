import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '../../utils/api';
import { ArtifactSlotsAdminTool } from '../Admin/ArtifactSlotsAdminTool';

interface SyncLogLine {
  ts: string;
  level: 'info' | 'error';
  message: string;
}

interface CatalogSyncSummary {
  tables: Record<string, number>;
  imagesCopied: number;
  imagesSkipped: number;
  sourceDb: string;
  imagesSource: string;
}

interface SyncSnapshot {
  runId: number;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  lines: SyncLogLine[];
  summary: CatalogSyncSummary | null;
  error: string | null;
}

function parseSnapshot(body: unknown): SyncSnapshot | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as { snapshot?: SyncSnapshot } & SyncSnapshot;
  return record.snapshot ?? record;
}

export function AdminPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="glass-shell p-6">
        <h1 className="text-foreground text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted mt-1 text-sm">Catalog sync and artifact slot tools.</p>
      </div>
      <ArtifactSlotsAdminTool />
      <CodexCatalogSyncAdmin />
    </div>
  );
}

function CodexCatalogSyncAdmin() {
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const expandLog = Boolean(snapshot?.running || (snapshot?.lines.length ?? 0) > 0);

  const applySnapshot = useCallback((next: SyncSnapshot) => {
    setSnapshot(next);
    if (next.running) {
      setError((previous) => (previous?.includes('already running') ? previous : null));
    }
  }, []);

  const loadStatus = useCallback(async () => {
    const response = await apiFetch('/api/admin/catalog/sync/status');
    if (!response.ok) throw new Error('Failed to load sync status');
    const body = parseSnapshot(await response.json());
    if (!body) throw new Error('Failed to parse sync status');
    applySnapshot(body);
  }, [applySnapshot]);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      try {
        await loadStatus();
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Failed to load status');
        }
      }
    })();

    const stream = new EventSource('/api/admin/catalog/sync/stream', { withCredentials: true });
    stream.onopen = () => {
      if (disposed) return;
      setError((previous) =>
        previous === 'Live sync log disconnected. Polling will keep updating while a job runs.'
          ? null
          : previous,
      );
    };
    stream.addEventListener('snapshot', (event) => {
      if (disposed) return;
      try {
        const next = parseSnapshot(JSON.parse((event as MessageEvent).data));
        if (next) applySnapshot(next);
      } catch {
        // ignore
      }
    });
    stream.onerror = () => {
      if (disposed) return;
      setError((previous) =>
        previous?.includes('already running')
          ? previous
          : 'Live sync log disconnected. Polling will keep updating while a job runs.',
      );
    };

    return () => {
      disposed = true;
      stream.close();
    };
  }, [applySnapshot, loadStatus]);

  useEffect(() => {
    if (!snapshot?.running) return undefined;

    const poll = window.setInterval(() => {
      void loadStatus().catch(() => {
        // ignore
      });
    }, 2000);

    return () => window.clearInterval(poll);
  }, [loadStatus, snapshot?.running]);

  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [snapshot?.lines.length, snapshot?.running]);

  const startSync = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await apiFetch('/api/admin/catalog/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = (await response.json().catch(() => null)) as
        | ({ error?: string; snapshot?: SyncSnapshot } & SyncSnapshot)
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to start catalog sync');
      }
      const next = parseSnapshot(body);
      if (next) applySnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start catalog sync');
    } finally {
      setStarting(false);
    }
  }, [applySnapshot]);

  const lines = snapshot?.lines ?? [];
  const tableEntries = snapshot?.summary
    ? Object.entries(snapshot.summary.tables).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div
      className={`glass-surface flex min-h-0 flex-col gap-3 p-5 ${expandLog ? 'flex-1 overflow-hidden' : ''}`}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Catalog sync</h2>
          <p className="text-muted mt-1 text-sm">
            Copy Codex&apos;s warframe-catalog.db and images into Armory. Codex owns the DE/wiki
            import; Armory keeps a local catalog copy for the mod builder.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void startSync()}
          disabled={starting || snapshot?.running}
        >
          {snapshot?.running ? 'Syncing…' : starting ? 'Starting…' : 'Sync catalog from Codex'}
        </button>
      </div>
      {error ? (
        <p className="text-danger shrink-0 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {snapshot?.summary ? (
        <div className="text-muted shrink-0 space-y-1 text-sm">
          <p>
            Images: {snapshot.summary.imagesCopied} copied, {snapshot.summary.imagesSkipped}{' '}
            skipped.
          </p>
          {tableEntries.length > 0 ? (
            <p>Tables: {tableEntries.map(([name, count]) => `${name} ${count}`).join(', ')}.</p>
          ) : null}
        </div>
      ) : null}
      {snapshot?.error ? (
        <p className="text-danger shrink-0 text-sm" role="alert">
          {snapshot.error}
        </p>
      ) : null}
      <div
        ref={logContainerRef}
        className={
          expandLog
            ? 'min-h-48 flex-1 overflow-y-auto rounded-lg border border-[var(--color-glass-border)] bg-black/20 p-3 font-mono text-xs leading-relaxed'
            : 'max-h-48 overflow-y-auto rounded-lg border border-[var(--color-glass-border)] bg-black/20 p-3 font-mono text-xs leading-relaxed'
        }
      >
        {lines.length === 0 ? (
          <p className="text-muted">Sync log will appear here.</p>
        ) : (
          lines.map((line, index) => (
            <div
              key={`${line.ts}-${index}`}
              className={line.level === 'error' ? 'text-danger' : ''}
            >
              [{line.ts}] {line.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
