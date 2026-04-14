import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPE_ORDER,
  type EquipmentType,
} from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { getCompanionWeaponSelectionType } from '../../utils/companionWeapons';
import {
  getSpecialItemSelectionType as getSpecialItemSelectionTypeByName,
  normalizeEquipmentName,
} from '../../utils/specialItems';

export interface EquipmentItem {
  unique_name: string;
  name: string;
  image_path?: string;
  mastery_req: number;
  product_category?: string;
  slot?: number | null;
  sentinel?: number;
  selection_type?: EquipmentType;
}

export type EquipmentPickerTab = EquipmentType | 'companion_weapon';

export const CATEGORY_API: Record<EquipmentPickerTab, string> = {
  warframe: '/api/warframes',
  primary: '/api/weapons?type=LongGuns',
  secondary: '/api/weapons?type=Pistols',
  melee: '/api/weapons?type=Melee',
  companion_weapon: '/api/weapons?type=SentinelWeapons',
  archgun: '/api/weapons?type=SpaceGuns',
  archmelee: '/api/weapons?type=SpaceMelee',
  companion: '/api/companions',
  beast_claws: '',
  archwing: '/api/warframes',
  necramech: '/api/warframes',
  kdrive: '',
  tektolyst: '',
};

export const HIDDEN_EMPTY_TABS = new Set<EquipmentType>(['beast_claws', 'kdrive', 'tektolyst']);

export const TAB_ORDER: EquipmentPickerTab[] = (() => {
  const INSERT_INDEX = 5;
  if (EQUIPMENT_TYPE_ORDER.length < INSERT_INDEX) {
    return [...EQUIPMENT_TYPE_ORDER, 'companion_weapon'];
  }
  return [
    ...EQUIPMENT_TYPE_ORDER.slice(0, INSERT_INDEX),
    'companion_weapon',
    ...EQUIPMENT_TYPE_ORDER.slice(INSERT_INDEX),
  ];
})();

export const TAB_LABELS: Record<EquipmentPickerTab, string> = {
  ...EQUIPMENT_TYPE_LABELS,
  companion_weapon: 'Companion Weapons',
};

function getSpecialItemSelectionTypeForItem(
  item: EquipmentItem,
  equipmentType: EquipmentType,
): EquipmentType | null {
  if (item.product_category !== 'SpecialItems') return null;
  return getSpecialItemSelectionTypeByName(item.name, equipmentType);
}

export async function loadEquipmentItemsForTab(
  activeTab: EquipmentPickerTab,
): Promise<EquipmentItem[]> {
  const url = CATEGORY_API[activeTab];
  if (!url) {
    return [];
  }

  let list: EquipmentItem[] = [];

  const shouldMergeSpecialItems =
    activeTab === 'primary' ||
    activeTab === 'secondary' ||
    activeTab === 'melee' ||
    activeTab === 'necramech';

  if (shouldMergeSpecialItems) {
    const [baseRes, specialRes] = await Promise.all([
      apiFetch(url),
      apiFetch('/api/weapons?type=SpecialItems'),
    ]);
    const baseData = (await baseRes.json()) as {
      items?: EquipmentItem[];
    };
    const specialData = (await specialRes.json()) as {
      items?: EquipmentItem[];
    };

    const mappedSpecials: EquipmentItem[] = [];
    for (const item of specialData.items || []) {
      const selectionType = getSpecialItemSelectionTypeForItem(item, activeTab);
      if (!selectionType) continue;
      mappedSpecials.push({ ...item, selection_type: selectionType });
    }

    const merged = [...(baseData.items || []), ...mappedSpecials];
    const byUnique = new Map<string, EquipmentItem>();
    for (const item of merged) byUnique.set(item.unique_name, item);
    list = Array.from(byUnique.values());
  } else {
    const response = await apiFetch(url);
    const data = (await response.json()) as { items?: EquipmentItem[] };
    list = data.items || [];
  }

  if (activeTab === 'warframe') {
    list = list.filter((i) => {
      const cat = i.product_category;
      return !cat || cat === 'Suits';
    });
  } else if (activeTab === 'secondary') {
    list = list.filter((i) => i.slot === 0);
  } else if (activeTab === 'companion_weapon') {
    list = list
      .map((item) => ({
        ...item,
        selection_type: getCompanionWeaponSelectionType(item) ?? undefined,
      }))
      .filter((item) => item.selection_type != null);
  } else if (activeTab === 'archwing') {
    list = list.filter((i) => i.product_category === 'SpaceSuits');
  } else if (activeTab === 'necramech') {
    list = list.filter((i) => i.product_category === 'MechSuits' || i.selection_type != null);
  }

  list = list.sort((a, b) =>
    normalizeEquipmentName(a.name).localeCompare(normalizeEquipmentName(b.name)),
  );

  return list;
}

export function catalogKeyForItem(equipmentType: EquipmentType, uniqueName: string): string {
  return `${equipmentType}\t${uniqueName}`;
}
