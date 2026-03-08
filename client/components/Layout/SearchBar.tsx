import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildNewPath } from '../../app/paths';
import { apiFetch } from '../../utils/api';

interface SearchResult {
  category: string;
  name: string;
  unique_name: string;
  image_path?: string;
  equipment_type?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const search = useCallback(
    debounce(async (term: string) => {
      abortControllerRef.current?.abort();

      if (!term || term.length < 2) {
        setLoading(false);
        setResults([]);
        setSearchError(null);
        setOpen(false);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setSearchError(null);
      try {
        const response = await apiFetch(
          `/api/search?q=${encodeURIComponent(term)}&limit=20`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as { items?: SearchResult[] };
        const items = Array.isArray(body.items) ? body.items : [];
        if (controller.signal.aborted) return;
        setResults(items);
        setOpen(items.length > 0);
      } catch (e) {
        if (
          controller.signal.aborted ||
          (e instanceof DOMException && e.name === 'AbortError')
        ) {
          return;
        }
        console.error('Search request failed', e);
        setSearchError('Search failed');
        setResults([]);
        setOpen(true);
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      }
    }, 300),
    [],
  );

  const handleSelect = (result: SearchResult) => {
    if (!result.equipment_type) {
      setSearchError(`No build route is available yet for "${result.name}".`);
      setOpen(true);
      return;
    }
    setSearchError(null);
    navigate(buildNewPath(result.equipment_type, result.unique_name));
    setQuery('');
    setOpen(false);
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div ref={wrapperRef} className="relative">
      <div className="search-wrapper">
        <span className="search-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M11.5 11.5L14 14M7 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <input
          type="text"
          className="search-box w-full"
          placeholder="Search equipment and start a new build"
          aria-label="Search equipment"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-lg text-muted transition-colors hover:text-foreground"
            aria-label="Clear search"
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setSearchError(null);
              setOpen(false);
            }}
          >
            &times;
          </button>
        )}
      </div>

      {open && (
        <div className="search-results-panel absolute right-0 top-full z-50 mt-3 w-full min-w-[22rem] overflow-hidden">
          {loading ? (
            <div className="p-3 text-center text-sm text-muted">Searching…</div>
          ) : searchError ? (
            <div className="p-3 text-center text-sm text-muted">
              {searchError}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto custom-scroll">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="sticky top-0 bg-surface-modal/95 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted/70 backdrop-blur">
                    {category}
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.unique_name}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-muted transition-colors hover:bg-glass-hover hover:text-foreground"
                      type="button"
                      onClick={() => handleSelect(item)}
                    >
                      {item.image_path && (
                        <img
                          src={`/images${item.image_path}`}
                          alt=""
                          className="h-9 w-9 rounded-xl object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {item.name}
                        </div>
                        <div className="truncate text-[11px] uppercase tracking-[0.18em] text-muted/60">
                          {category}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
