import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { APP_PATHS, buildReadOnlyPath } from '../../app/paths';
import { EQUIPMENT_TYPE_LABELS, type EquipmentType } from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { normalizeEquipmentName } from '../../utils/specialItems';

type BuildListItem = {
  id: number;
  name: string;
  equipment_type: string;
  equipment_unique_name: string;
  equipment_name: string;
  equipment_image?: string;
  updated_at: string;
  owner_user_id: number;
  owner_username: string | null;
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
        const body = (await res.json()) as { builds?: BuildListItem[] };
        if (!alive) return;
        const rows = Array.isArray(body.builds) ? body.builds : [];
        setBuilds(rows);
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

  return (
    <div className="mx-auto max-w-[2000px] space-y-4">
      <div className="glass-shell flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-[color,background-color,border-color] duration-200"
          onClick={() => navigate(APP_PATHS.buildsExplore)}
          aria-label="Back to equipment categories"
        >
          ←
        </button>
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-lg font-semibold">
            {normalizeEquipmentName(equipmentLabel || decodedUnique)}
          </h1>
          <p className="text-muted text-xs">
            {builds.length} build{builds.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="glass-shell overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-muted text-sm">Loading builds...</p>
          </div>
        ) : error ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-danger text-sm">{error}</p>
          </div>
        ) : builds.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-muted text-sm">No builds found.</p>
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
                      {b.owner_username ? `by ${b.owner_username}` : `User #${b.owner_user_id}`}
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
