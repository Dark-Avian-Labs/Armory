import { useEffect, useState } from 'react';

import { apiFetch } from '../../utils/api';

type LoadoutRow = {
  id: string;
  name: string;
  owner_username: string | null;
  is_own: boolean;
};

export function BuildLoadoutsPanel({ buildId }: { buildId: string }) {
  const [loadouts, setLoadouts] = useState<LoadoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await apiFetch(`/api/builds/${buildId}/loadouts`);
        if (!res.ok) {
          throw new Error(`Failed to load (${res.status})`);
        }
        const body = (await res.json()) as { loadouts?: LoadoutRow[] };
        if (!alive) return;
        setLoadouts(Array.isArray(body.loadouts) ? body.loadouts : []);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to load loadouts');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [buildId]);

  return (
    <div>
      <h3 className="text-muted mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
        Loadouts using this build
      </h3>
      {loading ? <p className="text-muted text-sm">Loading...</p> : null}
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {!loading && !error && loadouts.length === 0 ? (
        <p className="text-muted text-sm">No loadouts reference this build yet.</p>
      ) : null}
      <ul className="space-y-2">
        {loadouts.map((l) => (
          <li
            key={l.id}
            className="border-glass-border bg-glass/35 rounded-xl border px-3 py-2.5 text-sm"
          >
            <span className="text-foreground font-medium">{l.name}</span>
            {l.owner_username ? (
              <span className="text-muted ml-2 text-xs">({l.owner_username})</span>
            ) : null}
            {l.is_own ? (
              <span className="text-accent ml-2 text-[10px] font-semibold uppercase">Yours</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
