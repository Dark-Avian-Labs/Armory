import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildEquipmentBuildsListPath, buildNewPath, userBuildsPath } from '../../app/paths';
import { apiFetch } from '../../utils/api';
import { MaterialSymbol } from '../ui/MaterialSymbol';

type EquipmentSearchResult = {
  kind: 'equipment';
  category: string;
  name: string;
  unique_name: string;
  image_path?: string;
  equipment_type?: string;
};

type UserSearchResult = {
  kind: 'user';
  username: string;
  clerk_user_id: string;
};

function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): ((...args: TArgs) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: TArgs) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<EquipmentSearchResult[]>([]);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const debouncedSearchRef = useRef(
    debounce(async (term: string) => {
      abortControllerRef.current?.abort();

      if (!term || term.length < 2) {
        setLoading(false);
        setEquipment([]);
        setUsers([]);
        setSearchError(null);
        setOpen(false);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setSearchError(null);
      try {
        const response = await apiFetch(`/api/search?q=${encodeURIComponent(term)}&limit=20`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          equipment?: EquipmentSearchResult[];
          users?: UserSearchResult[];
          items?: EquipmentSearchResult[];
        };
        if (controller.signal.aborted) return;
        const equip = Array.isArray(body.equipment)
          ? body.equipment.map((item) => ({ ...item, kind: 'equipment' as const }))
          : Array.isArray(body.items)
            ? body.items.map((item) => ({ ...item, kind: 'equipment' as const }))
            : [];
        const userRows = Array.isArray(body.users)
          ? body.users.map((u) => ({ ...u, kind: 'user' as const }))
          : [];
        setEquipment(equip);
        setUsers(userRows);
        setOpen(equip.length > 0 || userRows.length > 0);
      } catch (e) {
        if (controller.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
          return;
        }
        console.error('Search request failed', e);
        setSearchError('Search failed');
        setEquipment([]);
        setUsers([]);
        setOpen(true);
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      }
    }, 300),
  );

  useEffect(() => {
    return () => {
      debouncedSearchRef.current.cancel();
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const closeSearch = () => {
    setQuery('');
    setEquipment([]);
    setUsers([]);
    setSearchError(null);
    setOpen(false);
  };

  const handleNewBuild = (result: EquipmentSearchResult) => {
    if (!result.equipment_type) {
      setSearchError(`No build route is available yet for "${result.name}".`);
      setOpen(true);
      return;
    }
    setSearchError(null);
    navigate(buildNewPath(result.equipment_type, result.unique_name));
    closeSearch();
  };

  const handleShowBuilds = (result: EquipmentSearchResult) => {
    if (!result.equipment_type) return;
    navigate(buildEquipmentBuildsListPath(result.equipment_type, result.unique_name));
    closeSearch();
  };

  const handleUserBuilds = (result: UserSearchResult) => {
    navigate(userBuildsPath(result.username));
    closeSearch();
  };

  const hasResults = equipment.length > 0 || users.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="search-wrapper relative">
        <input
          id="armory-header-search"
          name="search"
          type="text"
          role="searchbox"
          enterKeyHint="search"
          autoComplete="off"
          className="search-box w-52"
          placeholder="Search..."
          aria-label="Search equipment and users"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            debouncedSearchRef.current(e.target.value);
          }}
          onFocus={() => {
            if (hasResults) setOpen(true);
          }}
        />
        {query && (
          <button
            type="button"
            className="text-muted hover:text-foreground absolute top-1/2 right-2 flex -translate-y-1/2 items-center justify-center p-0.5"
            aria-label="Clear search"
            onClick={closeSearch}
          >
            <MaterialSymbol name="close" style={{ fontSize: 20 }} />
          </button>
        )}
      </div>

      {open && (
        <div className="border-glass-border bg-surface-modal absolute top-full right-0 z-50 mt-1 w-96 overflow-hidden rounded-xl border shadow-lg backdrop-blur-xl">
          {loading ? (
            <div className="text-muted p-3 text-center text-sm">Searching...</div>
          ) : searchError ? (
            <div className="text-muted p-3 text-center text-sm">{searchError}</div>
          ) : !hasResults ? (
            <div className="text-muted p-3 text-center text-sm">No matches</div>
          ) : (
            <div className="custom-scroll max-h-80 overflow-y-auto">
              {equipment.length > 0 ? (
                <div>
                  <div className="bg-surface-modal/95 text-muted/60 sticky top-0 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase backdrop-blur">
                    Equipment
                  </div>
                  {equipment.map((item) => (
                    <div
                      key={item.unique_name}
                      className="border-glass-divider/50 border-b px-3 py-2 last:border-b-0"
                    >
                      <div className="text-foreground mb-1.5 flex items-center gap-2 text-sm font-medium">
                        {item.image_path ? (
                          <img
                            src={`/images${item.image_path}`}
                            alt=""
                            className="h-7 w-7 rounded object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        <span className="truncate">{item.name}</span>
                      </div>
                      <div className="flex flex-col gap-1 pl-9">
                        <button
                          type="button"
                          className="text-accent hover:bg-glass-hover rounded px-2 py-1 text-left text-xs"
                          onClick={() => handleNewBuild(item)}
                        >
                          New Build: {item.name}
                        </button>
                        <button
                          type="button"
                          className="text-muted hover:bg-glass-hover hover:text-foreground rounded px-2 py-1 text-left text-xs"
                          onClick={() => handleShowBuilds(item)}
                        >
                          Show Builds: {item.name}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {users.length > 0 ? (
                <div>
                  <div className="bg-surface-modal/95 text-muted/60 sticky top-0 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase backdrop-blur">
                    Users
                  </div>
                  {users.map((user) => (
                    <div key={user.clerk_user_id} className="px-3 py-2">
                      <button
                        type="button"
                        className="text-accent hover:bg-glass-hover w-full rounded px-2 py-1.5 text-left text-xs"
                        onClick={() => handleUserBuilds(user)}
                      >
                        Show User Builds: {user.username}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
