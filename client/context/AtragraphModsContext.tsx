import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const ATRAGRAPH_MODS_STORAGE_KEY = 'armory.atragraphMods.enabled';

interface AtragraphModsContextValue {
  atragraphModsEnabled: boolean;
  setAtragraphModsEnabled: (enabled: boolean) => void;
  toggleAtragraphMods: () => void;
}

const AtragraphModsContext = createContext<AtragraphModsContextValue | undefined>(undefined);

function readInitialAtragraphModsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(ATRAGRAPH_MODS_STORAGE_KEY);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
  } catch {
    // ignore
  }
  return true;
}

export function AtragraphModsProvider({ children }: { children: ReactNode }) {
  const hasMountedRef = useRef(false);
  const [atragraphModsEnabled, setAtragraphModsEnabled] = useState(readInitialAtragraphModsEnabled);

  useEffect(() => {
    if (!hasMountedRef.current) return;
    try {
      window.localStorage.setItem(ATRAGRAPH_MODS_STORAGE_KEY, String(atragraphModsEnabled));
    } catch {
      // ignore
    }
  }, [atragraphModsEnabled]);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  const value = useMemo<AtragraphModsContextValue>(
    () => ({
      atragraphModsEnabled,
      setAtragraphModsEnabled,
      toggleAtragraphMods: () => setAtragraphModsEnabled((prev) => !prev),
    }),
    [atragraphModsEnabled],
  );

  return <AtragraphModsContext.Provider value={value}>{children}</AtragraphModsContext.Provider>;
}

export function useAtragraphMods() {
  const context = useContext(AtragraphModsContext);
  if (!context) {
    throw new Error('useAtragraphMods must be used within AtragraphModsProvider');
  }
  return context;
}
