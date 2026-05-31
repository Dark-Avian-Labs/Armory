import { useState, useEffect } from 'react';

import { normalizeEquipmentName } from '../../utils/specialItems';
import {
  CATEGORY_API,
  EQUIPMENT_PICKER_GRID_CLASS,
  EQUIPMENT_PICKER_TILE_BUTTON_CLASS,
  EQUIPMENT_PICKER_TILE_SIZE_CLASS,
  HIDDEN_EMPTY_TABS,
  loadEquipmentItemsForTab,
  TAB_LABELS,
  TAB_ORDER,
  type EquipmentItem,
  type EquipmentPickerTab,
} from '../BuildsCatalog/buildsCatalogUtils';
import { MaterialSymbol } from '../ui/MaterialSymbol';
import { Modal } from '../ui/Modal';

interface EquipmentGridModalProps {
  onSelect: (equipmentType: string, uniqueName: string, displayName: string) => void;
  onClose: () => void;
}

export function EquipmentGridModal({ onSelect, onClose }: EquipmentGridModalProps) {
  const [activeTab, setActiveTab] = useState<EquipmentPickerTab>('warframe');
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const visibleTabs = TAB_ORDER.filter(
    (tab) => tab === 'companion_weapon' || !HIDDEN_EMPTY_TABS.has(tab),
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
        const list = await loadEquipmentItemsForTab(activeTab);
        setItems(list);
        setError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load equipment data.';
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
      className="glass-modal-surface equipment-picker-modal p-6 shadow-2xl"
      ariaLabelledBy="equipment-grid-title"
    >
      <div className="max-h-[85vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="equipment-grid-title" className="text-foreground text-lg font-semibold">
              Select equipment
            </h2>
          </div>
          <button
            type="button"
            className="icon-toggle-btn h-10 w-10 text-lg"
            onClick={onClose}
            aria-label="Close equipment picker"
          >
            <MaterialSymbol name="close" style={{ fontSize: 22 }} />
          </button>
        </div>

        <div className="tabs" role="tablist" aria-label="Equipment categories">
          {visibleTabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={activeTab === t}
              onClick={() => {
                setActiveTab(t);
              }}
              className={`tab ${activeTab === t ? 'active' : ''}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <input
          id="armory-equipment-grid-search"
          name="search"
          type="search"
          autoComplete="off"
          aria-label="Search equipment in picker"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input mb-4"
          autoFocus
        />

        <div className="custom-scroll max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted text-sm">Loading...</p>
            </div>
          ) : error ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-danger text-sm">Failed to load equipment: {error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted text-sm">
                {items.length === 0 ? 'No data. Import data first.' : 'No results.'}
              </p>
            </div>
          ) : (
            <div className={EQUIPMENT_PICKER_GRID_CLASS}>
              {filtered.map((item) => (
                <button
                  key={item.unique_name}
                  type="button"
                  onClick={() =>
                    onSelect(
                      item.selection_type ?? activeTab,
                      item.unique_name,
                      normalizeEquipmentName(item.name),
                    )
                  }
                  className={`group border-glass-border bg-glass/40 hover:border-glass-border-hover hover:bg-glass-hover relative overflow-hidden rounded-lg border p-0 text-center transition-[color,background-color,border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 ${EQUIPMENT_PICKER_TILE_BUTTON_CLASS}`}
                  aria-label={`Select ${normalizeEquipmentName(item.name)}`}
                >
                  <div
                    className={`bg-glass relative flex items-center justify-center overflow-hidden ${EQUIPMENT_PICKER_TILE_SIZE_CLASS}`}
                  >
                    {item.image_path ? (
                      <img
                        src={`/images${item.image_path}`}
                        alt=""
                        className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-muted/50 text-[10px]">?</span>
                    )}
                    <span className="text-shadow-soft absolute inset-x-0 bottom-0 truncate bg-black/35 px-3 py-2 text-[11px] tracking-[0.12em] text-white uppercase">
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
