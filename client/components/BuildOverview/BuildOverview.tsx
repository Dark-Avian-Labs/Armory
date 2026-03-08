import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildEditPath } from '../../app/paths';
import { useBuildStorage } from '../../hooks/useBuildStorage';
import {
  useLoadoutStorage,
  LOADOUT_SLOT_TYPES,
  type Loadout,
} from '../../hooks/useLoadoutStorage';
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPE_ORDER,
  type StoredBuild,
  type EquipmentType,
} from '../../types/warframe';
import { matchesSpecialItemType } from '../../utils/specialItems';

interface BuildsByCategory {
  type: EquipmentType;
  label: string;
  builds: StoredBuild[];
}

function getSlotTypeForBuild(build: StoredBuild): string | null {
  if (matchesSpecialItemType(build.equipment_name, build.equipment_type)) {
    if (build.equipment_type === 'primary') return 'special_primary';
    if (build.equipment_type === 'secondary') return 'special_secondary';
    if (build.equipment_type === 'melee') return 'special_melee';
  }

  const equipmentType = build.equipment_type;
  switch (equipmentType) {
    case 'warframe':
    case 'primary':
    case 'secondary':
    case 'melee':
    case 'companion':
    case 'archwing':
    case 'archgun':
    case 'archmelee':
      return equipmentType;
    default:
      return null;
  }
}

function getSlotLabel(slotType: string): string {
  if (slotType === 'special_primary') return 'Primary (Special)';
  if (slotType === 'special_secondary') return 'Secondary (Special)';
  if (slotType === 'special_melee') return 'Melee (Special)';

  return (
    LOADOUT_SLOT_TYPES.find((slot) => slot.key === slotType)?.label ?? slotType
  );
}

