import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildEditPath, buildReadOnlyPath } from '../../app/paths';
import { useBuildFavorites } from '../../hooks/useBuildFavorites';
import { useBuildStorage } from '../../hooks/useBuildStorage';
import { useLoadoutStorage, type Loadout } from '../../hooks/useLoadoutStorage';
import { type BuildVisibility, type StoredBuild } from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import {
  formatLoadoutSlotTypeLabel,
  getBuildPickerCategory,
  getLoadoutSlotDisplayLabel,
  getSlotTypeForBuild,
} from '../../utils/buildCatalogCategory';
import { getUsedFormaCost } from '../../utils/buildFormaCost';
import { enrichBuildFromCatalog } from '../../utils/enrichBuildFromCatalog';
import type { FormaCount } from '../../utils/formaCounter';
import { isClerkUserId } from '../../utils/isClerkUserId';
import { linkifyPlainText } from '../../utils/linkifyText';
import { loadEquipmentLookup, type EquipmentPolaritySource } from '../../utils/loadEquipmentLookup';
import { parseStoredBuildFromApi } from '../../utils/parseStoredBuildFromApi';
import {
  TAB_ORDER,
  TAB_LABELS,
  type EquipmentPickerTab,
} from '../BuildsCatalog/buildsCatalogUtils';
import { FormaMetricChips } from '../shared/FormaMetricChips';
import { MaterialSymbol } from '../ui/MaterialSymbol';

interface BuildsByCategory {
  type: EquipmentPickerTab;
  label: string;
  builds: StoredBuild[];
}

const OVERVIEW_METRIC_CHIP_CLASS =
  'bg-glass flex h-10 min-w-14 items-center justify-center gap-1.5 rounded-lg px-2';

const OVERVIEW_ROW_ACTIONS_CLASS =
  'flex w-[4.25rem] shrink-0 items-center justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100';

function formatBuildEquipmentName(build: StoredBuild): string {
  const baseName = build.equipment_name?.trim() || build.equipment_unique_name;
  if (build.incarnonEnabled === true) {
    return `${baseName} Incarnon`;
  }
  return baseName;
}

type PublicLoadout = Loadout;

type BuildOverviewProps = {
  ownerUserId?: string;
  ownerUserSlug?: string;
  favoritesMode?: boolean;
};

