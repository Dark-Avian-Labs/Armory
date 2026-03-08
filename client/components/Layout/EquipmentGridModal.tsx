import { useState, useEffect } from 'react';

import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPE_ORDER,
  type EquipmentType,
} from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import {
  getSpecialItemSelectionType as getSpecialItemSelectionTypeByName,
  normalizeEquipmentName,
} from '../../utils/specialItems';
import { Modal } from '../ui/Modal';

interface EquipmentItem {
  unique_name: string;
  name: string;
  image_path?: string;
  mastery_req: number;
  product_category?: string;
  selection_type?: EquipmentType;
}

interface EquipmentGridModalProps {
  onSelect: (equipmentType: string, uniqueName: string) => void;
  onClose: () => void;
}

const CATEGORY_API: Record<EquipmentType, string> = {
  warframe: '/api/warframes',
  primary: '/api/weapons?type=LongGuns',
  secondary: '/api/weapons?type=Pistols',
  melee: '/api/weapons?type=Melee',
  archgun: '/api/weapons?type=SpaceGuns',
  archmelee: '/api/weapons?type=SpaceMelee',
  companion: '/api/companions',
  beast_claws: '',
  archwing: '/api/warframes',
  necramech: '/api/warframes',
  kdrive: '',
  tektolyst: '',
};

const HIDDEN_EMPTY_TABS = new Set<EquipmentType>([
  'beast_claws',
  'kdrive',
  'tektolyst',
]);

function getSpecialItemSelectionTypeForItem(
  item: EquipmentItem,
  equipmentType: EquipmentType,
): EquipmentType | null {
  if (item.product_category !== 'SpecialItems') return null;
  return getSpecialItemSelectionTypeByName(item.name, equipmentType);
}

export function EquipmentGridModal({
  onSelect,
  onClose,
}: EquipmentGridModalProps) {
  const [activeTab, setActiveTab] = useState<EquipmentType>('warframe');
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const visibleTabs = EQUIPMENT_TYPE_ORDER.filter(
    (t) => !HIDDEN_EMPTY_TABS.has(t),
  );

  useEffect(() => {
    const url = CATEGORY_API[activeTab];
    if (!url) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void (async () => {
      try {
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
            const selectionType = getSpecialItemSelectionTypeForItem(
              item,
              activeTab,
            );
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
        } else if (activeTab === 'archwing') {
          list = list.filter((i) => i.product_category === 'SpaceSuits');
        } else if (activeTab === 'necramech') {
          list = list.filter(
            (i) =>
              i.product_category === 'MechSuits' || i.selection_type != null,
          );
        }

        list = list.sort((a, b) =>
          normalizeEquipmentName(a.name).localeCompare(
            normalizeEquipmentName(b.name),
          ),
        );

        setItems(list);
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load equipment data.';
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeTab]);

  const query = search.trim().toLowerCase();
  const filtered = items.filter((i) =>
    normalizeEquipmentName(i.name).toLowerCase().includes(query),
  );

  return (
    <Modal
      open
      onClose={onClose}
      className="glass-modal-surface max-w-4xl p-6 shadow-2xl"
      ariaLabelledBy="equipment-grid-title"
    >
      <div
        style={{ width: '100%', maxWidth: '90vw', maxHeight: '85vh' }}
        className="overflow-y-auto"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="equipment-grid-title"
            className="text-lg font-semibold text-foreground"
          >
            Select Equipment
          </h2>
          <button
            type="button"
            className="text-xl text-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close equipment picker"
          >
            &times;
          </button>
        </div>

        <div className="mb-3 rounded-xl border border-glass-border bg-glass p-1">
          <div className="flex flex-wrap gap-1">
            {visibleTabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setActiveTab(t);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium tracking-wide transition-all ${
                  activeTab === t
                    ? 'border-accent/50 bg-accent-weak text-accent shadow-[0_0_0_1px_rgba(64,180,255,0.18)_inset]'
                    : 'border-transparent text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground'
                }`}
              >
                {EQUIPMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input mb-4"
          autoFocus
        />

        <div className="max-h-[55vh] overflow-y-auto custom-scroll">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted">Loading...</p>
            </div>
          ) : error ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-danger">
                Failed to load equipment: {error}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted">
                {items.length === 0
                  ? 'No data. Import data first.'
                  : 'No results.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((item) => (
                <button
                  key={item.unique_name}
                  type="button"
                  onClick={() =>
                    onSelect(item.selection_type ?? activeTab, item.unique_name)
                  }
                  className="group relative overflow-hidden rounded-lg border border-glass-border p-0 text-center transition-all hover:border-glass-border-hover hover:bg-glass-hover"
                  aria-label={`Select ${normalizeEquipmentName(item.name)}`}
                >
                  <div className="relative flex h-20 w-full items-center justify-center overflow-hidden bg-glass">
                    {item.image_path ? (
                      <img
                        src={`/images${item.image_path}`}
                        alt=""
                        className="h-full w-full object-contain p-1 transition-transform duration-200 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-muted/50">?</span>
                    )}
                    <span className="text-shadow-soft absolute inset-x-0 bottom-0 truncate bg-black/25 px-2 py-1 text-[11px] text-white">
                      {normalizeEquipmentName(item.name)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
