import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildEditPath, buildReadOnlyPath } from '../../app/paths';
import { useBuildStorage } from '../../hooks/useBuildStorage';
import { parseStoredBuildFromApi } from '../../utils/parseStoredBuildFromApi';
import { useLoadoutStorage, type Loadout } from '../../hooks/useLoadoutStorage';
import {
  EQUIPMENT_SLOT_CONFIGS,
  POLARITIES,
  type BuildVisibility,
  type StoredBuild,
  type EquipmentType,
  type PolarityKey,
} from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import {
  formatLoadoutSlotTypeLabel,
  getBuildPickerCategory,
  getLoadoutSlotDisplayLabel,
  getSlotTypeForBuild,
} from '../../utils/buildCatalogCategory';
import type { EquipmentLookupRow } from '../../utils/buildCatalogCategory';
import { calculateFormaCount, type FormaCount, type SlotPolarity } from '../../utils/formaCounter';
import { linkifyPlainText } from '../../utils/linkifyText';
import { weaponOmitsExilusSlot } from '../../utils/specialItems';
import {
  TAB_ORDER,
  TAB_LABELS,
  type EquipmentPickerTab,
} from '../BuildsCatalog/buildsCatalogUtils';
import { MaterialSymbol } from '../ui/MaterialSymbol';

interface BuildsByCategory {
  type: EquipmentPickerTab;
  label: string;
  builds: StoredBuild[];
}

interface EquipmentPolaritySource extends EquipmentLookupRow {
  artifact_slots?: string;
  polarities?: string;
  aura_polarity?: string;
  exilus_polarity?: string;
}

const OVERVIEW_METRIC_CHIP_CLASS =
  'bg-glass flex h-10 min-w-14 items-center justify-center gap-1.5 rounded-lg px-2';

const OVERVIEW_ROW_ACTIONS_CLASS =
  'flex w-[4.25rem] shrink-0 items-center justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100';

function getPolarizedSlotCount(build: StoredBuild): number {
  const slots = Array.isArray(build.slots) ? build.slots : [];
  return slots.reduce((count, slot) => count + (typeof slot.polarity === 'string' ? 1 : 0), 0);
}