export function BuildOverview() {
  const { builds, loading, deleteBuild } = useBuildStorage();
  const { loadouts, createLoadout, deleteLoadout, linkBuild, unlinkBuild } =
    useLoadoutStorage();
  const navigate = useNavigate();
  const [showNewLoadout, setShowNewLoadout] = useState(false);
  const [newLoadoutName, setNewLoadoutName] = useState('');
  const [newLoadoutError, setNewLoadoutError] = useState<string | null>(null);
  const [linkingBuild, setLinkingBuild] = useState<StoredBuild | null>(null);
  const [linkingLoadout, setLinkingLoadout] = useState<Loadout | null>(null);

  const grouped = useMemo<BuildsByCategory[]>(() => {
    const map = new Map<EquipmentType, StoredBuild[]>();
    for (const b of builds) {
      const list = map.get(b.equipment_type) || [];
      list.push(b);
      map.set(b.equipment_type, list);
    }

    return EQUIPMENT_TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({
      type: t,
      label: EQUIPMENT_TYPE_LABELS[t],
      builds: map
        .get(t)!
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
    }));
  }, [builds]);

  const handleCreateLoadout = async () => {
    const trimmedName = newLoadoutName.trim();
    if (!trimmedName) return;

    setNewLoadoutError(null);
    try {
      await createLoadout(trimmedName);
      setNewLoadoutName('');
      setShowNewLoadout(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create loadout';
      console.error('Failed to create loadout', error);
      setNewLoadoutError(message);
    }
  };

  const getBuildById = useCallback(
    (id: string) => builds.find((b) => b.id === id),
    [builds],
  );

  const loadoutCompatibleBuilds = useMemo(() => {
    if (!linkingLoadout) return [] as StoredBuild[];
    const usedSlotTypes = new Set(linkingLoadout.builds.map((b) => b.slot_type));
    return builds
      .filter((build) => {
        const slotType = getSlotTypeForBuild(build);
        if (!slotType) return false;
        return !usedSlotTypes.has(slotType);
      })
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }, [builds, linkingLoadout]);

  const handleLinkBuildToLoadout = async (loadoutId: string) => {
    if (!linkingBuild) return;

    try {
      await linkBuild(loadoutId, linkingBuild.id, linkingBuild.equipment_type);
      setLinkingBuild(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to link build to loadout';
      console.error('Failed to link build to loadout', error);
      window.alert(message);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[2000px]">
        <div className="glass-shell flex h-64 items-center justify-center">
          <p className="text-muted">Loading builds…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[2000px] gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        {loadouts.length > 0 && (
          <div className="glass-shell overflow-hidden">
            <div className="flex items-center justify-between border-b border-glass-divider bg-glass-hover/50 px-4 py-2.5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Loadouts
                <span className="ml-2 text-xs font-normal text-muted/60">
                  ({loadouts.length})
                </span>
              </h2>
            </div>
            <div className="divide-y divide-glass-divider">
              {loadouts.map((loadout) => (
                <LoadoutRow
                  key={loadout.id}
                  loadout={loadout}
                  getBuildById={getBuildById}
                  onDelete={async () => {
                    if (!confirm(`Delete loadout "${loadout.name}"?`)) {
                      return;
                    }
                    try {
                      await deleteLoadout(loadout.id);
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : 'Failed to delete loadout';
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
                      console.error(
                        'Failed to unlink build from loadout',
                        error,
                      );
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
            <p className="text-lg text-muted">No builds yet</p>
            <p className="text-sm text-muted">
              Click "Add Build" in the header to create your first build.
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.type} className="glass-shell overflow-hidden">
              <div className="border-b border-glass-divider bg-glass-hover/50 px-4 py-2.5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                  {group.label}
                  <span className="ml-2 text-xs font-normal text-muted/60">
                    ({group.builds.length})
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-glass-divider">
                {group.builds.map((build) => (
                  <BuildRow
                    key={build.id}
                    build={build}
                    onClick={() => navigate(buildEditPath(build.id))}
                    onDelete={() => {
                      if (confirm(`Delete "${build.name}"?`))
                        void deleteBuild(build.id);
                    }}
                    onLink={() => setLinkingBuild(build)}
                    hasLoadouts={loadouts.length > 0}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden w-80 shrink-0 space-y-4 lg:block">
        <div className="glass-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Loadouts
          </h3>
          <p className="mb-3 text-xs text-muted">
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
                <p className="text-xs text-danger">{newLoadoutError}</p>
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
          <p className="text-sm text-muted/50">
            Select a build to view details
          </p>
        </div>
      </div>

      {linkingBuild && loadouts.length > 0 && (
        <div className="modal-overlay" onClick={() => setLinkingBuild(null)}>
          <div
            className="glass-modal-surface w-[90%] max-w-lg max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Link "{linkingBuild.name}" to Loadout
              </h3>
              <button
                className="text-lg text-muted hover:text-foreground"
                onClick={() => setLinkingBuild(null)}
              >
                &times;
              </button>
            </div>
            <div className="space-y-2">
              {loadouts.map((loadout) => (
                <button
                  key={loadout.id}
                  onClick={() => {
                    void handleLinkBuildToLoadout(loadout.id);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-glass-border px-3 py-2 text-left text-sm text-muted transition-all hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground"
                >
                  <span>{loadout.name}</span>
                  <span className="text-xs text-muted/50">
                    {loadout.builds.length} builds
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {linkingLoadout && (
        <div className="modal-overlay" onClick={() => setLinkingLoadout(null)}>
          <div
            className="glass-modal-surface w-[90%] max-w-lg max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Add Build to "{linkingLoadout.name}"
              </h3>
              <button
                className="text-lg text-muted hover:text-foreground"
                onClick={() => setLinkingLoadout(null)}
                aria-label="Close add build dialog"
              >
                &times;
              </button>
            </div>
            {loadoutCompatibleBuilds.length === 0 ? (
              <p className="text-sm text-muted">
                No compatible builds available. This loadout already has all
                supported categories filled.
              </p>
            ) : (
              <div className="space-y-2">
                {loadoutCompatibleBuilds.map((build) => (
                  <button
                    key={build.id}
                    onClick={() => {
                      void (async () => {
                        try {
                          const slotType = getSlotTypeForBuild(build);
                          if (!slotType) {
                            window.alert(
                              'This build type is not supported in loadouts yet.',
                            );
                            return;
                          }
                          await linkBuild(
                            linkingLoadout.id,
                            build.id,
                            slotType,
                          );
                          setLinkingLoadout(null);
                        } catch (error) {
                          const message =
                            error instanceof Error
                              ? error.message
                              : 'Failed to link build to loadout slot';
                          console.error(
                            'Failed to link build to loadout slot',
                            error,
                          );
                          window.alert(message);
                        }
                      })();
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-glass-border px-3 py-2 text-left text-sm text-muted transition-all hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {build.name}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {build.equipment_name}
                      </div>
                    </div>
                    <span className="ml-3 shrink-0 text-[10px] text-muted/50">
                      {getSlotLabel(
                        getSlotTypeForBuild(build) ?? '',
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
  onClick,
  onDelete,
  onLink,
  hasLoadouts,
}: {
  build: StoredBuild;
  onClick: () => void;
  onDelete: () => void;
  onLink: () => void;
  hasLoadouts: boolean;
}) {
  return (
    <div
      className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-all hover:bg-glass-hover"
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-glass">
        {build.equipment_image ? (
          <img
            src={build.equipment_image}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="text-xs text-muted/50">?</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {build.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-xs text-muted">
            {build.equipment_name}
          </span>
          <span className="text-[10px] text-muted/40">
            {new Date(build.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {hasLoadouts && (
          <button
            className="rounded-lg p-1.5 text-xs text-muted/60 hover:bg-accent/10 hover:text-accent"
            onClick={(e) => {
              e.stopPropagation();
              onLink();
            }}
            title="Link to loadout"
            aria-label="Link build to loadout"
          >
            ⛓
          </button>
        )}
        <button
          className="rounded-lg p-1.5 text-xs text-muted/40 hover:bg-danger/10 hover:text-danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete build"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

function LoadoutRow({
  loadout,
  getBuildById,
  onDelete,
  onNavigate,
  onUnlink,
  onAddBuild,
}: {
  loadout: Loadout;
  getBuildById: (id: string) => StoredBuild | undefined;
  onDelete: () => void;
  onNavigate: (buildId: string) => void;
  onUnlink: (slotType: string) => void;
  onAddBuild: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const linkedBuildRows = useMemo(() => {
    const rows = loadout.builds
      .map((linked) => {
        const build = getBuildById(linked.build_id);
        if (!build) return null;
        return { build, slotType: linked.slot_type };
      })
      .filter((entry): entry is { build: StoredBuild; slotType: string } =>
        Boolean(entry),
      );

    return rows.sort(
      (a, b) =>
        new Date(b.build.updated_at).getTime() -
        new Date(a.build.updated_at).getTime(),
    );
  }, [loadout.builds, getBuildById]);

  return (
    <div>
      <div
        className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-all hover:bg-glass-hover"
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
        <span className="text-xs text-muted/50">{expanded ? '▼' : '▶'}</span>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground">
            {loadout.name}
          </span>
          <span className="ml-2 text-xs text-muted/50">
            {loadout.builds.length} builds
          </span>
        </div>
        <button
          className="shrink-0 rounded-lg p-1.5 text-xs text-muted/40 opacity-0 hover:bg-danger/10 hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete loadout"
        >
          &times;
        </button>
      </div>

      {expanded && (
        <div className="border-t border-glass-divider bg-glass/30 px-6 py-2">
          {linkedBuildRows.length === 0 ? (
            <div className="py-2 text-xs text-muted/40">No builds added yet.</div>
          ) : (
            linkedBuildRows.map(({ build, slotType }) => (
              <div
                key={`${slotType}:${build.id}`}
                className="group flex items-center gap-3 rounded px-2 py-2 transition-all hover:bg-glass-hover"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => onNavigate(build.id)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-glass">
                    {build.equipment_image ? (
                      <img
                        src={build.equipment_image}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span className="text-[10px] text-muted/50">?</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">
                      {build.name}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {build.equipment_name}
                    </div>
                  </div>
                </button>
                <span className="shrink-0 rounded border border-glass-border px-1.5 py-0.5 text-[10px] text-muted/60">
                  {getSlotLabel(slotType)}
                </span>
                <button
                  onClick={() => onUnlink(slotType)}
                  className="text-muted/40 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  aria-label={`Unlink ${getSlotLabel(slotType)}`}
                >
                  &times;
                </button>
              </div>
            ))
          )}
          <div className="pt-2">
            <button
              onClick={onAddBuild}
              className="rounded px-2 py-1 text-xs text-accent hover:bg-accent/10"
            >
              + Add Build
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
