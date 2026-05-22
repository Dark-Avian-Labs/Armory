import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildEquipmentBuildsListPath } from '../../app/paths';
import type { EquipmentType } from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { normalizeEquipmentName } from '../../utils/specialItems';
import {
  catalogKeyForItem,
  CATEGORY_API,
  HIDDEN_EMPTY_TABS,
  loadEquipmentItemsForTab,
  EQUIPMENT_PICKER_GRID_CLASS,
  EQUIPMENT_PICKER_TILE_BUTTON_CLASS,
  EQUIPMENT_PICKER_TILE_SIZE_CLASS,
  TAB_LABELS,
  TAB_ORDER,
  type EquipmentItem,
  type EquipmentPickerTab,
} from './buildsCatalogUtils';

type CatalogEntry = {
  equipment_type: string;
  equipment_unique_name: string;
  build_count: number;
};

export function BuildsCatalogPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<EquipmentPickerTab>('warframe');
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [failedImageKeys, setFailedImageKeys] = useState<Record<string, true>>({});

  const handleImageError = useCallback((catalogKey: string) => {
    setFailedImageKeys((prev) => (prev[catalogKey] ? prev : { ...prev, [catalogKey]: true }));
  }, []);

  const visibleTabs = TAB_ORDER.filter(
    (tab) => tab === 'companion_weapon' || !HIDDEN_EMPTY_TABS.has(tab),
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await apiFetch('/api/builds/catalog');
        if (!res.ok) {
          throw new Error(`Failed to load catalog (${res.status})`);
        }
        const body = (await res.json()) as { entries?: CatalogEntry[] };
        if (!alive) return;
        setCatalog(Array.isArray(body.entries) ? body.entries : []);
        setCatalogError(null);
      } catch (e) {
        if (!alive) return;
        setCatalogError(e instanceof Error ? e.message : 'Failed to load catalog');
      } finally {
        if (alive) setCatalogLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const countByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of catalog) {
      m.set(
        catalogKeyForItem(e.equipment_type as EquipmentType, e.equipment_unique_name),
        e.build_count,
      );
    }
    return m;
  }, [catalog]);

  useEffect(() => {
    if (!CATEGORY_API[activeTab]) {
      setItems([]);
      setItemsError(null);
      setItemsLoading(false);
      return;
    }

    setItemsLoading(true);
    setItemsError(null);
    let alive = true;
    void (async () => {
      try {
        const list = await loadEquipmentItemsForTab(activeTab);
        if (!alive) return;
        setItems(list);
      } catch (e) {
        if (!alive) return;
        setItemsError(e instanceof Error ? e.message : 'Failed to load equipment');
      } finally {
        if (alive) setItemsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeTab]);

  useEffect(() => {
    setFailedImageKeys({});
  }, [activeTab]);

  const resolveEquipmentType = useCallback(
    (item: EquipmentItem): EquipmentType => {
      return (item.selection_type ?? activeTab) as EquipmentType;
    },
    [activeTab],
  );

  const withBuilds = useMemo(() => {
    return items.filter((item) => {
      const eqType = resolveEquipmentType(item);
      const key = catalogKeyForItem(eqType, item.unique_name);
      return (countByKey.get(key) ?? 0) > 0;
    });
  }, [items, countByKey, resolveEquipmentType]);

  const handleSelect = (item: EquipmentItem) => {
    const eqType = resolveEquipmentType(item);
    navigate(buildEquipmentBuildsListPath(eqType, item.unique_name));
  };

  return (
    <div className="mx-auto max-w-[2000px] space-y-4">
      <div className="glass-shell overflow-hidden p-4">
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

        {catalogLoading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-muted text-sm">Loading catalog...</p>
          </div>
        ) : catalogError ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-danger text-sm">{catalogError}</p>
          </div>
        ) : itemsLoading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-muted text-sm">Loading equipment...</p>
          </div>
        ) : itemsError ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-danger text-sm">{itemsError}</p>
          </div>
        ) : withBuilds.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-muted text-sm">No builds in this category yet.</p>
          </div>
        ) : (
          <div
            className={`custom-scroll max-h-[65vh] overflow-y-auto ${EQUIPMENT_PICKER_GRID_CLASS}`}
          >
            {withBuilds.map((item) => {
              const eqType = resolveEquipmentType(item);
              const key = catalogKeyForItem(eqType, item.unique_name);
              const n = countByKey.get(key) ?? 0;
              return (
                <button
                  key={item.unique_name}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`group border-glass-border bg-glass/40 hover:border-glass-border-hover hover:bg-glass-hover relative overflow-hidden rounded-lg border p-0 text-center transition-[color,background-color,border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 ${EQUIPMENT_PICKER_TILE_BUTTON_CLASS}`}
                  aria-label={`View builds for ${normalizeEquipmentName(item.name)}`}
                >
                  <div
                    className={`bg-glass relative flex items-center justify-center overflow-hidden ${EQUIPMENT_PICKER_TILE_SIZE_CLASS}`}
                  >
                    {item.image_path && !failedImageKeys[key] ? (
                      <img
                        src={`/images${item.image_path}`}
                        alt=""
                        className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                        onError={() => handleImageError(key)}
                      />
                    ) : (
                      <span className="text-muted/50 text-[10px]">?</span>
                    )}
                    <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {n}
                    </span>
                    <span className="text-shadow-soft absolute inset-x-0 bottom-0 truncate bg-black/35 px-3 py-2 text-[11px] tracking-[0.12em] text-white uppercase">
                      {normalizeEquipmentName(item.name)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