export function BuildOverview({
  ownerUserId,
  ownerUserSlug,
  favoritesMode = false,
}: BuildOverviewProps = {}) {
  const slug = ownerUserSlug?.trim() ?? ownerUserId?.trim() ?? '';
  const viewingUserBuilds = !favoritesMode && slug.length > 0;
  const {
    builds: ownBuilds,
    loading: ownLoading,
    deleteBuild,
    refresh: refreshBuilds,
  } = useBuildStorage();
  const [favoriteBuilds, setFavoriteBuilds] = useState<StoredBuild[]>([]);
  const [favoriteBuildsLoading, setFavoriteBuildsLoading] = useState(favoritesMode);
  const [userBuilds, setUserBuilds] = useState<StoredBuild[]>([]);
  const [userBuildsLoading, setUserBuildsLoading] = useState(viewingUserBuilds);
  const [userLoadouts, setUserLoadouts] = useState<PublicLoadout[]>([]);
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);
  const builds = favoritesMode ? favoriteBuilds : viewingUserBuilds ? userBuilds : ownBuilds;
  const loading = favoritesMode
    ? favoriteBuildsLoading
    : viewingUserBuilds
      ? userBuildsLoading
      : ownLoading;
  const { removeFavorite } = useBuildFavorites();
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
    if (!favoritesMode) return undefined;
    let alive = true;
    setFavoriteBuildsLoading(true);
    void (async () => {
      try {
        const res = await apiFetch('/api/builds/favorites');
        if (!res.ok) {
          if (alive) setFavoriteBuilds([]);
          return;
        }
        const body = (await res.json()) as {
          builds?: Array<Record<string, unknown>>;
        };
        if (!alive) return;
        const rows = Array.isArray(body.builds) ? body.builds : [];
        setFavoriteBuilds(
          rows
            .map((row) => parseStoredBuildFromApi(row))
            .filter((b): b is StoredBuild => b != null),
        );
      } catch {
        if (alive) setFavoriteBuilds([]);
      } finally {
        if (alive) setFavoriteBuildsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [favoritesMode]);

  useEffect(() => {
    if (!viewingUserBuilds || !slug) return undefined;
    let alive = true;
    setUserBuildsLoading(true);
    void (async () => {
      try {
        const isClerkId = isClerkUserId(slug);
        const url = isClerkId
          ? `/api/builds/by-user?${new URLSearchParams({ clerk_user_id: slug }).toString()}`
          : `/api/users/${encodeURIComponent(slug)}/builds`;
        const res = await apiFetch(url);
        if (!res.ok) {
          if (alive) {
            setUserBuilds([]);
            setUserLoadouts([]);
            setOwnerUsername(null);
          }
          return;
        }
        const body = (await res.json()) as {
          builds?: Array<Record<string, unknown>>;
          owner_username?: string | null;
          loadouts?: Array<Record<string, unknown>>;
        };
        if (!alive) return;
        const rows = Array.isArray(body.builds) ? body.builds : [];
        setUserBuilds(
          rows
            .map((row) => parseStoredBuildFromApi(row))
            .filter((b): b is StoredBuild => b != null),
        );
        setOwnerUsername(typeof body.owner_username === 'string' ? body.owner_username : null);
        const loadoutRows = Array.isArray(body.loadouts) ? body.loadouts : [];
        setUserLoadouts(
          loadoutRows.map((row) => ({
            id: String(row.id ?? ''),
            name: typeof row.name === 'string' ? row.name : 'Loadout',
            builds: Array.isArray(row.builds)
              ? (row.builds as Array<Record<string, unknown>>).map((b) => ({
                  build_id: String(b.build_id ?? ''),
                  slot_type: String(b.slot_type ?? ''),
                }))
              : [],
            created_at: String(row.created_at ?? new Date().toISOString()),
            updated_at: String(row.updated_at ?? new Date().toISOString()),
            visibility: 'public',
          })) as PublicLoadout[],
        );
      } catch {
        if (alive) {
          setUserBuilds([]);
          setUserLoadouts([]);
          setOwnerUsername(null);
        }
      } finally {
        if (alive) setUserBuildsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [viewingUserBuilds, slug]);

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

    void loadEquipmentLookup().then((nextLookup) => {
      if (alive) setEquipmentLookup(nextLookup);
    });

    return () => {
      alive = false;
    };
  }, []);

  const enrichedBuilds = useMemo(
    () => builds.map((b) => enrichBuildFromCatalog(b, equipmentLookup)),
    [builds, equipmentLookup],
  );

  const usedFormaByBuildId = useMemo(() => {
    const counts: Record<string, FormaCount> = {};
    for (const build of enrichedBuilds) {
      counts[build.id] = getUsedFormaCost(build, equipmentLookup);
    }
    return counts;
  }, [enrichedBuilds, equipmentLookup]);

  const grouped = useMemo<BuildsByCategory[]>(() => {
    const map = new Map<EquipmentPickerTab, StoredBuild[]>();
    for (const b of enrichedBuilds) {
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
  }, [enrichedBuilds, equipmentLookup]);

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

  const getBuildById = useCallback(
    (id: string) => enrichedBuilds.find((b) => b.id === id),
    [enrichedBuilds],
  );

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

  const openBuild = useCallback(
    (buildId: string) => {
      navigate(
        viewingUserBuilds || favoritesMode ? buildReadOnlyPath(buildId) : buildEditPath(buildId),
      );
    },
    [navigate, viewingUserBuilds, favoritesMode],
  );

  const handleUnfavorite = useCallback(
    async (build: StoredBuild) => {
      const ok = await removeFavorite(build.id);
      if (ok) {
        setFavoriteBuilds((prev) => prev.filter((entry) => entry.id !== build.id));
      }
    },
    [removeFavorite],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[2000px]">
        <div className="glass-shell flex h-64 items-center justify-center">
          <p className="text-muted">Loading builds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[2000px] flex-col gap-4">
      {favoritesMode && (
        <div className="glass-shell px-4 py-3 sm:px-5">
          <h1 className="display-title text-foreground text-2xl">Favorites</h1>
          <p className="text-muted mt-1 text-sm">Builds you have saved for quick access.</p>
        </div>
      )}
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
          {viewingUserBuilds && userLoadouts.length > 0 && (
            <div className="glass-shell overflow-hidden">
              <div className="border-glass-divider bg-glass-hover/50 flex items-center justify-between border-b px-4 py-2.5">
                <h2 className="text-muted text-sm font-semibold tracking-wider uppercase">
                  Public loadouts
                  <span className="text-muted/60 ml-2 text-xs font-normal">
                    ({userLoadouts.length})
                  </span>
                </h2>
              </div>
              <div className="divide-glass-divider divide-y">
                {userLoadouts.map((loadout) => (
                  <LoadoutRow
                    key={loadout.id}
                    loadout={loadout}
                    getBuildById={getBuildById}
                    equipmentLookup={equipmentLookup}
                    updateLoadout={async () => {}}
                    publishLoadout={async () => {}}
                    refreshBuilds={async () => []}
                    onDelete={async () => {}}
                    onNavigate={(buildId) => openBuild(buildId)}
                    onUnlink={async () => {}}
                    onAddBuild={() => {}}
                    readOnly
                  />
                ))}
              </div>
            </div>
          )}

          {!viewingUserBuilds && !favoritesMode && loadouts.length > 0 && (
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

          {enrichedBuilds.length === 0 ? (
            <div className="glass-shell flex h-64 flex-col items-center justify-center gap-4">
              <p className="text-muted text-lg">
                {favoritesMode
                  ? 'No favorites yet'
                  : viewingUserBuilds
                    ? 'No public builds'
                    : 'No builds yet'}
              </p>
              {!viewingUserBuilds && !favoritesMode && (
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
                      hasLoadouts={!viewingUserBuilds && !favoritesMode && loadouts.length > 0}
                      showManagementActions={!viewingUserBuilds}
                      onUnfavorite={favoritesMode ? () => void handleUnfavorite(build) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {!viewingUserBuilds && !favoritesMode && (
          <div className="hidden w-80 shrink-0 space-y-4 lg:block">
            <div className="glass-surface p-4">
              <h3 className="text-foreground mb-3 text-sm font-semibold">Loadouts</h3>
              <p className="text-muted mb-3 text-xs">
                Group builds into complete character setups.
              </p>
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
                  {newLoadoutError ? (
                    <p className="text-danger text-xs">{newLoadoutError}</p>
                  ) : null}
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

      {!viewingUserBuilds && !favoritesMode && linkingBuild && loadouts.length > 0 && (
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

      {!viewingUserBuilds && !favoritesMode && linkingLoadout && (
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
  onUnfavorite,
  hasLoadouts,
  showManagementActions = true,
}: {
  build: StoredBuild;
  usedFormaCost: FormaCount;
  onClick: () => void;
  onDelete: () => void;
  onLink: () => void;
  onUnfavorite?: () => void;
  hasLoadouts: boolean;
  showManagementActions?: boolean;
}) {
  return (
    <div
      className="group hover:bg-glass-hover flex cursor-pointer items-center gap-5 px-4 py-5 transition-[background-color,color] duration-200"
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
      <div className="bg-glass flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {build.equipment_image ? (
          <img
            src={build.equipment_image}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="text-muted/50 text-sm">?</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground truncate text-base font-medium">{build.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted truncate text-sm">{formatBuildEquipmentName(build)}</span>
          <span className="text-muted/40 text-xs">
            {new Date(build.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <FormaMetricChips usedFormaCost={usedFormaCost} />
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
          {onUnfavorite ? (
            <button
              className="text-accent hover:bg-accent/10 rounded-lg p-1.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onUnfavorite();
              }}
              title="Remove from favorites"
              aria-label="Remove from favorites"
            >
              <MaterialSymbol name="favorite" filled style={{ fontSize: 18 }} />
            </button>
          ) : (
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
          )}
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
  readOnly = false,
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
  readOnly?: boolean;
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
        {!readOnly ? (
          <>
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
                <MaterialSymbol
                  name={isPublic ? 'public' : 'public_off'}
                  style={{ fontSize: 24 }}
                />
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
          </>
        ) : (
          <span className="text-success text-[10px] font-semibold uppercase">Public</span>
        )}
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
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => onUnlink(slotType)}
                      className="text-muted/40 hover:text-danger opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Unlink ${slotLabel}`}
                    >
                      <MaterialSymbol name="close" style={{ fontSize: 16 }} />
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
          {!readOnly ? (
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
          ) : null}
        </div>
      )}

      {!readOnly && descriptionModalOpen ? (
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
