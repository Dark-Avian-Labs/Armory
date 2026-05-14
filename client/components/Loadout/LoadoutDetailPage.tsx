import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { APP_PATHS, buildReadOnlyPath } from '../../app/paths';
import type { Warframe, Weapon, ModSlot, EquipmentType, StoredBuild } from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { extractArchonShardBonuses } from '../../utils/archonShardBonuses';
import {
  type EquipmentLookupRow,
  getLoadoutSlotDisplayLabel,
} from '../../utils/buildCatalogCategory';
import { calculateWeaponDps } from '../../utils/damageCalc';
import { linkifyPlainText } from '../../utils/linkifyText';
import { parseStoredBuildFromApi } from '../../utils/parseStoredBuildFromApi';
import { calculateWarframeStats } from '../../utils/warframeCalc';
import { MaterialSymbol } from '../ui/MaterialSymbol';

type LookupRecord = Record<string, Record<string, unknown>>;

const WARFRAME_LIKE: EquipmentType[] = ['warframe', 'archwing', 'necramech'];
const WEAPON_LIKE: EquipmentType[] = [
  'primary',
  'secondary',
  'melee',
  'archgun',
  'archmelee',
  'beast_claws',
];

function isWarframeLike(t: EquipmentType): boolean {
  return WARFRAME_LIKE.includes(t);
}

function isWeaponLike(t: EquipmentType): boolean {
  return WEAPON_LIKE.includes(t);
}

