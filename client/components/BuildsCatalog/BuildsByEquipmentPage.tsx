import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { APP_PATHS, buildLoadoutPath, buildReadOnlyPath, userBuildsPath } from '../../app/paths';
import { EQUIPMENT_TYPE_LABELS, type EquipmentType } from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { normalizeEquipmentName } from '../../utils/specialItems';
import { MaterialSymbol } from '../ui/MaterialSymbol';

type BuildListItem = {
  id: number;
  name: string;
  equipment_type: string;
  equipment_unique_name: string;
  equipment_name: string;
  equipment_image?: string;
  updated_at: string;
  owner_user_id: string;
  owner_username: string | null;
  owner_deleted?: boolean;
};

const DELETED_USER_LABEL = '[Deleted User]';

function OwnerAttribution({
  owner_username,
  owner_user_id,
  owner_deleted,
}: {
  owner_username: string | null;
  owner_user_id: string;
  owner_deleted?: boolean;
}) {
  if (owner_deleted || owner_username === DELETED_USER_LABEL) {
    return <span>{DELETED_USER_LABEL}</span>;
  }
  if (owner_username) {
    return (
      <Link
        to={userBuildsPath(owner_username)}
        className="hover:text-accent transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        by {owner_username}
      </Link>
    );
  }
  return <span>User #{owner_user_id}</span>;
}

type LoadoutListItem = {
  id: string;
  name: string;
  owner_user_id: string;
  owner_username: string | null;
  owner_deleted?: boolean;
  visibility: string;
  updated_at: string;
  is_own: boolean;
};

const VALID_EQUIPMENT_TYPE_ROUTE = new Set<string>([
  ...(Object.keys(EQUIPMENT_TYPE_LABELS) as EquipmentType[]),
  'companion_weapon',
]);

function parseEquipmentTypeParam(raw: string | undefined): EquipmentType | 'companion_weapon' | '' {
  if (raw == null || raw === '') return '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '';
  }
  if (!VALID_EQUIPMENT_TYPE_ROUTE.has(decoded)) return '';
  return decoded as EquipmentType | 'companion_weapon';
}

export function BuildsByEquipmentPage() {
  const { equipmentType: equipmentTypeParam, equipmentUniqueName: equipmentUniqueParam } =
    useParams<{
      equipmentType: string;
      equipmentUniqueName: string;
    }>();
  const navigate = useNavigate();

  const equipmentType = parseEquipmentTypeParam(equipmentTypeParam);

  const [builds, setBuilds] = useState<BuildListItem[]>([]);
  const [loadouts, setLoadouts] = useState<LoadoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipmentLabel, setEquipmentLabel] = useState<string>('');

  const decodedUnique = useMemo(
    () => (equipmentUniqueParam ? decodeURIComponent(equipmentUniqueParam) : ''),
    [equipmentUniqueParam],
  );

  useEffect(() => {
    if (!equipmentType || !decodedUnique) return;

    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          equipment_type: equipmentType,
          equipment_unique_name: decodedUnique,
        });
        const res = await apiFetch(`/api/builds/by-equipment?${qs.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load builds (${res.status})`);
        }
        const body = (await res.json()) as {
          builds?: BuildListItem[];
          loadouts?: LoadoutListItem[];
        };
        if (!alive) return;
        const rows = Array.isArray(body.builds) ? body.builds : [];
        const lo = Array.isArray(body.loadouts) ? body.loadouts : [];
        setBuilds(rows);
        setLoadouts(lo);
        if (rows.length > 0 && rows[0].equipment_name) {
          setEquipmentLabel(rows[0].equipment_name);
        } else {
          setEquipmentLabel(decodedUnique);
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to load builds');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [equipmentType, decodedUnique]);

  if (!equipmentType || !decodedUnique) {
    return (
      <div className="mx-auto max-w-[2000px]">
        <div className="glass-shell p-6">
          <p className="text-muted text-sm">Invalid equipment path.</p>
          <Link className="text-accent mt-3 inline-block text-sm" to={APP_PATHS.buildsExplore}>
            Back to Builds
          </Link>
        </div>
      </div>
    );
  }

  const hasAny = builds.length > 0 || loadouts.length > 0;

  return (
    <div className="mx-auto max-w-[2000px] space-y-4">
      <div className="glass-shell flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-[color,background-color,border-color] duration-200"
          onClick={() => navigate(APP_PATHS.buildsExplore)}
          aria-label="Back to equipment categories"
        >
          <MaterialSymbol name="arrow_back" style={{ fontSize: 22 }} />
        </button>
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-lg font-semibold">
            {normalizeEquipmentName(equipmentLabel || decodedUnique)}
          </h1>
          <p className="text-muted text-xs">
            {builds.length} build{builds.length === 1 ? '' : 's'}
            {loadouts.length > 0 ? (
              <>
                {' '}
                · {loadouts.length} loadout{loadouts.length === 1 ? '' : 's'}
              </>
            ) : null}
          </p>
        </div>
      </div>

      {loadouts.length > 0 ? (
        <div className="glass-shell overflow-hidden">
          <div className="border-glass-divider bg-glass-hover/50 border-b px-4 py-2.5">
            <h2 className="text-muted text-sm font-semibold tracking-wider uppercase">Loadouts</h2>
          </div>
          <div className="divide-glass-divider divide-y">
            {loadouts.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => navigate(buildLoadoutPath(l.id))}
                className="hover:bg-glass-hover flex w-full items-center gap-3 px-4 py-3 text-left transition-[background-color] duration-200"
              >
                <div className="bg-glass flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <MaterialSymbol name="layers" style={{ fontSize: 22 }} className="text-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate text-sm font-medium">{l.name}</div>
                  <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="truncate">
                      <OwnerAttribution
                        owner_username={l.owner_username}
                        owner_user_id={l.owner_user_id}
                        owner_deleted={l.owner_deleted}
                      />
                    </span>
                    {l.visibility === 'public' ? (
                      <span className="text-success/90 text-[10px] font-semibold uppercase">
                        Public
                      </span>
                    ) : null}
                    {l.is_own ? (
                      <span className="text-accent text-[10px] font-semibold uppercase">Yours</span>
                    ) : null}
                    <span className="text-muted/50">
                      {new Date(l.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="glass-shell overflow-hidden">
        <div className="border-glass-divider bg-glass-hover/50 border-b px-4 py-2.5">
          <h2 className="text-muted text-sm font-semibold tracking-wider uppercase">Builds</h2>
        </div>
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-muted text-sm">Loading builds...</p>
          </div>
        ) : error ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-danger text-sm">{error}</p>
          </div>
        ) : !hasAny ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-muted text-sm">No builds or loadouts found.</p>
          </div>
        ) : builds.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-muted text-sm">No individual builds listed for this item.</p>
          </div>
        ) : (
          <div className="divide-glass-divider divide-y">
            {builds.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => navigate(buildReadOnlyPath(String(b.id)))}
                className="hover:bg-glass-hover flex w-full items-center gap-3 px-4 py-3 text-left transition-[background-color] duration-200"
              >
                <div className="bg-glass flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  {b.equipment_image ? (
                    <img
                      src={b.equipment_image}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-muted/50 text-xs">?</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate text-sm font-medium">{b.name}</div>
                  <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="truncate">
                      <OwnerAttribution
                        owner_username={b.owner_username}
                        owner_user_id={b.owner_user_id}
                        owner_deleted={b.owner_deleted}
                      />
                    </span>
                    <span className="text-muted/50">
                      {new Date(b.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