function buildDefaultPolarities(
  equipmentType: EquipmentType,
  equipment: EquipmentPolaritySource,
  equipmentName?: string,
): SlotPolarity[] {
  const config = EQUIPMENT_SLOT_CONFIGS[equipmentType] || EQUIPMENT_SLOT_CONFIGS.warframe;
  const defaults: SlotPolarity[] = [];

  const artifactSlots: string[] = (() => {
    try {
      return equipment.artifact_slots ? JSON.parse(equipment.artifact_slots) : [];
    } catch {
      return [];
    }
  })();

  const polarityFromAP = (ap: string | undefined): string | undefined => {
    if (!ap || ap === 'AP_UNIVERSAL') return undefined;
    return (POLARITIES as Record<string, string>)[ap as PolarityKey] ? ap : undefined;
  };

  const hasArtifactSlots = artifactSlots.length > 0;

  if (config.hasAura) {
    const polarity = hasArtifactSlots
      ? polarityFromAP(artifactSlots[8])
      : equipment.aura_polarity || undefined;
    defaults.push({ type: 'aura', polarity });
  }
  if (config.hasStance) {
    const polarity = hasArtifactSlots ? polarityFromAP(artifactSlots[8]) : undefined;
    defaults.push({ type: 'stance', polarity });
  }
  if (config.hasPosture) {
    const polarity = hasArtifactSlots ? polarityFromAP(artifactSlots[8]) : undefined;
    defaults.push({ type: 'posture', polarity });
  }

  const generalPolarities: (string | undefined)[] = (() => {
    if (hasArtifactSlots) {
      return artifactSlots.slice(0, config.generalSlots).reverse().map(polarityFromAP);
    }
    try {
      const parsed = equipment.polarities ? JSON.parse(equipment.polarities) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  for (let i = 0; i < config.generalSlots; i += 1) {
    defaults.push({ type: 'general', polarity: generalPolarities[i] });
  }

  const skipExilus = weaponOmitsExilusSlot(equipmentName, equipmentType);

  if (config.hasExilus && !skipExilus) {
    const polarity = hasArtifactSlots
      ? polarityFromAP(artifactSlots[9])
      : equipment.exilus_polarity || undefined;
    defaults.push({ type: 'exilus', polarity });
  }

  return defaults;
}

function getUsedFormaCost(
  build: StoredBuild,
  equipmentLookup: Record<string, EquipmentPolaritySource>,
): FormaCount {
  const equipment = equipmentLookup[build.equipment_unique_name];
  if (!equipment) {
    const fallback = getPolarizedSlotCount(build);
    return {
      regular: fallback,
      universal: 0,
      umbra: 0,
      stance: 0,
      total: fallback,
    };
  }

  const defaults = buildDefaultPolarities(build.equipment_type, equipment, build.equipment_name);
  const desired: SlotPolarity[] = (Array.isArray(build.slots) ? build.slots : []).map((slot) => ({
    type: slot.type,
    polarity: slot.polarity,
  }));

  return calculateFormaCount(defaults, desired);
}

type BuildOverviewProps = {
  /** When set, shows that user's public builds (read-only) instead of the signed-in user's builds. */
  ownerUserId?: number;
};

export function BuildOverview({ ownerUserId }: BuildOverviewProps = {}) {
  const viewingUserBuilds = ownerUserId != null && ownerUserId > 0;
  const {
    builds: ownBuilds,
    loading: ownLoading,
    deleteBuild,
    refresh: refreshBuilds,
  } = useBuildStorage();
  const [userBuilds, setUserBuilds] = useState<StoredBuild[]>([]);
  const [userBuildsLoading, setUserBuildsLoading] = useState(viewingUserBuilds);
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);
  const builds = viewingUserBuilds ? userBuilds : ownBuilds;
  const loading = viewingUserBuilds ? userBuildsLoading : ownLoading;
  const {
    loadouts,
    createLoadout,
    deleteLoadout,
    linkBuild,
    unlinkBuild,
    updateLoadout,
    publishLoadout,
  } = useLoadoutStorage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!viewingUserBuilds || !ownerUserId) return undefined;
    let alive = true;
    setUserBuildsLoading(true);
    void (async () => {
      try {
        const qs = new URLSearchParams({ user_id: String(ownerUserId) });
        const res = await apiFetch(`/api/builds/by-user?${qs.toString()}`);
        if (!res.ok) {
          if (alive) {
            setUserBuilds([]);
            setOwnerUsername(null);
          }
          return;
        }
        const body = (await res.json()) as {
          builds?: Array<Record<string, unknown>>;
          owner_username?: string | null;
        };
        if (!alive) return;
        const rows = Array.isArray(body.builds) ? body.builds : [];
        setUserBuilds(
          rows
            .map((row) => parseStoredBuildFromApi(row))
            .filter((b): b is StoredBuild => b != null),
        );
        setOwnerUsername(
          typeof body.owner_username === 'string' ? body.owner_username : null,
        );
      } catch {
        if (alive) {
          setUserBuilds([]);
          setOwnerUsername(null);
        }
      } finally {
        if (alive) setUserBuildsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [viewingUserBuilds, ownerUserId]);

  const [equipmentLookup, setEquipmentLookup] = useState<Record<string, EquipmentPolaritySource>>(
    {},
  );
  const [showNewLoadout, setShowNewLoadout] = useState(false);
  const [newLoadoutName, setNewLoadoutName] = useState('');
  const [newLoadoutError, setNewLoadoutError] = useState<string | null>(null);
  const [linkingBuild, setLinkingBuild] = useState<StoredBuild | null>(null);
  const [linkingLoadout, setLinkingLoadout] = useState<Loadout | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadEquipmentLookup() {
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
            if (!response.ok) return [] as EquipmentPolaritySource[];
            const body = (await response.json()) as {
              items?: EquipmentPolaritySource[];
            };
            return Array.isArray(body.items) ? body.items : [];
          } catch {
            return [] as EquipmentPolaritySource[];
          }
        }),
      );

      if (!alive) return;

      const nextLookup: Record<string, EquipmentPolaritySource> = {};
      for (const items of responses) {
        for (const item of items) {
          if (!item || typeof item.unique_name !== 'string') continue;
          if (item.unique_name.length === 0) continue;
          if (!nextLookup[item.unique_name]) {
            nextLookup[item.unique_name] = item;
          }
        }
      }

      setEquipmentLookup(nextLookup);
    }

    void loadEquipmentLookup();
    return () => {
      alive = false;
    };
  }, []);

  const usedFormaByBuildId = useMemo(() => {
    const counts: Record<string, FormaCount> = {};
    for (const build of builds) {
      counts[build.id] = getUsedFormaCost(build, equipmentLookup);
    }
    return counts;
  }, [builds, equipmentLookup]);

  const grouped = useMemo<BuildsByCategory[]>(() => {
    const map = new Map<EquipmentPickerTab, StoredBuild[]>();
    for (const b of builds) {
      const cat = getBuildPickerCategory(b, equipmentLookup);
      const list = map.get(cat) || [];
      list.push(b);
      map.set(cat, list);
    }

    return TAB_ORDER.filter((t) => map.has(t)).map((t) => ({
      type: t,
      label: TAB_LABELS[t],
      builds: map
        .get(t)!
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    }));
  }, [builds, equipmentLookup]);

  const handleCreateLoadout = async () => {
    const trimmedName = newLoadoutName.trim();
    if (!trimmedName) return;

    setNewLoadoutError(null);
    try {
      await createLoadout(trimmedName);
      setNewLoadoutName('');
      setShowNewLoadout(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create loadout';
      console.error('Failed to create loadout', error);
      setNewLoadoutError(message);
    }
  };

  const getBuildById = useCallback((id: string) => builds.find((b) => b.id === id), [builds]);

  const loadoutCompatibleBuilds = useMemo(() => {
    if (!linkingLoadout) return [] as StoredBuild[];
    const usedSlotTypes = new Set(
      linkingLoadout.builds.map((lb) => {
        const b = builds.find((x) => x.id === lb.build_id);
        if (!b) return lb.slot_type;
        return getSlotTypeForBuild(b, equipmentLookup) ?? lb.slot_type;
      }),
    );
    return builds
      .filter((build) => {
        const slotType = getSlotTypeForBuild(build, equipmentLookup);
        if (!slotType) return false;
        return !usedSlotTypes.has(slotType);
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [builds, linkingLoadout, equipmentLookup]);

  const handleLinkBuildToLoadout = async (loadoutId: string) => {
    if (!linkingBuild) return;

    try {
      const slotType = getSlotTypeForBuild(linkingBuild, equipmentLookup);
      if (!slotType) {
        window.alert('This build type is not supported in loadouts yet.');
        return;
      }
      await linkBuild(loadoutId, linkingBuild.id, slotType);
      setLinkingBuild(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link build to loadout';
      console.error('Failed to link build to loadout', error);
      window.alert(message);
    }
  };

  const handleLinkCompatibleBuildClick = async (build: StoredBuild) => {
    if (!linkingLoadout) return;

    try {
      const slotType = getSlotTypeForBuild(build, equipmentLookup);
      if (!slotType) {
        window.alert('This build type is not supported in loadouts yet.');
        return;
      }
      await linkBuild(linkingLoadout.id, build.id, slotType);
      setLinkingLoadout(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to link build to loadout slot';
      console.error('Failed to link build to loadout slot', error);
      window.alert(message);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[2000px]">
        <div className="glass-shell flex h-64 items-center justify-center">
          <p className="text-muted">Loading builds...</p>
        </div>
      </div>
    );
  }

  const openBuild = useCallback(
    (buildId: string) => {
      navigate(viewingUserBuilds ? buildReadOnlyPath(buildId) : buildEditPath(buildId));
    },
    [navigate, viewingUserBuilds],
  );

  return (
    <div className="mx-auto flex max-w-[2000px] flex-col gap-4">
      {viewingUserBuilds && (
        <div className="glass-shell px-4 py-3 sm:px-5">
          <h1 className="display-title text-foreground text-2xl">
            {ownerUsername ? `Builds by ${ownerUsername}` : 'Public builds'}
          </h1>
          <p className="text-muted mt-1 text-sm">Public builds shared by this user.</p>
        </div>
      )}
      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-4">
          {!viewingUserBuilds && loadouts.length > 0 && (
            <div className="glass-shell overflow-hidden">
              <div className="border-glass-divider bg-glass-hover/50 flex items-center justify-between border-b px-4 py-2.5">
                <h2 className="text-muted text-sm font-semibold tracking-wider uppercase">
                  Loadouts
                  <span className="text-muted/60 ml-2 text-xs font-normal">
                    ({loadouts.length})
                  </span>
                </h2>
              </div>
              <div className="divide-glass-divider divide-y">
                {loadouts.map((loadout) => (
                  <LoadoutRow
                    key={loadout.id}
                    loadout={loadout}
                    getBuildById={getBuildById}
                    equipmentLookup={equipmentLookup}
                    updateLoadout={updateLoadout}
                    publishLoadout={publishLoadout}
                    refreshBuilds={refreshBuilds}
                    onDelete={async () => {
                      if (!confirm(`Delete loadout "${loadout.name}"?`)) {
                        return;
                      }
                      try {
                        await deleteLoadout(loadout.id);
                      } catch (error) {
                        const message =
                          error instanceof Error ? error.message : 'Failed to delete loadout';
                        console.error('Failed to delete loadout', error);
                        window.alert(message);
                      }
                    }}
                    onNavigate={(buildId) => navigate(buildEditPath(buildId))}
                    onUnlink={async (slotType) => {
                      try {
                        await unlinkBuild(loadout.id, slotType);
                      } catch (error) {
                        const message =
                          error instanceof Error
                            ? error.message
                            : 'Failed to unlink build from loadout';
                        console.error('Failed to unlink build from loadout', error);
                        window.alert(message);
                      }
                    }}
                    onAddBuild={() => {
                      setLinkingLoadout(loadout);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {builds.length === 0 ? (
            <div className="glass-shell flex h-64 flex-col items-center justify-center gap-4">
              <p className="text-muted text-lg">
                {viewingUserBuilds ? 'No public builds' : 'No builds yet'}
              </p>
              {!viewingUserBuilds && (
                <p className="text-muted text-sm">
                  Click "Add Build" in the header to create your first build.
                </p>
              )}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.type} className="glass-shell overflow-hidden">
                <div className="border-glass-divider bg-glass-hover/50 border-b px-4 py-2.5">
                  <h2 className="text-muted text-sm font-semibold tracking-wider uppercase">
                    {group.label}
                    <span className="text-muted/60 ml-2 text-xs font-normal">
                      ({group.builds.length})
                    </span>
                  </h2>
                </div>
                <div className="divide-glass-divider divide-y">
                  {group.builds.map((build) => (
                    <BuildRow
                      key={build.id}
                      build={build}
                      usedFormaCost={
                        usedFormaByBuildId[build.id] ?? {
                          regular: 0,
                          universal: 0,
                          umbra: 0,
                          stance: 0,
                          total: 0,
                        }
                      }
                      onClick={() => openBuild(build.id)}
                      onDelete={() => {
                        if (confirm(`Delete "${build.name}"?`)) void deleteBuild(build.id);
                      }}
                      onLink={() => setLinkingBuild(build)}
                      hasLoadouts={!viewingUserBuilds && loadouts.length > 0}
                      showManagementActions={!viewingUserBuilds}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {!viewingUserBuilds && (
        <div className="hidden w-80 shrink-0 space-y-4 lg:block">
          <div className="glass-surface p-4">
            <h3 className="text-foreground mb-3 text-sm font-semibold">Loadouts</h3>
            <p className="text-muted mb-3 text-xs">Group builds into complete character setups.</p>
            {showNewLoadout ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLoadoutName}
                    onChange={(e) => {
                      setNewLoadoutName(e.target.value);
                      if (newLoadoutError) setNewLoadoutError(null);
                    }}
                    placeholder="Loadout name..."
                    className="form-input flex-1 text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleCreateLoadout();
                      }
                    }}
                  />
                  <button
                    className="btn btn-accent btn-sm"
                    onClick={() => {
                      void handleCreateLoadout();
                    }}
                  >
                    Create
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowNewLoadout(false);
                      setNewLoadoutError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {newLoadoutError ? <p className="text-danger text-xs">{newLoadoutError}</p> : null}
              </div>
            ) : (
              <button
                className="btn btn-accent w-full text-xs"
                onClick={() => {
                  setShowNewLoadout(true);
                  setNewLoadoutError(null);
                }}
              >
                + New Loadout
              </button>
            )}
          </div>

          <div className="glass-surface flex h-48 items-center justify-center">
            <p className="text-muted/50 text-sm">Select a build to view details</p>
          </div>
        </div>
        )}
      </div>

      {!viewingUserBuilds && linkingBuild && loadouts.length > 0 && (
        <div className="modal-overlay" onClick={() => setLinkingBuild(null)}>
          <div
            className="glass-modal-surface max-h-[90vh] w-[90%] max-w-lg overflow-y-auto p-6"
            tabIndex={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setLinkingBuild(null);
              }
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-foreground text-sm font-semibold">
                Link "{linkingBuild.name}" to Loadout
              </h3>
              <button
                type="button"
                className="text-muted hover:text-foreground flex items-center justify-center p-1"
                onClick={() => setLinkingBuild(null)}
                aria-label="Close"
              >
                <MaterialSymbol name="close" style={{ fontSize: 22 }} />
              </button>
            </div>
            <div className="space-y-2">
              {loadouts.map((loadout) => (
                <button
                  key={loadout.id}
                  onClick={() => {
                    void handleLinkBuildToLoadout(loadout.id);
                  }}
                  className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-[color,background-color,border-color] duration-200"
                >
                  <span>{loadout.name}</span>
                  <span className="text-muted/50 text-xs">{loadout.builds.length} builds</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!viewingUserBuilds && linkingLoadout && (
        <div
          className="modal-overlay"
          tabIndex={0}
          onClick={() => setLinkingLoadout(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setLinkingLoadout(null);
            }
          }}
        >
          <div
            className="glass-modal-surface max-h-[90vh] w-[90%] max-w-lg overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-foreground text-sm font-semibold">
                Add Build to "{linkingLoadout.name}"
              </h3>
              <button
                type="button"
                className="text-muted hover:text-foreground flex items-center justify-center p-1"
                onClick={() => setLinkingLoadout(null)}
                aria-label="Close add build dialog"
              >
                <MaterialSymbol name="close" style={{ fontSize: 22 }} />
              </button>
            </div>
            {loadoutCompatibleBuilds.length === 0 ? (
              <p className="text-muted text-sm">
                No compatible builds available. This loadout already has all supported categories
                filled.
              </p>
            ) : (
              <div className="space-y-2">
                {loadoutCompatibleBuilds.map((build) => (
                  <button
                    key={build.id}
                    onClick={() => {
                      void handleLinkCompatibleBuildClick(build);
                    }}
                    className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-[color,background-color,border-color] duration-200"
                  >
                    <div className="min-w-0">
                      <div className="text-foreground truncate text-sm font-medium">
                        {build.name}
                      </div>
                      <div className="text-muted truncate text-xs">{build.equipment_name}</div>
                    </div>
                    <span className="text-muted/50 ml-3 shrink-0 text-[10px]">
                      {formatLoadoutSlotTypeLabel(
                        getSlotTypeForBuild(build, equipmentLookup) ?? '',
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BuildRow({
  build,
  usedFormaCost,
  onClick,
  onDelete,
  onLink,
  hasLoadouts,
  showManagementActions = true,
}: {
  build: StoredBuild;
  usedFormaCost: FormaCount;
  onClick: () => void;
  onDelete: () => void;
  onLink: () => void;
  hasLoadouts: boolean;
  showManagementActions?: boolean;
}) {
  const formaEntries = [
    { key: 'regular', count: usedFormaCost.regular, icon: '/icons/forma.png' },
    {
      key: 'universal',
      count: usedFormaCost.universal,
      icon: '/icons/forma-omni.png',
    },
    {
      key: 'umbra',
      count: usedFormaCost.umbra,
      icon: '/icons/forma-umbra.png',
    },
    {
      key: 'stance',
      count: usedFormaCost.stance,
      icon: '/icons/forma-stance.png',
    },
  ].filter((entry) => entry.count > 0);

  const visibleFormaEntries =
    formaEntries.length > 0
      ? formaEntries
      : [{ key: 'regular', count: 0, icon: '/icons/forma.png' }];

  return (
    <div
      className="group hover:bg-glass-hover flex cursor-pointer items-center gap-3 px-4 py-3 transition-[background-color,color] duration-200"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="bg-glass flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
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
        <div className="flex items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">{build.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted truncate text-xs">{build.equipment_name}</span>
          <span className="text-muted/40 text-[10px]">
            {new Date(build.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {visibleFormaEntries.map((entry) => (
          <div key={entry.key} className={OVERVIEW_METRIC_CHIP_CLASS}>
            <img
              src={entry.icon}
              alt={`${entry.key} forma used`}
              className="h-6 w-6 object-contain"
              draggable={false}
            />
            <span className="text-foreground text-sm font-semibold">{entry.count}</span>
          </div>
        ))}
      </div>

      {showManagementActions ? (
        <div className={OVERVIEW_ROW_ACTIONS_CLASS}>
          {hasLoadouts && (
            <button
              className="text-muted/60 hover:bg-accent/10 hover:text-accent rounded-lg p-1.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onLink();
              }}
              title="Link to loadout"
              aria-label="Link build to loadout"
            >
              <MaterialSymbol name="add_link" style={{ fontSize: 18 }} />
            </button>
          )}
          <button
            className="text-muted/40 hover:bg-danger/10 hover:text-danger rounded-lg p-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete build"
          >
            <MaterialSymbol name="close" style={{ fontSize: 18 }} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LoadoutRow({
  loadout,
  getBuildById,
  equipmentLookup,
  updateLoadout,
  publishLoadout,
  refreshBuilds,
  onDelete,
  onNavigate,
  onUnlink,
  onAddBuild,
}: {
  loadout: Loadout;
  getBuildById: (id: string) => StoredBuild | undefined;
  equipmentLookup: Record<string, EquipmentPolaritySource>;
  updateLoadout: (
    id: string,
    patch: { name?: string; visibility?: BuildVisibility; description?: string },
  ) => Promise<void>;
  publishLoadout: (id: string) => Promise<void>;
  refreshBuilds: () => Promise<StoredBuild[]>;
  onDelete: () => void;
  onNavigate: (buildId: string) => void;
  onUnlink: (slotType: string) => void;
  onAddBuild: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publicBusy, setPublicBusy] = useState(false);
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  const privateLinkedBuilds = useMemo(() => {
    return loadout.builds
      .map((l) => getBuildById(l.build_id))
      .filter((b): b is StoredBuild => Boolean(b))
      .filter((b) => b.visibility !== 'public' && b.visibility !== 'unlisted');
  }, [loadout.builds, getBuildById]);

  const isPublic = loadout.visibility === 'public';

  const handlePublicToggle = async (next: boolean) => {
    if (!next) {
      setPublicBusy(true);
      try {
        await updateLoadout(loadout.id, { visibility: 'private' });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Failed to update loadout');
      } finally {
        setPublicBusy(false);
      }
      return;
    }
    if (privateLinkedBuilds.length === 0) {
      setPublicBusy(true);
      try {
        await updateLoadout(loadout.id, { visibility: 'public' });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Failed to update loadout');
      } finally {
        setPublicBusy(false);
      }
      return;
    }
    setPublishError(null);
    setPublishOpen(true);
  };

  const handlePublishConfirm = async () => {
    setPublishError(null);
    setPublicBusy(true);
    try {
      await publishLoadout(loadout.id);
      await refreshBuilds();
      setPublishOpen(false);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Failed to publish loadout');
    } finally {
      setPublicBusy(false);
    }
  };

  const linkedBuildRows = useMemo(() => {
    const rows = loadout.builds
      .map((linked) => {
        const build = getBuildById(linked.build_id);
        if (!build) return null;
        return { build, slotType: linked.slot_type };
      })
      .filter((entry): entry is { build: StoredBuild; slotType: string } => Boolean(entry));

    return rows.sort(
      (a, b) => new Date(b.build.updated_at).getTime() - new Date(a.build.updated_at).getTime(),
    );
  }, [loadout.builds, getBuildById]);

  return (
    <div>
      <div
        className="group hover:bg-glass-hover flex cursor-pointer items-center gap-3 px-4 py-3 transition-[background-color,color] duration-200"
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
      >
        <span className="text-muted/50 flex h-10 w-10 shrink-0 items-center justify-center">
          {expanded ? (
            <MaterialSymbol name="expand_more" style={{ fontSize: 16 }} />
          ) : (
            <MaterialSymbol name="chevron_right" style={{ fontSize: 16 }} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-foreground text-sm font-medium">{loadout.name}</span>
          <span className="text-muted/50 ml-2 text-xs">{loadout.builds.length} builds</span>
        </div>
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={publicBusy}
            aria-pressed={isPublic}
            aria-label={isPublic ? 'Public loadout' : 'Private loadout'}
            title={isPublic ? 'Public loadout' : 'Private loadout'}
            className={`${OVERVIEW_METRIC_CHIP_CLASS} hover:bg-glass-hover disabled:hover:bg-glass transition-[color,background-color,transform] duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ${
              isPublic ? 'text-success' : 'text-danger'
            }`}
            onClick={() => {
              void handlePublicToggle(!isPublic);
            }}
          >
            <MaterialSymbol name={isPublic ? 'public' : 'public_off'} style={{ fontSize: 24 }} />
          </button>
        </div>
        <div className={OVERVIEW_ROW_ACTIONS_CLASS}>
          <button
            className="text-muted/40 hover:bg-danger/10 hover:text-danger rounded-lg p-1.5 text-xs"
            type="button"
            onClick={onDelete}
            aria-label="Delete loadout"
          >
            <MaterialSymbol name="close" style={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-glass-divider bg-glass/30 border-t px-6 py-2">
          {loadout.description?.trim() ? (
            <div className="text-foreground/90 border-glass-border mb-3 rounded-lg border border-dashed px-3 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap">
              {linkifyPlainText(loadout.description)}
            </div>
          ) : null}
          {linkedBuildRows.length === 0 ? (
            <div className="text-muted/40 py-2 text-xs">No builds added yet.</div>
          ) : (
            linkedBuildRows.map(({ build, slotType }) => {
              const slotLabel = getLoadoutSlotDisplayLabel(build, slotType, equipmentLookup);
              return (
                <div
                  key={`${slotType}:${build.id}`}
                  className="group hover:bg-glass-hover flex items-center gap-3 rounded px-2 py-2 transition-[background-color,color] duration-200"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => onNavigate(build.id)}
                  >
                    <div className="bg-glass flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded">
                      {build.equipment_image ? (
                        <img
                          src={build.equipment_image}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-muted/50 text-[10px]">?</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-foreground truncate text-xs font-medium">
                        {build.name}
                      </div>
                      <div className="text-muted truncate text-[11px]">{build.equipment_name}</div>
                    </div>
                  </button>
                  <span className="border-glass-border text-muted/60 shrink-0 rounded border px-1.5 py-0.5 text-[10px]">
                    {slotLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnlink(slotType)}
                    className="text-muted/40 hover:text-danger opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Unlink ${slotLabel}`}
                  >
                    <MaterialSymbol name="close" style={{ fontSize: 16 }} />
                  </button>
                </div>
              );
            })
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setDescriptionDraft(loadout.description ?? '');
                setDescriptionError(null);
                setDescriptionModalOpen(true);
              }}
              className="text-accent hover:bg-accent/10 rounded px-2 py-1 text-xs"
            >
              {loadout.description?.trim() ? 'Edit description' : 'Add description'}
            </button>
            <button
              type="button"
              onClick={onAddBuild}
              className="text-accent hover:bg-accent/10 rounded px-2 py-1 text-xs"
            >
              + Add Build
            </button>
          </div>
        </div>
      )}

      {descriptionModalOpen ? (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!descriptionBusy) setDescriptionModalOpen(false);
          }}
        >
          <div
            className="glass-modal-surface max-h-[90vh] w-[90%] max-w-lg overflow-y-auto p-6"
            tabIndex={0}
            role="dialog"
            aria-modal="true"
            aria-labelledby="loadout-description-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !descriptionBusy) setDescriptionModalOpen(false);
            }}
          >
            <h3
              id="loadout-description-title"
              className="text-foreground mb-2 text-sm font-semibold"
            >
              Loadout description
            </h3>
            <p className="text-muted mb-3 text-xs">
              Plain text only. URLs will become links when someone views this loadout.
            </p>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              className="border-glass-border bg-glass/40 text-foreground placeholder:text-muted/50 focus:border-accent/50 mb-3 min-h-[8rem] w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="Notes for this loadout…"
              aria-label="Loadout description"
              disabled={descriptionBusy}
            />
            {descriptionError ? (
              <p className="text-danger mb-3 text-xs" role="alert">
                {descriptionError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={descriptionBusy}
                onClick={() => setDescriptionModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                disabled={descriptionBusy}
                onClick={() => {
                  void (async () => {
                    setDescriptionError(null);
                    setDescriptionBusy(true);
                    try {
                      await updateLoadout(loadout.id, { description: descriptionDraft });
                      setDescriptionModalOpen(false);
                    } catch (e) {
                      setDescriptionError(e instanceof Error ? e.message : 'Failed to save');
                    } finally {
                      setDescriptionBusy(false);
                    }
                  })();
                }}
              >
                {descriptionBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {publishOpen ? (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!publicBusy) setPublishOpen(false);
          }}
        >
          <div
            className="glass-modal-surface max-h-[90vh] w-[90%] max-w-lg overflow-y-auto p-6"
            tabIndex={0}
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-loadout-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !publicBusy) setPublishOpen(false);
            }}
          >
            <h3 id="publish-loadout-title" className="text-foreground mb-2 text-sm font-semibold">
              Publish this loadout?
            </h3>
            <p className="text-muted mb-3 text-xs">
              All builds in a public loadout must be public or unlisted so others can open them for
              stats. These linked builds are still private:
            </p>
            <ul className="text-foreground mb-4 list-inside list-disc text-xs">
              {privateLinkedBuilds.map((b) => (
                <li key={b.id}>{b.name}</li>
              ))}
            </ul>
            {publishError ? (
              <p className="text-danger mb-3 text-xs" role="alert">
                {publishError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={publicBusy}
                onClick={() => setPublishOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                disabled={publicBusy}
                onClick={() => void handlePublishConfirm()}
              >
                {publicBusy ? 'Publishing…' : 'Make all builds public and publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
