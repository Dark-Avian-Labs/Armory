import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { AbilityBar } from './AbilityBar';
import { ArcanePickerPanel } from './ArcanePickerPanel';
import { ArcaneSlots, type ArcaneSlot, type Arcane } from './ArcaneSlots';
import {
  ArchonShardSlots,
  type ShardSlotConfig,
  type ShardType,
} from './ArchonShardSlots';
import { CapacityBar } from './CapacityBar';
import { ElementOutput } from './ElementOutput';
import { FilterPanel } from './FilterPanel';
import { HelminthPickerPanel } from './HelminthPickerPanel';
import { ModSlotGrid } from './ModSlotGrid';
import { RivenBuilder } from './RivenBuilder';
import { ShardPickerPanel } from './ShardPickerPanel';
import { StatsPanel } from './StatsPanel';
import { buildEditPath } from '../../app/paths';
import { useCompare } from '../../context/CompareContext';
import { useApi } from '../../hooks/useApi';
import { useBuildStorage } from '../../hooks/useBuildStorage';
import {
  EQUIPMENT_SLOT_CONFIGS,
  POLARITIES,
  type Mod,
  type ModSlot,
  type Weapon,
  type Warframe,
  type Companion,
  type EquipmentType,
  type SlotType,
  type BuildConfig,
  type Ability,
  type PolarityKey,
  type RivenConfig,
  type RivenWeaponType,
} from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { getMaxRank } from '../../utils/arcaneUtils';
import { calculateBuildDamage } from '../../utils/damage';
import { calculateWeaponDps } from '../../utils/damageCalc';
import { calculateTotalCapacity } from '../../utils/drain';
import {
  calculateFormaCount,
  type FormaCount,
  type SlotPolarity,
} from '../../utils/formaCounter';
import { isModLockedOut } from '../../utils/modFiltering';
import {
  createRivenMod,
  getRivenStatsForType,
  getRivenWeaponType,
  isRivenMod,
  normalizeRivenConfigMembership,
  RIVEN_PLACEHOLDER_UNIQUE,
} from '../../utils/riven';

type RightPanelMode = 'mods' | 'helminth' | 'arcanes' | 'shards';

function getAbilityName(warframe: Warframe | null, index: number): string {
  if (!warframe?.abilities) return `Ability ${index + 1}`;
  try {
    const parsed = JSON.parse(warframe.abilities) as Array<{
      abilityName?: string;
      name?: string;
    }>;
    const ab = parsed[index];
    return ab?.abilityName || ab?.name || `Ability ${index + 1}`;
  } catch {
    return `Ability ${index + 1}`;
  }
}

type Equipment = Warframe | Weapon | Companion;

function getEquipmentListUrl(type: EquipmentType): string {
  switch (type) {
    case 'warframe':
      return '/api/warframes';
    case 'primary':
      return '/api/weapons?type=LongGuns';
    case 'secondary':
      return '/api/weapons?type=Pistols';
    case 'melee':
      return '/api/weapons?type=Melee';
    case 'archgun':
      return '/api/weapons?type=SpaceGuns';
    case 'archmelee':
      return '/api/weapons?type=SpaceMelee';
    case 'companion':
      return '/api/companions';
    case 'archwing':
      return '/api/warframes';
    case 'necramech':
      return '/api/warframes';
    default:
      return '/api/warframes';
  }
}

function getSetName(slot: ModSlot): string | undefined {
  if (!slot.mod?.mod_set || !slot.mod.set_stats) return undefined;
  return slot.mod.mod_set;
}

function clampSetRank(slot: ModSlot, rank: number): number {
  const maxSetRank = slot.mod?.set_num_in_set ?? 1;
  return Math.max(1, Math.min(maxSetRank, rank));
}

function applySetPieceDelta(
  prevSlots: ModSlot[],
  nextSlots: ModSlot[],
): ModSlot[] {
  const prevCounts = new Map<string, number>();
  const prevRanks = new Map<string, number>();

  for (const slot of prevSlots) {
    const setName = getSetName(slot);
    if (!setName) continue;
    prevCounts.set(setName, (prevCounts.get(setName) ?? 0) + 1);
    if (!prevRanks.has(setName)) {
      prevRanks.set(setName, slot.setRank ?? 1);
    }
  }

  const nextCounts = new Map<string, number>();
  let updated = nextSlots.map((slot) => {
    const setName = getSetName(slot);
    if (!setName) return slot;
    nextCounts.set(setName, (nextCounts.get(setName) ?? 0) + 1);
    return slot.setRank == null ? { ...slot, setRank: 1 } : slot;
  });

  for (const [setName, nextCount] of nextCounts) {
    const prevCount = prevCounts.get(setName) ?? 0;
    if (prevCount === 0) continue;
    const delta = nextCount - prevCount;
    if (delta === 0) continue;

    const baseRank = prevRanks.get(setName) ?? 1;
    const targetRank = baseRank + delta;
    updated = updated.map((slot) => {
      if (getSetName(slot) !== setName) return slot;
      const nextRank = clampSetRank(slot, targetRank);
      return slot.setRank === nextRank ? slot : { ...slot, setRank: nextRank };
    });
  }

  return updated;
}

