import { useState, useEffect } from 'react';

import type { EquipmentType } from '../../types/warframe';
import { normalizeEquipmentName } from '../../utils/specialItems';
import {
  CATEGORY_API,
  HIDDEN_EMPTY_TABS,
  loadEquipmentItemsForTab,
  TAB_LABELS,
  TAB_ORDER,
  type EquipmentItem,
  type EquipmentPickerTab,
} from '../BuildsCatalog/buildsCatalogUtils';
import { Modal } from '../ui/Modal';

interface EquipmentGridModalProps {
  onSelect: (equipmentType: string, uniqueName: string) => void;
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
      className="glass-modal-surface max-w-4xl p-6 shadow-2xl"
      ariaLabelledBy="equipment-grid-title"
    >
      <div
        style={{ width: '100%', maxWidth: '90vw', maxHeight: '85vh' }}
        className="overflow-y-auto"
      >
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
            &times;
          </button>
        </div>

        <div className="border-glass-border bg-glass mb-3 rounded-2xl border p-1.5">
          <div className="flex flex-wrap gap-1">
            {visibleTabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setActiveTab(t);
                }}
                className={`rounded-full border px-3 py-2 text-xs font-medium tracking-[0.18em] uppercase transition-[color,background-color,border-color,box-shadow] duration-200 ${
                  activeTab === t
                    ? 'border-accent/40 bg-accent/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground border-transparent'
                }`}
              >
                {TAB_LABELS[t]}
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((item) => (
                <button
                  key={item.unique_name}
                  type="button"
                  onClick={() => onSelect(item.selection_type ?? activeTab, item.unique_name)}
                  className="group border-glass-border bg-glass/40 hover:border-glass-border-hover hover:bg-glass-hover relative overflow-hidden rounded-2xl border p-0 text-center transition-[color,background-color,border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5"
                  aria-label={`Select ${normalizeEquipmentName(item.name)}`}
                >
                  <div className="bg-glass relative flex h-24 w-full items-center justify-center overflow-hidden">
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
