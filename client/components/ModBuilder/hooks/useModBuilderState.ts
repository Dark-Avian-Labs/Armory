import { useEffect, useRef, useState } from 'react';

import type { IncarnonSelection } from '../../../types/incarnon';
import type {
  BuildConfig,
  EquipmentType,
  ModSlot,
  SlotType,
  ValenceBonus,
} from '../../../types/warframe';
import type { ArcaneSlot } from '../ArcaneSlots';
import type { ShardSlotConfig } from '../ArchonShardSlots';

type Equipment =
  | import('../../../types/warframe').Warframe
  | import('../../../types/warframe').Weapon
  | import('../../../types/warframe').Companion;

type RightPanelMode = 'mods' | 'helminth' | 'incarnon' | 'arcanes' | 'shards';

export function useModBuilderState(
  routeKey: string,
  buildId: string | undefined,
  routeEqType: string | undefined,
) {
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(
    (routeEqType as EquipmentType) || 'warframe',
  );
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [slots, setSlots] = useState<ModSlot[]>([]);
  const [orokinReactor, setOrokinReactor] = useState(false);
  const [valenceBonus, setValenceBonus] = useState<ValenceBonus | null>(null);
  const [buildName, setBuildName] = useState('New Build');
  const [buildDescription, setBuildDescription] = useState('');
  const [currentBuildId, setCurrentBuildId] = useState<string | undefined>(buildId);
  const [targetEquipmentUniqueName, setTargetEquipmentUniqueName] = useState<string | null>(null);
  const [helminthConfig, setHelminthConfig] = useState<BuildConfig['helminth'] | undefined>();
  const [incarnonEnabled, setIncarnonEnabled] = useState(false);
  const [incarnonSelections, setIncarnonSelections] = useState<IncarnonSelection[] | undefined>();
  const [activeIncarnonTier, setActiveIncarnonTier] = useState<number | null>(null);
  const [activeSlotType, setActiveSlotType] = useState<SlotType | undefined>();
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [equipmentLoadError, setEquipmentLoadError] = useState<string | null>(null);
  const [isOwnBuild, setIsOwnBuild] = useState(true);
  const [isBuildOwner, setIsBuildOwner] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [buildOwnerUserId, setBuildOwnerUserId] = useState<string | null>(null);
  const [buildOwnerUsername, setBuildOwnerUsername] = useState<string | null>(null);
  const [buildIsPublic, setBuildIsPublic] = useState(false);
  const [arcaneSlots, setArcaneSlots] = useState<ArcaneSlot[]>([{ rank: 0 }, { rank: 0 }]);
  const [shardSlots, setShardSlots] = useState<ShardSlotConfig[]>(
    Array.from({ length: 5 }, () => ({ tauforged: false })),
  );
  const [formaMode, setFormaMode] = useState(false);
  const [defaultPolarities, setDefaultPolarities] = useState<
    import('../../../utils/formaCounter').SlotPolarity[]
  >([]);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('mods');
  const [mountFilterPanel, setMountFilterPanel] = useState(false);
  const [activeAbilityIndex, setActiveAbilityIndex] = useState<number | null>(null);
  const [activeArcaneSlot, setActiveArcaneSlot] = useState<number | null>(null);
  const [activeShardSlot, setActiveShardSlot] = useState<number | null>(null);
  const [editingRivenSlot, setEditingRivenSlot] = useState<number | null>(null);
  const [draftRivenSlot, setDraftRivenSlot] = useState<number | null>(null);
  const [dirtyBaseline, setDirtyBaseline] = useState<string | null>(null);

  const prevRouteKey = useRef(routeKey);
  const dirtyRouteCapturedRef = useRef<string | null>(null);
  const prevRightPanelModeRef = useRef<RightPanelMode | null>(null);

  useEffect(() => {
    if (prevRouteKey.current === routeKey) return;
    prevRouteKey.current = routeKey;
    dirtyRouteCapturedRef.current = null;
    setDirtyBaseline(null);
    setSelectedEquipment(null);
    setSlots([]);
    setOrokinReactor(false);
    setBuildName('New Build');
    setBuildDescription('');
    setCurrentBuildId(buildId);
    setTargetEquipmentUniqueName(null);
    setIsOwnBuild(true);
    setIsBuildOwner(true);
    setIsFavorited(false);
    setBuildOwnerUserId(null);
    setBuildOwnerUsername(null);
    setBuildIsPublic(false);
    setHelminthConfig(undefined);
    setIncarnonEnabled(false);
    setIncarnonSelections(undefined);
    setActiveIncarnonTier(null);
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
    setValenceBonus(null);
    if (routeEqType) setEquipmentType(routeEqType as EquipmentType);
  }, [routeKey, buildId, routeEqType]);

  return {
    equipmentType,
    setEquipmentType,
    selectedEquipment,
    setSelectedEquipment,
    slots,
    setSlots,
    orokinReactor,
    setOrokinReactor,
    valenceBonus,
    setValenceBonus,
    buildName,
    setBuildName,
    buildDescription,
    setBuildDescription,
    currentBuildId,
    setCurrentBuildId,
    targetEquipmentUniqueName,
    setTargetEquipmentUniqueName,
    helminthConfig,
    setHelminthConfig,
    incarnonEnabled,
    setIncarnonEnabled,
    incarnonSelections,
    setIncarnonSelections,
    activeIncarnonTier,
    setActiveIncarnonTier,
    activeSlotType,
    setActiveSlotType,
    activeSlotIndex,
    setActiveSlotIndex,
    loaded,
    setLoaded,
    equipmentLoadError,
    setEquipmentLoadError,
    isOwnBuild,
    setIsOwnBuild,
    isBuildOwner,
    setIsBuildOwner,
    isFavorited,
    setIsFavorited,
    buildOwnerUserId,
    setBuildOwnerUserId,
    buildOwnerUsername,
    setBuildOwnerUsername,
    buildIsPublic,
    setBuildIsPublic,
    arcaneSlots,
    setArcaneSlots,
    shardSlots,
    setShardSlots,
    formaMode,
    setFormaMode,
    defaultPolarities,
    setDefaultPolarities,
    rightPanelMode,
    setRightPanelMode,
    mountFilterPanel,
    setMountFilterPanel,
    activeAbilityIndex,
    setActiveAbilityIndex,
    activeArcaneSlot,
    setActiveArcaneSlot,
    activeShardSlot,
    setActiveShardSlot,
    editingRivenSlot,
    setEditingRivenSlot,
    draftRivenSlot,
    setDraftRivenSlot,
    dirtyBaseline,
    setDirtyBaseline,
    dirtyRouteCapturedRef,
    prevRightPanelModeRef,
  };
}