function applySetRankDelta(
  slots: ModSlot[],
  setName: string,
  delta: number,
  fallbackRank: number,
): ModSlot[] {
  return slots.map((slot) => {
    if (getSetName(slot) !== setName) return slot;
    const currentRank = slot.setRank ?? fallbackRank;
    const nextRank = clampSetRank(slot, currentRank + delta);
    return slot.setRank === nextRank ? slot : { ...slot, setRank: nextRank };
  });
}

export function ModBuilder() {
  const {
    buildId,
    equipmentType: routeEqType,
    equipmentId,
  } = useParams<{
    buildId?: string;
    equipmentType?: string;
    equipmentId?: string;
  }>();
  const navigate = useNavigate();
  const { saveBuild: storageSave, getBuild } = useBuildStorage();

  const [equipmentType, setEquipmentType] = useState<EquipmentType>(
    (routeEqType as EquipmentType) || 'warframe',
  );
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null,
  );
  const [slots, setSlots] = useState<ModSlot[]>([]);
  const [orokinReactor, setOrokinReactor] = useState(false);
  const [buildName, setBuildName] = useState('New Build');
  const [currentBuildId, setCurrentBuildId] = useState<string | undefined>(
    buildId,
  );
  const [targetEquipmentUniqueName, setTargetEquipmentUniqueName] = useState<
    string | null
  >(null);
  const [helminthConfig, setHelminthConfig] = useState<
    BuildConfig['helminth'] | undefined
  >();
  const [activeSlotType, setActiveSlotType] = useState<SlotType | undefined>();
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [isOwnBuild, setIsOwnBuild] = useState(true);
  const [arcaneSlots, setArcaneSlots] = useState<ArcaneSlot[]>([
    { rank: 0 },
    { rank: 0 },
  ]);
  const [shardSlots, setShardSlots] = useState<ShardSlotConfig[]>(
    Array.from({ length: 5 }, () => ({ tauforged: false })),
  );
  const [formaMode, setFormaMode] = useState(false);
  const [defaultPolarities, setDefaultPolarities] = useState<SlotPolarity[]>(
    [],
  );
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('mods');
  const [activeAbilityIndex, setActiveAbilityIndex] = useState<number | null>(
    null,
  );
  const [activeArcaneSlot, setActiveArcaneSlot] = useState<number | null>(null);
  const [activeShardSlot, setActiveShardSlot] = useState<number | null>(null);
  const [editingRivenSlot, setEditingRivenSlot] = useState<number | null>(null);
  const [draftRivenSlot, setDraftRivenSlot] = useState<number | null>(null);

  const routeKey = `${buildId ?? ''}|${routeEqType ?? ''}|${equipmentId ?? ''}`;
  const prevRouteKey = useRef(routeKey);
  useEffect(() => {
    if (prevRouteKey.current === routeKey) return;
    prevRouteKey.current = routeKey;
    setSelectedEquipment(null);
    setSlots([]);
    setOrokinReactor(false);
    setBuildName('New Build');
    setCurrentBuildId(buildId);
    setTargetEquipmentUniqueName(null);
    setIsOwnBuild(true);
    setHelminthConfig(undefined);
    setActiveSlotType(undefined);
    setActiveSlotIndex(undefined);
    setLoaded(false);
    setArcaneSlots([{ rank: 0 }, { rank: 0 }]);
    setShardSlots(Array.from({ length: 5 }, () => ({ tauforged: false })));
    setFormaMode(false);
    setDefaultPolarities([]);
    setRightPanelMode('mods');
    setActiveAbilityIndex(null);
    setActiveArcaneSlot(null);
    setActiveShardSlot(null);
    setEditingRivenSlot(null);
    setDraftRivenSlot(null);
    if (routeEqType) setEquipmentType(routeEqType as EquipmentType);
  }, [routeKey, buildId, routeEqType]);

  const apiUrl = getEquipmentListUrl(equipmentType);
  const { data: equipmentData } = useApi<{ items: Equipment[] }>(apiUrl);

  const { data: shardData } = useApi<{ shards: ShardType[] }>(
    '/api/archon-shards',
  );
  const shardTypes = shardData?.shards || [];

  const { addSnapshot, snapshots: compareSnapshots } = useCompare();

  useEffect(() => {
    if (loaded) return;

    async function loadBuildFromApi(targetBuildId: string): Promise<void> {
      const response = await apiFetch(`/api/builds/${targetBuildId}`);
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as {
        build?: {
          id: number | string;
          name: string;
          equipment_type: EquipmentType;
          equipment_unique_name: string;
          mod_config?: Partial<BuildConfig>;
        };
        can_edit?: boolean;
      };
      if (!body.build) {
        return;
      }
      const config = (body.build.mod_config ?? {}) as Partial<BuildConfig>;
      setEquipmentType(body.build.equipment_type);
      setBuildName(
        typeof config.name === 'string' ? config.name : body.build.name,
      );
      setTargetEquipmentUniqueName(body.build.equipment_unique_name);
      setCurrentBuildId(
        body.can_edit === true ? String(body.build.id) : undefined,
      );
      setIsOwnBuild(body.can_edit === true);
      setHelminthConfig(config.helminth);
      if (Array.isArray(config.arcaneSlots)) {
        setArcaneSlots(config.arcaneSlots as ArcaneSlot[]);
      }
      if (Array.isArray(config.shardSlots)) {
        setShardSlots(config.shardSlots as ShardSlotConfig[]);
      }
      if (typeof config.orokinReactor === 'boolean') {
        setOrokinReactor(config.orokinReactor);
      }
      if (Array.isArray(config.slots)) {
        setSlots(config.slots as ModSlot[]);
      }
    }

    if (buildId) {
      const stored = getBuild(buildId);
      if (stored) {
        setEquipmentType(stored.equipment_type);
        setBuildName(stored.name);
        setTargetEquipmentUniqueName(stored.equipment_unique_name);
        setCurrentBuildId(stored.id);
        setIsOwnBuild(true);
        setHelminthConfig(stored.helminth);
        if (stored.arcaneSlots)
          setArcaneSlots(stored.arcaneSlots as ArcaneSlot[]);
        if (stored.shardSlots)
          setShardSlots(stored.shardSlots as ShardSlotConfig[]);
        if (stored.orokinReactor !== undefined)
          setOrokinReactor(stored.orokinReactor);
      } else {
        void loadBuildFromApi(buildId);
      }
    } else if (routeEqType && equipmentId) {
      setEquipmentType(routeEqType as EquipmentType);
    }
  }, [buildId, routeEqType, equipmentId, getBuild, loaded]);

  useEffect(() => {
    if (!equipmentData?.items?.length) return;

    if (buildId && !loaded) {
      const targetUniqueName =
        targetEquipmentUniqueName ??
        (isOwnBuild ? getBuild(buildId)?.equipment_unique_name : null);
      if (targetUniqueName) {
        const item = equipmentData.items.find(
          (i) => i.unique_name === targetUniqueName,
        );
        if (item) {
          setSelectedEquipment(item);
          setLoaded(true);
        }
      }
    } else if (equipmentId && !loaded) {
      const decodedId = decodeURIComponent(equipmentId);
      const item = equipmentData.items.find((i) => i.unique_name === decodedId);
      if (item) {
        setSelectedEquipment(item);
        setLoaded(true);
      }
    }
  }, [
    equipmentData,
    buildId,
    equipmentId,
    getBuild,
    isOwnBuild,
    loaded,
    targetEquipmentUniqueName,
  ]);

  useEffect(() => {
    if (!loaded || !buildId || !isOwnBuild) return;
    const stored = getBuild(buildId);
    if (stored?.slots?.length) {
      setSlots(stored.slots);
    }
  }, [loaded, buildId, getBuild, isOwnBuild]);

  const equippedMods = useMemo(
    () => slots.filter((s) => s.mod).map((s) => s.mod!),
    [slots],
  );
  const rivenWeaponType = useMemo<RivenWeaponType | null>(
    () => getRivenWeaponType(equipmentType),
    [equipmentType],
  );

  useEffect(() => {
    if (!selectedEquipment) {
      setSlots([]);
      setDefaultPolarities([]);
      return;
    }

    const shouldInitializeSlots = !buildId;

    const config =
      EQUIPMENT_SLOT_CONFIGS[equipmentType] || EQUIPMENT_SLOT_CONFIGS.warframe;
    const newSlots: ModSlot[] = [];
    let idx = 0;

    const artifactSlots: string[] = (() => {
      try {
        const eq = selectedEquipment as Warframe & Weapon & Companion;
        return eq.artifact_slots ? JSON.parse(eq.artifact_slots) : [];
      } catch {
        return [];
      }
    })();

    const polarityFromAP = (ap: string | undefined): string | undefined => {
      if (!ap || ap === 'AP_UNIVERSAL') return undefined;
      return (POLARITIES as Record<string, string>)[ap as PolarityKey]
        ? ap
        : undefined;
    };

    const hasArtifactSlots = artifactSlots.length > 0;

    if (config.hasAura) {
      const warframe = selectedEquipment as Warframe;
      const pol = hasArtifactSlots
        ? polarityFromAP(artifactSlots[8])
        : warframe.aura_polarity || undefined;
      newSlots.push({ index: idx++, type: 'aura', polarity: pol });
    }
    if (config.hasStance) {
      const pol = hasArtifactSlots
        ? polarityFromAP(artifactSlots[8])
        : undefined;
      newSlots.push({ index: idx++, type: 'stance', polarity: pol });
    }
    if (config.hasPosture) {
      newSlots.push({ index: idx++, type: 'posture' });
    }

    const generalPolarities: (string | undefined)[] = (() => {
      if (hasArtifactSlots) {
        const slotRange = artifactSlots.slice(0, config.generalSlots);
        return slotRange.reverse().map(polarityFromAP);
      }
      try {
        const wf = selectedEquipment as Warframe;
        const parsed: string[] = wf.polarities ? JSON.parse(wf.polarities) : [];
        return parsed;
      } catch {
        return [];
      }
    })();

    for (let i = 0; i < config.generalSlots; i++) {
      newSlots.push({
        index: idx++,
        type: 'general',
        polarity: generalPolarities[i] || undefined,
      });
    }

    if (config.hasExilus) {
      const warframe = selectedEquipment as Warframe;
      const pol = hasArtifactSlots
        ? polarityFromAP(artifactSlots[9])
        : warframe.exilus_polarity || undefined;
      newSlots.push({ index: idx++, type: 'exilus', polarity: pol });
    }

    setDefaultPolarities(
      newSlots.map((s) => ({ polarity: s.polarity, type: s.type })),
    );
    if (!shouldInitializeSlots) {
      return;
    }

    setSlots(newSlots);
    setHelminthConfig(undefined);
  }, [selectedEquipment, equipmentType, buildId, slots.length]);

  const canPlaceModInSlot = (mod: Mod, slotType: ModSlot['type']): boolean => {
    const modType = (mod.type || '').toUpperCase();
    if (slotType === 'aura' && modType !== 'AURA') return false;
    if (slotType === 'stance' && modType !== 'STANCE') return false;
    if (slotType === 'exilus' && mod.is_utility !== 1) return false;
    if (slotType === 'general' || slotType === 'posture') {
      if (modType === 'AURA' || modType === 'STANCE') return false;
    }
    return true;
  };

  const [searchResetKey, setSearchResetKey] = useState(0);
  const openRivenEditorForSlotRef = useRef<number | null>(null);
  const placedNewRivenRef = useRef(false);
  const showRivenLimitToastRef = useRef(false);

  const getDefaultRivenConfig = useCallback((): RivenConfig => {
    return {
      polarity: 'AP_ATTACK',
      positive: [
        { stat: '', value: 0, isNegative: false },
        { stat: '', value: 0, isNegative: false },
        { stat: '', value: 0, isNegative: false },
      ],
      negative: undefined,
    };
  }, []);

  const handleModDrop = useCallback(
    (slotIndex: number, mod: Mod) => {
      const isRivenPlaceholder = mod.unique_name === RIVEN_PLACEHOLDER_UNIQUE;
      openRivenEditorForSlotRef.current = null;
      placedNewRivenRef.current = false;
      showRivenLimitToastRef.current = false;
      setSlots((prev) => {
        const targetSlot = prev.find((s) => s.index === slotIndex);
        if (!targetSlot) return prev;

        if (isRivenPlaceholder && targetSlot.type !== 'general') return prev;
        if (!isRivenPlaceholder && !canPlaceModInSlot(mod, targetSlot.type))
          return prev;

        if (isRivenPlaceholder) {
          if (targetSlot.mod && isRivenMod(targetSlot.mod)) {
            openRivenEditorForSlotRef.current = slotIndex;
            return prev;
          }
          const existingRiven = prev.find((s) => s.mod && isRivenMod(s.mod));
          if (existingRiven && existingRiven.index !== slotIndex) {
            showRivenLimitToastRef.current = true;
            return prev;
          }
        }

        const currentMods = prev
          .filter((s) => s.mod && s.index !== slotIndex)
          .map((s) => s.mod!);

        if (!isRivenPlaceholder && isModLockedOut(mod, currentMods)) {
          return prev;
        }

        const rivenConfig = getDefaultRivenConfig();
        const resolvedMod = isRivenPlaceholder
          ? createRivenMod(rivenConfig, mod.image_path)
          : mod;
        if (isRivenPlaceholder) {
          openRivenEditorForSlotRef.current = slotIndex;
          placedNewRivenRef.current = true;
        }

        const updated = prev.map((s) =>
          s.index === slotIndex
            ? {
                ...s,
                mod: resolvedMod,
                rank: resolvedMod.fusion_limit ?? 0,
                setRank: resolvedMod.set_stats ? 1 : undefined,
                riven_config: isRivenPlaceholder ? rivenConfig : undefined,
                riven_art_path: isRivenPlaceholder ? mod.image_path : undefined,
              }
            : s,
        );
        return applySetPieceDelta(prev, updated);
      });
      if (showRivenLimitToastRef.current) {
        setRivenToastMessage('Only one Riven mod can be equipped at a time.');
        return;
      }
      if (openRivenEditorForSlotRef.current !== null) {
        setEditingRivenSlot(openRivenEditorForSlotRef.current);
        setDraftRivenSlot(
          placedNewRivenRef.current ? openRivenEditorForSlotRef.current : null,
        );
      }
      setSearchResetKey((k) => k + 1);
    },
    [getDefaultRivenConfig],
  );

  const handleSetRankChange = useCallback(
    (slotIndex: number, setRank: number) => {
      setSlots((prev) => {
        const targetSlot = prev.find((s) => s.index === slotIndex);
        if (!targetSlot) return prev;

        const setName = getSetName(targetSlot);
        if (!setName) {
          return prev.map((s) =>
            s.index === slotIndex ? { ...s, setRank } : s,
          );
        }

        const currentRank = targetSlot.setRank ?? 1;
        const delta = setRank - currentRank;
        if (delta === 0) return prev;
        return applySetRankDelta(prev, setName, delta, currentRank);
      });
    },
    [],
  );

  const handleModSwap = useCallback(
    (sourceIndex: number, targetIndex: number) => {
      if (sourceIndex === targetIndex) return;

      setSlots((prev) => {
        const source = prev.find((s) => s.index === sourceIndex);
        const target = prev.find((s) => s.index === targetIndex);
        if (!source || !target || !source.mod) return prev;

        const sourceMod = source.mod;
        const sourceRank = source.rank;
        const sourceSetRank = source.setRank;
        const sourceRivenConfig = source.riven_config;
        const sourceRivenArt = source.riven_art_path;
        const targetMod = target.mod;
        const targetRank = target.rank;
        const targetSetRank = target.setRank;
        const targetRivenConfig = target.riven_config;
        const targetRivenArt = target.riven_art_path;

        if (!canPlaceModInSlot(sourceMod, target.type)) return prev;

        if (targetMod && !canPlaceModInSlot(targetMod, source.type))
          return prev;

        const otherMods = prev
          .filter(
            (s) => s.mod && s.index !== sourceIndex && s.index !== targetIndex,
          )
          .map((s) => s.mod!);

        if (
          isModLockedOut(sourceMod, [
            ...otherMods,
            ...(targetMod ? [targetMod] : []),
          ])
        )
          return prev;

        if (targetMod && isModLockedOut(targetMod, [...otherMods, sourceMod]))
          return prev;

        const swapped = prev.map((s) => {
          if (s.index === targetIndex)
            return {
              ...s,
              mod: sourceMod,
              rank: sourceRank,
              setRank: sourceSetRank,
              riven_config: sourceRivenConfig,
              riven_art_path: sourceRivenArt,
            };
          if (s.index === sourceIndex)
            return {
              ...s,
              mod: targetMod,
              rank: targetRank,
              setRank: targetSetRank,
              riven_config: targetRivenConfig,
              riven_art_path: targetRivenArt,
            };
          return s;
        });
        return applySetPieceDelta(prev, swapped);
      });
    },
    [],
  );

  const handleModRemove = useCallback((slotIndex: number) => {
    setSlots((prev) => {
      const updated = prev.map((s) =>
        s.index === slotIndex
          ? {
              ...s,
              mod: undefined,
              rank: undefined,
              setRank: undefined,
              riven_config: undefined,
              riven_art_path: undefined,
            }
          : s,
      );
      return applySetPieceDelta(prev, updated);
    });
  }, []);

  const handleRankChange = useCallback((slotIndex: number, rank: number) => {
    setSlots((prev) =>
      prev.map((s) => (s.index === slotIndex ? { ...s, rank } : s)),
    );
  }, []);

  const capacity = useMemo(
    () => calculateTotalCapacity(slots, 30, orokinReactor),
    [slots, orokinReactor],
  );

  const formaCost = useMemo<FormaCount>(
    () =>
      calculateFormaCount(
        defaultPolarities,
        slots.map((s) => ({ polarity: s.polarity, type: s.type })),
      ),
    [defaultPolarities, slots],
  );

  const handlePolarityChange = useCallback(
    (slotIndex: number, polarity: string | undefined) => {
      setSlots((prev) =>
        prev.map((s) => (s.index === slotIndex ? { ...s, polarity } : s)),
      );
    },
    [],
  );

  const handleArcaneSlotClick = useCallback(
    (slotIndex: number) => {
      if (activeArcaneSlot === slotIndex && rightPanelMode === 'arcanes') {
        setActiveArcaneSlot(null);
        setRightPanelMode('mods');
      } else {
        setActiveArcaneSlot(slotIndex);
        setActiveShardSlot(null);
        setActiveAbilityIndex(null);
        setActiveSlotIndex(undefined);
        setActiveSlotType(undefined);
        setRightPanelMode('arcanes');
      }
    },
    [activeArcaneSlot, rightPanelMode],
  );

  const handleArcaneSelect = useCallback(
    (arcane: Arcane) => {
      if (activeArcaneSlot === null) return;
      setArcaneSlots((prev) => {
        const next = [...prev];
        next[activeArcaneSlot] = { arcane, rank: getMaxRank(arcane) };
        return next;
      });
      setActiveArcaneSlot(null);
      setRightPanelMode('mods');
    },
    [activeArcaneSlot],
  );

  const handleArcaneRemove = useCallback((slotIndex: number) => {
    setArcaneSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = { rank: 0 };
      return next;
    });
  }, []);

  const handleArcaneRankChange = useCallback(
    (slotIndex: number, rank: number) => {
      setArcaneSlots((prev) => {
        const next = [...prev];
        if (next[slotIndex]) {
          next[slotIndex] = { ...next[slotIndex], rank };
        }
        return next;
      });
    },
    [],
  );

  const handleShardSlotClick = useCallback(
    (slotIndex: number) => {
      if (activeShardSlot === slotIndex && rightPanelMode === 'shards') {
        setActiveShardSlot(null);
        setRightPanelMode('mods');
      } else {
        setActiveShardSlot(slotIndex);
        setActiveArcaneSlot(null);
        setActiveAbilityIndex(null);
        setActiveSlotIndex(undefined);
        setActiveSlotType(undefined);
        setRightPanelMode('shards');
      }
    },
    [activeShardSlot, rightPanelMode],
  );

  const handleShardSelect = useCallback(
    (shardTypeId: string, buffId: number, tauforged: boolean) => {
      if (activeShardSlot === null) return;
      setShardSlots((prev) => {
        const next = [...prev];
        next[activeShardSlot] = {
          shard_type_id: shardTypeId,
          buff_id: buffId,
          tauforged,
        };
        return next;
      });
      setActiveShardSlot(null);
      setRightPanelMode('mods');
    },
    [activeShardSlot],
  );

  const handleShardRemove = useCallback((slotIndex: number) => {
    setShardSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = { tauforged: false };
      return next;
    });
  }, []);

  const handleRivenSave = useCallback(
    (config: RivenConfig) => {
      if (editingRivenSlot === null) return;
      const normalizedConfig = normalizeRivenConfigMembership(config);
      setSlots((prev) =>
        prev.map((slot) => {
          if (slot.index !== editingRivenSlot) return slot;
          if (!slot.mod || !isRivenMod(slot.mod)) return slot;
          return {
            ...slot,
            riven_config: normalizedConfig,
            mod: createRivenMod(
              normalizedConfig,
              slot.riven_art_path ?? slot.mod.image_path,
            ),
          };
        }),
      );
      setEditingRivenSlot(null);
      setDraftRivenSlot(null);
    },
    [editingRivenSlot],
  );

  const [rivenToastMessage, setRivenToastMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!rivenToastMessage) return undefined;
    const timer = window.setTimeout(() => setRivenToastMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [rivenToastMessage]);

  const handleRivenClose = useCallback(() => {
    if (editingRivenSlot !== null && draftRivenSlot === editingRivenSlot) {
      setSlots((prev) =>
        prev.map((s) =>
          s.index === editingRivenSlot
            ? {
                ...s,
                mod: undefined,
                rank: undefined,
                setRank: undefined,
                riven_config: undefined,
                riven_art_path: undefined,
              }
            : s,
        ),
      );
    }
    setEditingRivenSlot(null);
    setDraftRivenSlot(null);
  }, [draftRivenSlot, editingRivenSlot]);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalName, setSaveModalName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  const openSaveModal = () => {
    if (!selectedEquipment) return;
    setSaveModalName(buildName);
    setSaveError(null);
    setShowSaveModal(true);
  };

  const [compareToast, setCompareToast] = useState(false);
  const compareToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (compareToastTimeoutRef.current !== null) {
        clearTimeout(compareToastTimeoutRef.current);
      }
    };
  }, []);

  const addToCompare = () => {
    if (!selectedEquipment || equipmentType === 'warframe') return;
    const weapon = selectedEquipment as Weapon;
    const calc = calculateWeaponDps(weapon, slots);
    const { totalDamage, damageBreakdown } = calculateBuildDamage(
      weapon,
      slots,
    );
    addSnapshot({
      id: crypto.randomUUID(),
      label: buildName,
      weaponName: weapon.name,
      weaponImage: weapon.image_path,
      equipmentType,
      calc,
      elementBreakdown: damageBreakdown,
      totalElementDamage: totalDamage,
      timestamp: Date.now(),
    });
    setCompareToast(true);
    if (compareToastTimeoutRef.current !== null) {
      clearTimeout(compareToastTimeoutRef.current);
    }
    compareToastTimeoutRef.current = setTimeout(() => {
      setCompareToast(false);
      compareToastTimeoutRef.current = null;
    }, 1500);
  };

  const confirmSave = async () => {
    if (!selectedEquipment) return;
    setSaveError(null);
    try {
      const finalName = saveModalName.trim() || buildName;
      setBuildName(finalName);

      const config: BuildConfig = {
        id: isOwnBuild ? currentBuildId : undefined,
        name: finalName,
        equipment_type: equipmentType,
        equipment_unique_name: selectedEquipment.unique_name,
        slots,
        helminth: helminthConfig,
        arcaneSlots,
        shardSlots,
        orokinReactor,
      };

      const imagePath = selectedEquipment.image_path
        ? `/images${selectedEquipment.image_path}`
        : undefined;

      const saveConfig: BuildConfig = isOwnBuild
        ? config
        : { ...config, name: `Copy of ${config.name}` };

      const saved = await storageSave(
        saveConfig,
        selectedEquipment.name,
        imagePath,
      );
      setCurrentBuildId(saved.id);
      setIsOwnBuild(true);
      setShowSaveModal(false);

      if (!currentBuildId || !isOwnBuild) {
        navigate(buildEditPath(saved.id), { replace: true });
      }

      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save build',
      );
    }
  };

  const arcaneSlotCount = equipmentType === 'warframe' ? 2 : 1;

  const hasSelection =
    activeSlotIndex !== undefined ||
    activeArcaneSlot !== null ||
    activeShardSlot !== null ||
    activeAbilityIndex !== null;

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.glass-panel, button, input, [role="button"], [draggable="true"]',
      )
    )
      return;
    setActiveSlotIndex(undefined);
    setActiveSlotType(undefined);
    setActiveArcaneSlot(null);
    setActiveShardSlot(null);
    setActiveAbilityIndex(null);
    setRightPanelMode('mods');
  }, []);

  return (
    <div
      className="mx-auto flex max-w-[2000px] gap-6"
      onClick={hasSelection ? handleBackgroundClick : undefined}
    >
      <div className="w-72 shrink-0 space-y-4">
        {selectedEquipment && (
          <StatsPanel
            equipment={selectedEquipment as Warframe | Weapon}
            type={equipmentType}
            slots={slots}
            shardSlots={equipmentType === 'warframe' ? shardSlots : undefined}
            shardTypes={equipmentType === 'warframe' ? shardTypes : undefined}
            abilities={
              equipmentType === 'warframe' ? (
                <AbilityBar
                  warframe={selectedEquipment as Warframe}
                  helminthConfig={helminthConfig}
                  onHelminthChange={setHelminthConfig}
                  activeAbilityIndex={activeAbilityIndex}
                  onAbilityClick={(index) => {
                    if (
                      activeAbilityIndex === index &&
                      rightPanelMode === 'helminth'
                    ) {
                      setActiveAbilityIndex(null);
                      setRightPanelMode('mods');
                    } else {
                      setActiveAbilityIndex(index);
                      setActiveArcaneSlot(null);
                      setActiveShardSlot(null);
                      setActiveSlotIndex(undefined);
                      setActiveSlotType(undefined);
                      setRightPanelMode('helminth');
                    }
                  }}
                />
              ) : undefined
            }
          />
        )}
        {selectedEquipment && equipmentType !== 'warframe' && (
          <ElementOutput weapon={selectedEquipment as Weapon} slots={slots} />
        )}
      </div>

      <div className="w-[820px] shrink-0 space-y-4">
        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-foreground">
              {buildName}
            </span>
            {!isOwnBuild ? (
              <span className="rounded border border-border px-2 py-1 text-xs font-semibold text-muted">
                Read-only shared build
              </span>
            ) : null}
            {selectedEquipment && (
              <span className="text-sm text-muted">
                {selectedEquipment.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOrokinReactor((v) => !v)}
              aria-pressed={orokinReactor}
              className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-2.5 py-1.5 text-sm text-muted transition-all hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground"
              title="Toggle Orokin Reactor"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition-colors ${
                  orokinReactor
                    ? 'bg-success/20 text-success hover:bg-success/30'
                    : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
                }`}
                aria-hidden="true"
              >
                {orokinReactor ? '\u2713' : '\u2715'}
              </span>
              Orokin Reactor
            </button>
            {equipmentType !== 'warframe' && (
              <button
                className="btn border border-glass-border text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-40"
                onClick={addToCompare}
                disabled={compareSnapshots.length >= 3}
                title={
                  compareSnapshots.length >= 3
                    ? 'Max 3 snapshots'
                    : 'Add current build to comparison'
                }
              >
                Compare
              </button>
            )}
            <button className="btn btn-accent" onClick={openSaveModal}>
              {isOwnBuild ? 'Save' : 'Copy Build'}
            </button>
          </div>
        </div>

        <CapacityBar
          capacity={capacity}
          formaCost={formaCost}
          formaMode={formaMode}
          onFormaToggle={() => setFormaMode((p) => !p)}
        />

        {selectedEquipment ? (
          <ModSlotGrid
            slots={slots}
            onDrop={handleModDrop}
            onSwap={handleModSwap}
            onRemove={handleModRemove}
            onRankChange={handleRankChange}
            onSetRankChange={handleSetRankChange}
            onEditRiven={(slotIndex) => {
              const slot = slots.find((s) => s.index === slotIndex);
              if (!slot?.mod || !isRivenMod(slot.mod)) return;
              setEditingRivenSlot(slotIndex);
              setDraftRivenSlot(null);
            }}
            activeSlotIndex={activeSlotIndex}
            onSlotClick={(slotIndex, slotType) => {
              if (activeSlotIndex === slotIndex) {
                setActiveSlotType(undefined);
                setActiveSlotIndex(undefined);
              } else {
                setActiveSlotType(slotType);
                setActiveSlotIndex(slotIndex);
              }
              setRightPanelMode('mods');
              setActiveAbilityIndex(null);
              setActiveArcaneSlot(null);
              setActiveShardSlot(null);
            }}
            formaMode={formaMode}
            onPolarityChange={handlePolarityChange}
            equipmentType={equipmentType}
          />
        ) : (
          <div className="glass-panel flex h-64 items-center justify-center">
            <p className="text-muted">Loading equipment...</p>
          </div>
        )}

        {selectedEquipment && (
          <div className="glass-panel flex items-start justify-between overflow-visible p-3">
            <ArcaneSlots
              slotCount={arcaneSlotCount}
              slots={arcaneSlots}
              activeSlot={activeArcaneSlot}
              onSlotClick={handleArcaneSlotClick}
              onRankChange={handleArcaneRankChange}
              onRemove={handleArcaneRemove}
              onDrop={(slotIndex, arcane) => {
                setArcaneSlots((prev) => {
                  const next = [...prev];
                  next[slotIndex] = { arcane, rank: getMaxRank(arcane) };
                  return next;
                });
              }}
            />
            {equipmentType === 'warframe' && (
              <ArchonShardSlots
                slots={shardSlots}
                shards={shardTypes}
                activeSlot={activeShardSlot}
                onSlotClick={handleShardSlotClick}
                onRemove={handleShardRemove}
              />
            )}
          </div>
        )}
      </div>

      <div className="min-w-[440px] flex-1">
        <div className={rightPanelMode !== 'mods' ? 'hidden' : ''}>
          <FilterPanel
            active={rightPanelMode === 'mods'}
            searchResetKey={searchResetKey}
            equipmentType={equipmentType}
            equipment={
              selectedEquipment
                ? {
                    unique_name: selectedEquipment.unique_name,
                    name: selectedEquipment.name,
                    product_category: (selectedEquipment as Weapon)
                      .product_category,
                  }
                : undefined
            }
            equippedMods={equippedMods}
            targetSlotType={activeSlotType}
            onModRemove={() => {
              if (activeSlotIndex !== undefined) {
                handleModRemove(activeSlotIndex);
              }
            }}
            onModSelect={(mod) => {
              const modType = (mod.type || '').toUpperCase();
              const isRivenPlaceholder =
                mod.unique_name === RIVEN_PLACEHOLDER_UNIQUE;
              let emptySlot;

              if (activeSlotType) {
                const targetType = isRivenPlaceholder
                  ? 'general'
                  : activeSlotType;
                emptySlot = slots.find((s) => !s.mod && s.type === targetType);
              } else if (modType === 'AURA') {
                emptySlot = slots.find((s) => !s.mod && s.type === 'aura');
              } else if (modType === 'STANCE') {
                emptySlot = slots.find((s) => !s.mod && s.type === 'stance');
              } else if (mod.is_utility === 1) {
                emptySlot = slots.find((s) => !s.mod && s.type === 'exilus');
                if (!emptySlot) {
                  emptySlot = slots.find((s) => !s.mod && s.type === 'general');
                }
              } else {
                emptySlot = slots.find((s) => !s.mod && s.type === 'general');
              }

              if (emptySlot) {
                handleModDrop(emptySlot.index, mod);
              }
            }}
          />
        </div>

        {rightPanelMode === 'helminth' && activeAbilityIndex !== null && (
          <HelminthPickerPanel
            replacingAbilityName={getAbilityName(
              selectedEquipment as Warframe,
              activeAbilityIndex,
            )}
            onSelect={(ability: Ability) => {
              setHelminthConfig({
                replaced_ability_index: activeAbilityIndex,
                replacement_ability_unique_name: ability.unique_name,
              });
              setActiveAbilityIndex(null);
              setRightPanelMode('mods');
            }}
            onRestore={() => {
              setHelminthConfig(undefined);
              setActiveAbilityIndex(null);
              setRightPanelMode('mods');
            }}
            onClose={() => {
              setActiveAbilityIndex(null);
              setRightPanelMode('mods');
            }}
          />
        )}

        {rightPanelMode === 'arcanes' && activeArcaneSlot !== null && (
          <ArcanePickerPanel
            currentArcaneName={arcaneSlots[activeArcaneSlot]?.arcane?.name}
            onSelect={handleArcaneSelect}
            onRemove={() => {
              handleArcaneRemove(activeArcaneSlot);
              setActiveArcaneSlot(null);
              setRightPanelMode('mods');
            }}
            onClose={() => {
              setActiveArcaneSlot(null);
              setRightPanelMode('mods');
            }}
          />
        )}

        {rightPanelMode === 'shards' && activeShardSlot !== null && (
          <ShardPickerPanel
            shards={shardTypes}
            currentSlot={shardSlots[activeShardSlot] || { tauforged: false }}
            onSelect={handleShardSelect}
            onRemove={() => {
              handleShardRemove(activeShardSlot);
              setActiveShardSlot(null);
              setRightPanelMode('mods');
            }}
            onClose={() => {
              setActiveShardSlot(null);
              setRightPanelMode('mods');
            }}
          />
        )}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 rounded-xl border border-glass-border bg-surface-modal p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Save Build
            </h3>
            {saveError ? (
              <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {saveError}
              </p>
            ) : null}
            <label className="mb-1 block text-xs text-muted">Build Name</label>
            <input
              type="text"
              value={saveModalName}
              onChange={(e) => setSaveModalName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void confirmSave();
                }
              }}
              className="form-input mb-4 w-full"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-accent"
                onClick={() => {
                  void confirmSave();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {saveToast && (
        <div
          className={`fixed left-1/2 z-[9999] -translate-x-1/2 rounded-lg border border-accent/30 bg-accent-weak/90 px-5 py-2.5 text-sm font-medium text-accent shadow-lg backdrop-blur transition-all ${compareSnapshots.length > 0 ? 'bottom-24' : 'bottom-6'}`}
        >
          Build saved successfully
        </div>
      )}
      {compareToast && (
        <div
          className={`fixed left-1/2 z-[9999] -translate-x-1/2 rounded-lg border border-accent/30 bg-accent-weak/90 px-5 py-2.5 text-sm font-medium text-accent shadow-lg backdrop-blur transition-all ${compareSnapshots.length > 0 ? 'bottom-24' : 'bottom-6'}`}
        >
          Added to comparison ({compareSnapshots.length}/3)
        </div>
      )}
      {editingRivenSlot !== null && rivenWeaponType && (
        <RivenBuilder
          availableStats={getRivenStatsForType(equipmentType)}
          weaponType={rivenWeaponType}
          config={slots.find((s) => s.index === editingRivenSlot)?.riven_config}
          onSave={handleRivenSave}
          onClose={handleRivenClose}
        />
      )}
      {rivenToastMessage && (
        <div
          className={`fixed left-1/2 z-[9999] -translate-x-1/2 rounded-lg border border-warning/30 bg-warning/10 px-5 py-2.5 text-sm font-medium text-warning shadow-lg backdrop-blur transition-all ${compareSnapshots.length > 0 ? 'bottom-24' : 'bottom-6'}`}
        >
          {rivenToastMessage}
        </div>
      )}
    </div>
  );
}
