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
  const [search, setSearch] = useState('');
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

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return withBuilds.filter((i) => normalizeEquipmentName(i.name).toLowerCase().includes(query));
  }, [withBuilds, query]);

  const handleSelect = (item: EquipmentItem) => {
    const eqType = resolveEquipmentType(item);
    navigate(buildEquipmentBuildsListPath(eqType, item.unique_name));
  };

  return (
    <div className="mx-auto max-w-[2000px] space-y-4">
      <div className="glass-shell p-5">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Builds</h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Browse community builds by equipment. Only items that have at least one saved build are
          listed.
        </p>
      </div>

      <div className="glass-shell overflow-hidden p-4">
        <div className="border-glass-border bg-glass mb-4 rounded-2xl border p-1.5">
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
        />

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
        ) : filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-muted text-sm">
              {withBuilds.length === 0
                ? 'No builds in this category yet.'
                : 'No matching equipment.'}
            </p>
          </div>
        ) : (
          <div className="custom-scroll grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {filtered.map((item) => {
              const eqType = resolveEquipmentType(item);
              const key = catalogKeyForItem(eqType, item.unique_name);
              const n = countByKey.get(key) ?? 0;
              return (
                <button
                  key={item.unique_name}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="group border-glass-border bg-glass/40 hover:border-glass-border-hover hover:bg-glass-hover relative overflow-hidden rounded-2xl border p-0 text-center transition-[color,background-color,border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5"
                  aria-label={`View builds for ${normalizeEquipmentName(item.name)}`}
                >
                  <div className="bg-glass relative flex h-24 w-full items-center justify-center overflow-hidden">
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
