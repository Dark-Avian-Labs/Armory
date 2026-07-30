import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { APP_PATHS, buildLoadoutPath, buildReadOnlyPath, userBuildsPath } from '../../app/paths';
import { EQUIPMENT_TYPE_LABELS, type EquipmentType, type StoredBuild } from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { getUsedFormaCost } from '../../utils/buildFormaCost';
import type { FormaCount } from '../../utils/formaCounter';
import { loadEquipmentLookup, type EquipmentPolaritySource } from '../../utils/loadEquipmentLookup';
import { resolveEquipmentDisplayName } from '../../utils/resolveEquipmentDisplayName';
import { FormaMetricChips } from '../shared/FormaMetricChips';
import { MaterialSymbol } from '../ui/MaterialSymbol';

type BuildListItem = {
  id: number;
  name: string;
  equipment_type: string;
  equipment_unique_name: string;
  equipment_name: string;
  equipment_image?: string;
  slots?: StoredBuild['slots'];
  updated_at: string;
  owner_user_id: string;
  owner_username: string | null;
  owner_deleted?: boolean;
};

const DELETED_USER_LABEL = '[Deleted User]';

function OwnerAttribution({
  owner_username,
  owner_deleted,
}: {
  owner_username: string | null;
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
  return <span>Another user</span>;
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

function toStoredBuildForForma(build: BuildListItem): StoredBuild {
  return {
    id: String(build.id),
    name: build.name,
    equipment_type: build.equipment_type as EquipmentType,
    equipment_unique_name: build.equipment_unique_name,
    equipment_name: build.equipment_name,
    equipment_image: build.equipment_image,
    slots: Array.isArray(build.slots) ? build.slots : [],
    created_at: build.updated_at,
    updated_at: build.updated_at,
  } as StoredBuild;
}

export function BuildsByEquipmentPage() {
  const { equipmentType: equipmentTypeParam, equipmentUniqueName: equipmentUniqueParam } =
    useParams<{
      equipmentType: string;
      equipmentUniqueName: string;
    }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const equipmentType = parseEquipmentTypeParam(equipmentTypeParam);

  const [builds, setBuilds] = useState<BuildListItem[]>([]);
  const [loadouts, setLoadouts] = useState<LoadoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipmentLabel, setEquipmentLabel] = useState<string>('');
  const [equipmentLookup, setEquipmentLookup] = useState<Record<string, EquipmentPolaritySource>>(
    {},
  );

  const decodedUnique = useMemo(
    () => (equipmentUniqueParam ? decodeURIComponent(equipmentUniqueParam) : ''),
    [equipmentUniqueParam],
  );

  const queryName = searchParams.get('name');

  useEffect(() => {
    let alive = true;

    void loadEquipmentLookup().then((nextLookup) => {
      if (alive) setEquipmentLookup(nextLookup);
    });

    return () => {
      alive = false;
    };
  }, []);

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
          limit: '500',
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
          setEquipmentLabel('');
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

  const displayName = useMemo(
    () =>
      resolveEquipmentDisplayName(decodedUnique, {
        queryName,
        catalogName: equipmentLookup[decodedUnique]?.name ?? null,
        storedName: equipmentLabel,
      }),
    [decodedUnique, queryName, equipmentLookup, equipmentLabel],
  );

  const usedFormaByBuildId = useMemo(() => {
    const counts: Record<number, FormaCount> = {};
    for (const build of builds) {
      counts[build.id] = getUsedFormaCost(toStoredBuildForForma(build), equipmentLookup);
    }
    return counts;
  }, [builds, equipmentLookup]);

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
          <h1 className="text-foreground truncate text-lg font-semibold">{displayName}</h1>
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
                className="hover:bg-glass-hover flex w-full items-center gap-5 px-4 py-5 text-left transition-[background-color] duration-200"
              >
                <div className="bg-glass flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <MaterialSymbol name="layers" style={{ fontSize: 36 }} className="text-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate text-base font-medium">{l.name}</div>
                  <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <span className="truncate">
                      <OwnerAttribution
                        owner_username={l.owner_username}
                        owner_deleted={l.owner_deleted}
                      />
                    </span>
                    {l.visibility === 'public' ? (
                      <span className="text-success/90 text-xs font-semibold uppercase">
                        Public
                      </span>
                    ) : null}
                    {l.is_own ? (
                      <span className="text-accent text-xs font-semibold uppercase">Yours</span>
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
                className="hover:bg-glass-hover flex w-full items-center gap-5 px-4 py-5 text-left transition-[background-color] duration-200"
              >
                <div className="bg-glass flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  {b.equipment_image ? (
                    <img
                      src={b.equipment_image}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-muted/50 text-sm">?</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate text-base font-medium">{b.name}</div>
                  <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <span className="truncate">
                      <OwnerAttribution
                        owner_username={b.owner_username}
                        owner_deleted={b.owner_deleted}
                      />
                    </span>
                    <span className="text-muted/50">
                      {new Date(b.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <FormaMetricChips
                    usedFormaCost={
                      usedFormaByBuildId[b.id] ?? {
                        regular: 0,
                        universal: 0,
                        umbra: 0,
                        stance: 0,
                        total: 0,
                      }
                    }
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