export function LoadoutDetailPage() {
  const { loadoutId } = useParams<{ loadoutId: string }>();
  const navigate = useNavigate();
  const [loadoutName, setLoadoutName] = useState('');
  const [loadoutDescription, setLoadoutDescription] = useState('');
  const [visibility, setVisibility] = useState<string>('private');
  const [isOwn, setIsOwn] = useState(false);
  const [entries, setEntries] = useState<Array<{ slot_type: string; build: StoredBuild }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipmentLookup, setEquipmentLookup] = useState<LookupRecord>({});

  useEffect(() => {
    let alive = true;
    async function loadEquipment() {
      const endpoints = [
        '/api/warframes',
        '/api/companions',
        '/api/weapons?type=LongGuns',
        '/api/weapons?type=Pistols',
        '/api/weapons?type=Melee',
        '/api/weapons?type=SpaceGuns',
        '/api/weapons?type=SpaceMelee',
        '/api/weapons?type=SentinelWeapons',
        '/api/weapons?type=SpecialItems',
      ];
      const responses = await Promise.all(
        endpoints.map(async (url) => {
          try {
            const response = await apiFetch(url);
            if (!response.ok) return [] as Record<string, unknown>[];
            const body = (await response.json()) as { items?: Record<string, unknown>[] };
            return Array.isArray(body.items) ? body.items : [];
          } catch {
            return [] as Record<string, unknown>[];
          }
        }),
      );
      if (!alive) return;
      const next: LookupRecord = {};
      for (const items of responses) {
        for (const item of items) {
          const un = item.unique_name;
          if (typeof un !== 'string' || un.length === 0) continue;
          if (!next[un]) next[un] = item;
        }
      }
      setEquipmentLookup(next);
    }
    void loadEquipment();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loadoutId) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/loadouts/${encodeURIComponent(loadoutId)}`);
        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errBody?.error ?? `Failed to load loadout (${res.status})`);
        }
        const body = (await res.json()) as {
          loadout?: {
            name?: string;
            visibility?: string;
            description?: string | null;
            builds?: Array<{ slot_type: string; build?: Record<string, unknown> }>;
          };
          is_own?: boolean;
        };
        if (!alive) return;
        const lo = body.loadout;
        if (!lo) {
          setError('Invalid response');
          setEntries([]);
          return;
        }
        setLoadoutName(typeof lo.name === 'string' ? lo.name : 'Loadout');
        setLoadoutDescription(typeof lo.description === 'string' ? lo.description : '');
        setVisibility(typeof lo.visibility === 'string' ? lo.visibility : 'private');
        setIsOwn(body.is_own === true);
        const raw = Array.isArray(lo.builds) ? lo.builds : [];
        const parsed = raw
          .map((row) => {
            const b = row.build;
            if (!b || typeof b !== 'object') return null;
            const stored = parseStoredBuildFromApi(b as Record<string, unknown>);
            if (!stored) return null;
            return { slot_type: String(row.slot_type ?? ''), build: stored };
          })
          .filter((e): e is { slot_type: string; build: StoredBuild } => Boolean(e));
        setEntries(parsed);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to load loadout');
        setEntries([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadoutId]);

  const lookupRows = equipmentLookup as Record<string, EquipmentLookupRow>;

  return (
    <div className="mx-auto max-w-[2000px] space-y-4">
      <div className="glass-shell flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-[color,background-color,border-color] duration-200"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <MaterialSymbol name="arrow_back" style={{ fontSize: 22 }} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-foreground truncate text-lg font-semibold">
            {loadoutName || 'Loadout'}
          </h1>
          <p className="text-muted text-xs">
            {visibility === 'public'
              ? 'Public loadout'
              : visibility === 'unlisted'
                ? 'Unlisted'
                : 'Private'}{' '}
            · {entries.length} linked build{entries.length === 1 ? '' : 's'}
          </p>
        </div>
        {isOwn ? (
          <Link className="btn btn-secondary btn-sm" to={APP_PATHS.myBuilds}>
            Manage on My Builds
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="glass-shell flex h-48 items-center justify-center">
          <p className="text-muted text-sm">Loading loadout…</p>
        </div>
      ) : error ? (
        <div className="glass-shell flex h-48 flex-col items-center justify-center gap-2 p-6">
          <p className="text-danger text-sm">{error}</p>
          <Link className="text-accent text-sm" to={APP_PATHS.myBuilds}>
            Back to My Builds
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {loadoutDescription.trim() ? (
            <div className="glass-shell text-foreground/90 border-glass-border border border-dashed px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {linkifyPlainText(loadoutDescription)}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {entries.map(({ slot_type, build }) => (
              <LoadoutBuildSummaryCard
                key={`${slot_type}:${build.id}`}
                build={build}
                slotLabel={getLoadoutSlotDisplayLabel(build, slot_type, lookupRows)}
                equipmentRow={equipmentLookup[build.equipment_unique_name]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadoutBuildSummaryCard({
  build,
  slotLabel,
  equipmentRow,
}: {
  build: StoredBuild;
  slotLabel: string;
  equipmentRow?: Record<string, unknown>;
}) {
  const navigate = useNavigate();
  const slots = (Array.isArray(build.slots) ? build.slots : []) as ModSlot[];
  const wfLike = isWarframeLike(build.equipment_type);
  const wpnLike = isWeaponLike(build.equipment_type);

  const warframe = wfLike && equipmentRow ? (equipmentRow as unknown as Warframe) : null;
  const weapon = wpnLike && equipmentRow ? (equipmentRow as unknown as Weapon) : null;

  const shardBonuses = useMemo(
    () => extractArchonShardBonuses(build.shardSlots, undefined),
    [build.shardSlots],
  );

  const wfCalc = useMemo(() => {
    if (!warframe || !slots.length) return null;
    try {
      return calculateWarframeStats(warframe, slots, shardBonuses);
    } catch {
      return null;
    }
  }, [warframe, slots, shardBonuses]);

  const wpnCalc = useMemo(() => {
    if (!weapon || !slots.length) return null;
    try {
      return calculateWeaponDps(weapon, slots, build.valenceBonus ?? null);
    } catch {
      return null;
    }
  }, [weapon, slots, build.valenceBonus]);

  const abilityNames = useMemo(() => {
    if (!warframe?.abilities) return [] as string[];
    try {
      const parsed = JSON.parse(String(warframe.abilities)) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((a) =>
          a != null && typeof a === 'object' && 'name' in a
            ? String((a as { name?: string }).name)
            : '',
        )
        .filter(Boolean);
    } catch {
      return [];
    }
  }, [warframe]);

  return (
    <div className="glass-shell flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="bg-glass flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl">
          {build.equipment_image ? (
            <img
              src={build.equipment_image}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="text-muted/50 text-xs">?</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-muted mb-0.5 text-[10px] font-semibold tracking-wider uppercase">
            {slotLabel}
          </div>
          <div className="text-foreground truncate text-sm font-semibold">{build.name}</div>
          <div className="text-muted truncate text-xs">{build.equipment_name}</div>
        </div>
      </div>

      {wfCalc ? (
        <dl className="text-muted grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <dt>Duration</dt>
          <dd className="text-foreground text-right font-medium">
            {wfCalc.abilityDuration.modded.toFixed(0)}%
          </dd>
          <dt>Efficiency</dt>
          <dd className="text-foreground text-right font-medium">
            {wfCalc.abilityEfficiency.modded.toFixed(0)}%
          </dd>
          <dt>Range</dt>
          <dd className="text-foreground text-right font-medium">
            {wfCalc.abilityRange.modded.toFixed(0)}%
          </dd>
          <dt>Strength</dt>
          <dd className="text-foreground text-right font-medium">
            {wfCalc.abilityStrength.modded.toFixed(0)}%
          </dd>
        </dl>
      ) : null}

      {abilityNames.length > 0 ? (
        <div className="text-muted text-[11px]">
          <span className="text-foreground/90 font-semibold">Abilities: </span>
          {abilityNames.join(' · ')}
        </div>
      ) : null}

      {wpnCalc ? (
        <dl className="text-muted grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <dt>Burst DPS</dt>
          <dd className="text-foreground text-right font-medium">{wpnCalc.burstDps.toFixed(0)}</dd>
          <dt>Sustained DPS</dt>
          <dd className="text-foreground text-right font-medium">
            {wpnCalc.sustainedDps.toFixed(0)}
          </dd>
          <dt>Total damage (modded)</dt>
          <dd className="text-foreground text-right font-medium">
            {wpnCalc.modded.totalDamage.toFixed(0)}
          </dd>
        </dl>
      ) : null}

      {!wfCalc && !wpnCalc ? (
        <p className="text-muted/70 text-[11px]">
          Open the build for full mod breakdown
          {!equipmentRow ? ' (equipment data still loading).' : '.'}
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-accent btn-sm mt-auto self-start"
        onClick={() => navigate(buildReadOnlyPath(build.id))}
      >
        Open build
      </button>
    </div>
  );
}
