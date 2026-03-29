import { lazy, Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
import { getCompanionWeaponSelectionType, isCompanionWeapon } from '../../utils/companionWeapons';
import { calculateBuildDamage } from '../../utils/damage';
import { calculateWeaponDps } from '../../utils/damageCalc';
import { calculateTotalCapacity } from '../../utils/drain';
import { calculateFormaCount, type FormaCount, type SlotPolarity } from '../../utils/formaCounter';
import { isModLockedOut, isPostureMod } from '../../utils/modFiltering';
import {
  createRivenMod,
  getRivenStatsForType,
  getRivenWeaponType,
  isRivenMod,
  RIVEN_PLACEHOLDER_UNIQUE,
} from '../../utils/riven';
import { getRequiredExaltedStanceName, matchesSpecialItemType } from '../../utils/specialItems';
import { LazySuspenseFallback } from '../ui/LazySuspenseFallback';
import { Modal } from '../ui/Modal';
import { AbilityBar } from './AbilityBar';
import { ArcaneSlots, type ArcaneSlot, type Arcane } from './ArcaneSlots';
import { ArchonShardSlots, type ShardSlotConfig, type ShardType } from './ArchonShardSlots';
import { CapacityBar } from './CapacityBar';
import { ElementOutput } from './ElementOutput';
import { ModSlotGrid } from './ModSlotGrid';
import { StatsPanel } from './StatsPanel';

/** Max wait before loading mod picker even if the browser stays busy (slow devices). */
const FILTER_PANEL_IDLE_TIMEOUT_MS = 2000;

const FilterPanelLazy = lazy(() =>
  import('./FilterPanel').then((m) => ({ default: m.FilterPanel })),
);

const BuildShareModal = lazy(() =>
  import('../Share/BuildShareModal').then((m) => ({ default: m.BuildShareModal })),
);
const HelminthPickerPanel = lazy(() =>
  import('./HelminthPickerPanel').then((m) => ({ default: m.HelminthPickerPanel })),
);
const ArcanePickerPanel = lazy(() =>
  import('./ArcanePickerPanel').then((m) => ({ default: m.ArcanePickerPanel })),
);
const ShardPickerPanel = lazy(() =>
  import('./ShardPickerPanel').then((m) => ({ default: m.ShardPickerPanel })),
);
const RivenBuilder = lazy(() =>
  import('./RivenBuilder').then((m) => ({ default: m.RivenBuilder })),
);

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
    case 'beast_claws':
      return '/api/weapons?type=SentinelWeapons';
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

function applySetPieceDelta(prevSlots: ModSlot[], nextSlots: ModSlot[]): ModSlot[] {
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
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [slots, setSlots] = useState<ModSlot[]>([]);
  const [orokinReactor, setOrokinReactor] = useState(false);
  const [buildName, setBuildName] = useState('New Build');
  const [currentBuildId, setCurrentBuildId] = useState<string | undefined>(buildId);
  const [targetEquipmentUniqueName, setTargetEquipmentUniqueName] = useState<string | null>(null);
  const [helminthConfig, setHelminthConfig] = useState<BuildConfig['helminth'] | undefined>();
  const [activeSlotType, setActiveSlotType] = useState<SlotType | undefined>();
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [equipmentLoadError, setEquipmentLoadError] = useState<string | null>(null);
  const [isOwnBuild, setIsOwnBuild] = useState(true);
  const [arcaneSlots, setArcaneSlots] = useState<ArcaneSlot[]>([{ rank: 0 }, { rank: 0 }]);
  const [shardSlots, setShardSlots] = useState<ShardSlotConfig[]>(
    Array.from({ length: 5 }, () => ({ tauforged: false })),
  );
  const [formaMode, setFormaMode] = useState(false);
  const [defaultPolarities, setDefaultPolarities] = useState<SlotPolarity[]>([]);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('mods');
  const [mountFilterPanel, setMountFilterPanel] = useState(false);
  const [activeAbilityIndex, setActiveAbilityIndex] = useState<number | null>(null);
  const [activeArcaneSlot, setActiveArcaneSlot] = useState<number | null>(null);
  const [activeShardSlot, setActiveShardSlot] = useState<number | null>(null);
  const [editingRivenSlot, setEditingRivenSlot] = useState<number | null>(null);
  const [draftRivenSlot, setDraftRivenSlot] = useState<number | null>(null);
  const autoInstalledStanceKeyRef = useRef<string | null>(null);
  const prevRightPanelModeRef = useRef<RightPanelMode | null>(null);

  const routeKey = `${buildId ?? ''}|${routeEqType ?? ''}|${equipmentId ?? ''}`;
  const prevRouteKey = useRef(routeKey);
  useEffect(() => {
    if (prevRouteKey.current === routeKey) return;
    prevRouteKey.current = routeKey;
    autoInstalledStanceKeyRef.current = null;
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
    setEquipmentLoadError(null);
    prevRightPanelModeRef.current = null;
    if (routeEqType) setEquipmentType(routeEqType as EquipmentType);
  }, [routeKey, buildId, routeEqType]);

  useEffect(() => {
    let cancelled = false;
    const kick = () => {
      void import('./FilterPanel').then(() => {
        if (!cancelled) setMountFilterPanel(true);
      });
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(kick, { timeout: FILTER_PANEL_IDLE_TIMEOUT_MS });
    } else {
      timeoutId = setTimeout(kick, 1);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined) cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const prev = prevRightPanelModeRef.current;
    prevRightPanelModeRef.current = rightPanelMode;
    if (rightPanelMode === 'mods' && prev !== null && prev !== 'mods') {
      setMountFilterPanel(true);
    }
  }, [rightPanelMode]);

  const apiUrl = getEquipmentListUrl(equipmentType);
  const { data: equipmentData } = useApi<{ items: Equipment[] }>(apiUrl);

  const { data: shardData } = useApi<{ shards: ShardType[] }>('/api/archon-shards');
  const shardTypes = shardData?.shards || [];
  const { data: stanceData } = useApi<{ items: Mod[] }>('/api/mods?types=STANCE');

  const { addSnapshot, snapshots: compareSnapshots } = useCompare();

  const resolveSpecialItem = useCallback(
    async (targetUniqueName: string): Promise<Equipment | null> => {
      if (
        equipmentType !== 'primary' &&
        equipmentType !== 'secondary' &&
        equipmentType !== 'melee' &&
        equipmentType !== 'beast_claws' &&
        equipmentType !== 'necramech' &&
        equipmentType !== 'archgun' &&
        equipmentType !== 'archmelee'
      ) {
        return null;
      }

      const companionPromise = apiFetch('/api/weapons?type=SentinelWeapons').catch(() => null);
      const response = await apiFetch('/api/weapons?type=SpecialItems');
      if (!response.ok) return null;
      const data = (await response.json()) as { items?: Weapon[] };
      const specialItem = (data.items ?? []).find(
        (item) =>
          item.unique_name === targetUniqueName && matchesSpecialItemType(item.name, equipmentType),
      );
      if (specialItem) return specialItem;

      const companionResponse = await companionPromise;
      if (!companionResponse || !companionResponse.ok) return null;
      const companionData = (await companionResponse.json()) as {
        items?: Weapon[];
      };
      const companionWeapon = (companionData.items ?? []).find(
        (item) =>
          item.unique_name === targetUniqueName &&
          getCompanionWeaponSelectionType(item) === equipmentType,
      );
      return companionWeapon ?? null;
    },
    [equipmentType],
  );

  useEffect(() => {
    if (loaded) return undefined;
    let alive = true;

    async function loadBuildFromApi(targetBuildId: string): Promise<void> {
      const response = await apiFetch(`/api/builds/${targetBuildId}`);
      if (!response.ok) {
        if (alive) {
          setEquipmentLoadError(`Failed to load build (${response.status})`);
        }
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
        if (alive) {
          setEquipmentLoadError('Build payload was missing expected data');
        }
        return;
      }
      const config = (body.build.mod_config ?? {}) as Partial<BuildConfig>;
      if (!alive) return;
      setEquipmentType(body.build.equipment_type);
      setBuildName(typeof config.name === 'string' ? config.name : body.build.name);
      setTargetEquipmentUniqueName(body.build.equipment_unique_name);
      setCurrentBuildId(String(body.build.id));
      setIsOwnBuild(true);
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
      setEquipmentLoadError(null);
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
        if (stored.slots?.length) setSlots(stored.slots as ModSlot[]);
        if (stored.arcaneSlots) setArcaneSlots(stored.arcaneSlots as ArcaneSlot[]);
        if (stored.shardSlots) setShardSlots(stored.shardSlots as ShardSlotConfig[]);
        if (stored.orokinReactor !== undefined) setOrokinReactor(stored.orokinReactor);
        if (!stored.slots?.length) {
          void loadBuildFromApi(buildId);
        }
      } else {
        void loadBuildFromApi(buildId);
      }
    } else if (routeEqType && equipmentId) {
      setEquipmentType(routeEqType as EquipmentType);
    }
    return () => {
      alive = false;
    };
  }, [buildId, routeEqType, equipmentId, getBuild, loaded]);

  useEffect(() => {
    if (!equipmentData?.items?.length) return undefined;
    let alive = true;

    async function setSpecialItemSelection(targetUniqueName: string): Promise<void> {
      if (selectedEquipment || loaded) return;
      const specialItem = await resolveSpecialItem(targetUniqueName);
      if (!alive) return;
      if (specialItem) {
        setSelectedEquipment(specialItem);
        setLoaded(true);
        setEquipmentLoadError(null);
      }
    }

    if (buildId && !loaded) {
      const targetUniqueName =
        targetEquipmentUniqueName ?? (isOwnBuild ? getBuild(buildId)?.equipment_unique_name : null);
      if (targetUniqueName) {
        const item = equipmentData.items.find((i) => i.unique_name === targetUniqueName);
        if (item) {
          setSelectedEquipment(item);
          setLoaded(true);
          setEquipmentLoadError(null);
        } else {
          void setSpecialItemSelection(targetUniqueName).catch((error) => {
            const message =
              error instanceof Error ? error.message : 'Failed to load special equipment.';
            setEquipmentLoadError(message);
          });
        }
      }
    } else if (equipmentId && !loaded) {
      const decodedId = decodeURIComponent(equipmentId);
      const item = equipmentData.items.find((i) => i.unique_name === decodedId);
      if (item) {
        setSelectedEquipment(item);
        setLoaded(true);
        setEquipmentLoadError(null);
      } else {
        void setSpecialItemSelection(decodedId).catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Failed to load special equipment.';
          setEquipmentLoadError(message);
        });
      }
    }
    return () => {
      alive = false;
    };
  }, [
    equipmentData,
    buildId,
    equipmentId,
    getBuild,
    isOwnBuild,
    loaded,
    targetEquipmentUniqueName,
    resolveSpecialItem,
    selectedEquipment,
    setEquipmentLoadError,
  ]);

  useEffect(() => {
    if (!loaded || !buildId || !isOwnBuild) return;
    const stored = getBuild(buildId);
    if (stored?.slots?.length) {
      setSlots(stored.slots);
    }
  }, [loaded, buildId, getBuild, isOwnBuild]);

  const equippedMods = useMemo(() => slots.filter((s) => s.mod).map((s) => s.mod!), [slots]);
  const selectedRequiredExaltedStanceName = useMemo(() => {
    if (equipmentType !== 'melee' || !selectedEquipment?.name) {
      return null;
    }
    return getRequiredExaltedStanceName(selectedEquipment.name);
  }, [equipmentType, selectedEquipment?.name]);
  const autoInstallStanceMod = useMemo(() => {
    if (!selectedEquipment || !selectedRequiredExaltedStanceName) {
      return null;
    }
    const stanceMods = stanceData?.items ?? [];
    const found = stanceMods.find(
      (mod) =>
        (mod.type || '').toUpperCase() === 'STANCE' &&
        !isPostureMod(mod) &&
        mod.name.trim().toLowerCase() === selectedRequiredExaltedStanceName.toLowerCase(),
    );
    if (found) {
      return found;
    }
    const syntheticUniqueName = `/Synthetic/SpecialItems/Stances/${selectedEquipment.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
    return {
      unique_name: syntheticUniqueName,
      name: selectedRequiredExaltedStanceName,
      type: 'STANCE',
      compat_name: selectedEquipment.name,
      rarity: 'COMMON',
      base_drain: 0,
      fusion_limit: 5,
    } satisfies Mod;
  }, [selectedEquipment, selectedRequiredExaltedStanceName, stanceData?.items]);
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

    const config = EQUIPMENT_SLOT_CONFIGS[equipmentType] || EQUIPMENT_SLOT_CONFIGS.warframe;
    const companionWeaponSelectionTypes: EquipmentType[] = [
      'primary',
      'secondary',
      'melee',
      'beast_claws',
    ];
    const isSelectedCompanionWeapon =
      companionWeaponSelectionTypes.includes(equipmentType) &&
      isCompanionWeapon(selectedEquipment as Weapon);
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
      return (POLARITIES as Record<string, string>)[ap as PolarityKey] ? ap : undefined;
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
      const pol = hasArtifactSlots ? polarityFromAP(artifactSlots[8]) : undefined;
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

    if (config.hasExilus && !isSelectedCompanionWeapon) {
      const warframe = selectedEquipment as Warframe;
      const pol = hasArtifactSlots
        ? polarityFromAP(artifactSlots[9])
        : warframe.exilus_polarity || undefined;
      newSlots.push({ index: idx++, type: 'exilus', polarity: pol });
    }

    setDefaultPolarities(newSlots.map((s) => ({ polarity: s.polarity, type: s.type })));
    if (!shouldInitializeSlots) {
      return;
    }

    setSlots(newSlots);
    setHelminthConfig(undefined);
  }, [selectedEquipment, equipmentType, buildId, slots.length]);

  useEffect(() => {
    if (buildId || equipmentType !== 'melee' || !selectedEquipment?.unique_name) {
      return;
    }
    if (!selectedRequiredExaltedStanceName || !autoInstallStanceMod) {
      return;
    }
    const autoInstallKey = `${equipmentType}:${selectedEquipment.unique_name}`;
    if (autoInstalledStanceKeyRef.current === autoInstallKey) {
      return;
    }

    let didInstall = false;
    setSlots((prev) => {
      const stanceSlot = prev.find((slot) => slot.type === 'stance');
      if (!stanceSlot || stanceSlot.mod) {
        return prev;
      }

      const modType = (autoInstallStanceMod.type || '').toUpperCase();
      if (
        modType !== 'STANCE' ||
        isPostureMod(autoInstallStanceMod) ||
        autoInstallStanceMod.name.trim().toLowerCase() !==
          selectedRequiredExaltedStanceName.toLowerCase()
      ) {
        return prev;
      }

      const currentMods = prev
        .filter((slot) => slot.mod && slot.index !== stanceSlot.index)
        .map((slot) => slot.mod!);
      if (isModLockedOut(autoInstallStanceMod, currentMods)) {
        return prev;
      }

      didInstall = true;
      const updated = prev.map((slot) =>
        slot.index === stanceSlot.index
          ? {
              ...slot,
              mod: autoInstallStanceMod,
              rank: autoInstallStanceMod.fusion_limit ?? 0,
              setRank: autoInstallStanceMod.set_stats ? 1 : undefined,
            }
          : slot,
      );
      return applySetPieceDelta(prev, updated);
    });

    if (didInstall) {
      autoInstalledStanceKeyRef.current = autoInstallKey;
    }
  }, [
    buildId,
    equipmentType,
    selectedEquipment?.unique_name,
    selectedRequiredExaltedStanceName,
    autoInstallStanceMod,
  ]);

  const canPlaceModInSlot = (mod: Mod, slotType: ModSlot['type']): boolean => {
    const modType = (mod.type || '').toUpperCase();
    if (slotType === 'aura' && modType !== 'AURA') return false;
    if (slotType === 'stance' && (modType !== 'STANCE' || isPostureMod(mod))) {
      return false;
    }
    if (
      slotType === 'stance' &&
      selectedRequiredExaltedStanceName &&
      mod.name.trim().toLowerCase() !== selectedRequiredExaltedStanceName.toLowerCase()
    ) {
      return false;
    }
    if (slotType === 'posture' && (modType !== 'STANCE' || !isPostureMod(mod))) {
      return false;
    }
    if (slotType === 'exilus' && mod.is_utility !== 1) return false;
    if (slotType === 'general') {
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
        if (!isRivenPlaceholder && !canPlaceModInSlot(mod, targetSlot.type)) return prev;

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

        const currentMods = prev.filter((s) => s.mod && s.index !== slotIndex).map((s) => s.mod!);

        if (!isRivenPlaceholder && isModLockedOut(mod, currentMods)) {
          return prev;
        }

        const rivenConfig = getDefaultRivenConfig();
        const resolvedMod = isRivenPlaceholder ? createRivenMod(rivenConfig, mod.image_path) : mod;
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
        setDraftRivenSlot(placedNewRivenRef.current ? openRivenEditorForSlotRef.current : null);
      }
      setSearchResetKey((k) => k + 1);
    },
    [getDefaultRivenConfig],
  );

  const handleSetRankChange = useCallback((slotIndex: number, setRank: number) => {
    setSlots((prev) => {
      const targetSlot = prev.find((s) => s.index === slotIndex);
      if (!targetSlot) return prev;

      const setName = getSetName(targetSlot);
      if (!setName) {
        return prev.map((s) => (s.index === slotIndex ? { ...s, setRank } : s));
      }

      const currentRank = targetSlot.setRank ?? 1;
      const delta = setRank - currentRank;
      if (delta === 0) return prev;
      return applySetRankDelta(prev, setName, delta, currentRank);
    });
  }, []);

  const handleModSwap = useCallback((sourceIndex: number, targetIndex: number) => {
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

      if (targetMod && !canPlaceModInSlot(targetMod, source.type)) return prev;

      const otherMods = prev
        .filter((s) => s.mod && s.index !== sourceIndex && s.index !== targetIndex)
        .map((s) => s.mod!);

      if (isModLockedOut(sourceMod, [...otherMods, ...(targetMod ? [targetMod] : [])])) return prev;

      if (targetMod && isModLockedOut(targetMod, [...otherMods, sourceMod])) return prev;

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
  }, []);

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
    setSlots((prev) => prev.map((s) => (s.index === slotIndex ? { ...s, rank } : s)));
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

  const handlePolarityChange = useCallback((slotIndex: number, polarity: string | undefined) => {
    setSlots((prev) => prev.map((s) => (s.index === slotIndex ? { ...s, polarity } : s)));
  }, []);

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

  const handleArcaneRankChange = useCallback((slotIndex: number, rank: number) => {
    setArcaneSlots((prev) => {
      const next = [...prev];
      if (next[slotIndex]) {
        next[slotIndex] = { ...next[slotIndex], rank };
      }
      return next;
    });
  }, []);

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
      const rank = config.rivenRank ?? 8;
      setSlots((prev) =>
        prev.map((slot) => {
          if (slot.index !== editingRivenSlot) return slot;
          if (!slot.mod || !isRivenMod(slot.mod)) return slot;
          return {
            ...slot,
            rank,
            riven_config: config,
            mod: createRivenMod(config, slot.riven_art_path ?? slot.mod.image_path),
          };
        }),
      );
      setEditingRivenSlot(null);
      setDraftRivenSlot(null);
    },
    [editingRivenSlot],
  );

  const [rivenToastMessage, setRivenToastMessage] = useState<string | null>(null);

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
  const [showShareModal, setShowShareModal] = useState(false);
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
  const compareToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const { totalDamage, damageBreakdown } = calculateBuildDamage(weapon, slots);
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

      const saved = await storageSave(saveConfig, selectedEquipment.name, imagePath);
      setCurrentBuildId(saved.id);
      setIsOwnBuild(true);
      setShowSaveModal(false);

      if (!currentBuildId || !isOwnBuild) {
        navigate(buildEditPath(saved.id), { replace: true });
      }

      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save build');
    }
  };

  const arcaneSlotCount = equipmentType === 'warframe' ? 2 : 1;
  const selectedWeaponTypes: EquipmentType[] = [
    'primary',
    'secondary',
    'melee',
    'archgun',
    'archmelee',
    'beast_claws',
  ];
  const selectedWeapon =
    selectedEquipment && selectedWeaponTypes.includes(equipmentType)
      ? (selectedEquipment as Weapon)
      : null;
  const rivenDisposition =
    selectedWeapon?.riven_disposition ?? selectedWeapon?.omega_attenuation ?? 1;
  const selectedIsCompanionWeapon = selectedWeapon != null && isCompanionWeapon(selectedWeapon);
  const supportsArcanes =
    !selectedIsCompanionWeapon &&
    equipmentType !== 'companion' &&
    equipmentType !== 'archgun' &&
    equipmentType !== 'archmelee' &&
    equipmentType !== 'archwing' &&
    equipmentType !== 'necramech';
  const selectedEquipmentImagePath = selectedEquipment?.image_path
    ? `/images${selectedEquipment.image_path}`
    : undefined;

  useEffect(() => {
    if (!selectedIsCompanionWeapon) return;
    setSlots((prev) => {
      if (!prev.some((slot) => slot.type === 'exilus')) {
        return prev;
      }
      return prev
        .filter((slot) => slot.type !== 'exilus')
        .map((slot, index) => ({ ...slot, index }));
    });
  }, [selectedIsCompanionWeapon]);

  const hasSelection =
    activeSlotIndex !== undefined ||
    activeArcaneSlot !== null ||
    activeShardSlot !== null ||
    activeAbilityIndex !== null;

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.glass-panel, .mod-builder-side-panel, button, input, [role="button"], [draggable="true"]',
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
      className="mx-auto max-w-[2000px] space-y-6"
      onClick={hasSelection ? handleBackgroundClick : undefined}
    >
      <div className="flex flex-col gap-6 2xl:flex-row">
        <div className="w-full shrink-0 space-y-4 2xl:w-72">
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
                      if (activeAbilityIndex === index && rightPanelMode === 'helminth') {
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

        <div className="w-full shrink-0 space-y-4 2xl:w-[820px]">
          <div className="glass-shell p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                  <span className="display-title text-foreground text-[2rem]">{buildName}</span>
                  {!isOwnBuild && (
                    <span className="text-muted/70 text-xs">Read-only shared build</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrokinReactor((v) => !v)}
                  aria-pressed={orokinReactor}
                  className="btn btn-secondary"
                  title="Toggle Orokin Reactor"
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                      orokinReactor ? 'bg-success/20 text-success' : 'bg-muted/10 text-muted/50'
                    }`}
                    aria-hidden="true"
                  >
                    {orokinReactor ? '\u2713' : '\u2715'}
                  </span>
                  Orokin Reactor
                </button>
                {equipmentType !== 'warframe' && (
                  <button
                    className="btn btn-secondary text-sm"
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
                  {isOwnBuild ? 'Save Build' : 'Copy Build'}
                </button>
                {selectedEquipment && (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setShowShareModal(true)}
                  >
                    Share Image
                  </button>
                )}
              </div>
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
            <div className="glass-shell empty-state">
              <h2 className="empty-state__title">Preparing equipment</h2>
              <p className="empty-state__body">
                {equipmentLoadError
                  ? `Failed to load equipment: ${equipmentLoadError}`
                  : 'Loading equipment and assembling the builder surface.'}
              </p>
            </div>
          )}

          {selectedEquipment && (
            <div className="glass-shell p-4">
              <div className="flex min-h-[136px] items-start justify-between gap-3 overflow-visible">
                {supportsArcanes && (
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
                )}
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
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="glass-shell p-4 sm:p-5">
            <div>
              <div className={rightPanelMode !== 'mods' ? 'hidden' : ''}>
                {mountFilterPanel ? (
                  <Suspense fallback={<LazySuspenseFallback />}>
                    <FilterPanelLazy
                      active={rightPanelMode === 'mods'}
                      searchResetKey={searchResetKey}
                      equipmentType={equipmentType}
                      equipment={
                        selectedEquipment
                          ? {
                              unique_name: selectedEquipment.unique_name,
                              name: selectedEquipment.name,
                              product_category: (selectedEquipment as Weapon).product_category,
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
                        const isRivenPlaceholder = mod.unique_name === RIVEN_PLACEHOLDER_UNIQUE;
                        let emptySlot;

                        if (activeSlotType) {
                          const targetType = isRivenPlaceholder ? 'general' : activeSlotType;
                          emptySlot = slots.find((s) => !s.mod && s.type === targetType);
                        } else if (modType === 'AURA') {
                          emptySlot = slots.find((s) => !s.mod && s.type === 'aura');
                        } else if (modType === 'STANCE') {
                          const stanceSlotType = isPostureMod(mod) ? 'posture' : 'stance';
                          emptySlot = slots.find((s) => !s.mod && s.type === stanceSlotType);
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
                  </Suspense>
                ) : (
                  <LazySuspenseFallback />
                )}
              </div>

              {rightPanelMode === 'helminth' && activeAbilityIndex !== null ? (
                <Suspense fallback={<LazySuspenseFallback />}>
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
                </Suspense>
              ) : null}

              {rightPanelMode === 'arcanes' && activeArcaneSlot !== null ? (
                <Suspense fallback={<LazySuspenseFallback />}>
                  <ArcanePickerPanel
                    equipmentType={equipmentType}
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
                </Suspense>
              ) : null}

              {rightPanelMode === 'shards' && activeShardSlot !== null ? (
                <Suspense fallback={<LazySuspenseFallback />}>
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
                </Suspense>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <Modal
          open
          onClose={() => setShowSaveModal(false)}
          ariaLabelledBy="save-build-title"
          className="max-w-md"
        >
          <h3 id="save-build-title" className="text-foreground mb-4 text-lg font-semibold">
            Save Build
          </h3>
          {saveError ? <p className="error-msg mb-3">{saveError}</p> : null}
          <label className="text-muted mb-2 block text-xs tracking-[0.18em] uppercase">
            Build Name
          </label>
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
            <button
              className="btn btn-secondary"
              onClick={() => setShowSaveModal(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn btn-accent"
              onClick={() => {
                void confirmSave();
              }}
              type="button"
            >
              Save
            </button>
          </div>
        </Modal>
      )}
      {showShareModal && selectedEquipment ? (
        <Suspense fallback={<LazySuspenseFallback />}>
          <BuildShareModal
            open
            onClose={() => setShowShareModal(false)}
            buildName={buildName}
            equipment={selectedEquipment as Warframe | Weapon}
            equipmentName={selectedEquipment.name}
            equipmentType={equipmentType}
            equipmentImagePath={selectedEquipmentImagePath}
            slots={slots}
            arcaneSlots={arcaneSlots}
            shardSlots={shardSlots}
            shardTypes={equipmentType === 'warframe' ? shardTypes : []}
            orokinReactor={orokinReactor}
            formaCost={formaCost}
            helminthConfig={equipmentType === 'warframe' ? helminthConfig : undefined}
          />
        </Suspense>
      ) : null}

      {saveToast && (
        <div
          className={`toast-surface fixed left-1/2 z-[9999] -translate-x-1/2 text-sm font-medium transition-[bottom,transform,opacity] duration-300 ease-out ${compareSnapshots.length > 0 ? 'bottom-28' : 'bottom-6'}`}
          data-tone="success"
        >
          Build saved successfully
        </div>
      )}
      {compareToast && (
        <div
          className={`toast-surface fixed left-1/2 z-[9999] -translate-x-1/2 text-sm font-medium transition-[bottom,transform,opacity] duration-300 ease-out ${compareSnapshots.length > 0 ? 'bottom-28' : 'bottom-6'}`}
        >
          Added to comparison ({compareSnapshots.length}/3)
        </div>
      )}
      {editingRivenSlot !== null && rivenWeaponType ? (
        <Suspense fallback={<LazySuspenseFallback />}>
          <RivenBuilder
            availableStats={getRivenStatsForType(equipmentType)}
            weaponType={rivenWeaponType}
            weaponDisposition={rivenDisposition}
            config={slots.find((s) => s.index === editingRivenSlot)?.riven_config}
            onSave={handleRivenSave}
            onClose={handleRivenClose}
          />
        </Suspense>
      ) : null}
      {rivenToastMessage && (
        <div
          className={`toast-surface fixed left-1/2 z-[9999] -translate-x-1/2 text-sm font-medium transition-[bottom,transform,opacity] duration-300 ease-out ${compareSnapshots.length > 0 ? 'bottom-28' : 'bottom-6'}`}
          data-tone="warning"
        >
          {rivenToastMessage}
        </div>
      )}
    </div>
  );
}
