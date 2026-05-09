import {
  lazy,
  Suspense,
  useState,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import {
  APP_DISPLAY_NAME,
  APP_VERSION,
  AUTH_PROFILE_URL,
  LEGAL_ENTITY_NAME,
  LEGAL_PAGE_URL,
} from '../../app/config';
import { APP_PATHS, buildNewPath } from '../../app/paths';
import bgArt from '../../assets/background.txt?raw';
import feathers from '../../assets/feathers.png';
import { useCompare } from '../../context/CompareContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../features/auth/AuthContext';
import { useStaleBundlePrompt } from '../../hooks/useStaleBundlePrompt';
import { CompareBar } from '../Compare/CompareBar';
import { LazySuspenseFallback } from '../ui/LazySuspenseFallback';
import { MaterialSymbol } from '../ui/MaterialSymbol';
import { Menu } from '../ui/Menu';
import { SearchBar } from './SearchBar';

const EquipmentGridModal = lazy(() =>
  import('./EquipmentGridModal').then((m) => ({ default: m.EquipmentGridModal })),
);

function isCompactModBuilderRoute(pathname: string): boolean {
  if (pathname.startsWith('/builder/new/')) return true;
  const parts = pathname.split('/').filter(Boolean);
  return (
    parts.length === 2 &&
    parts[0] === 'builder' &&
    parts[1] !== 'builds' &&
    parts[1] !== 'my-builds' &&
    parts[1] !== 'new'
  );
}

function getNavLinkClass(isActive: boolean): string {
  return `inline-flex items-center rounded-2xl border px-4 py-2 text-sm transition-[color,background-color,border-color,box-shadow] duration-200 ${
    isActive
      ? 'border-accent bg-accent-weak text-accent'
      : 'border-glass-border text-muted hover:border-glass-border-hover hover:text-foreground'
  }`;
}

export function Layout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showAddBuild, setShowAddBuild] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevUserMenuOpenRef = useRef(false);
  const userMenuId = 'armory-user-menu';
  const navigate = useNavigate();
  const { snapshots } = useCompare();
  const { mode, toggleMode } = useTheme();
  const { account, logout } = useAuth();
  const compareBarVisible = snapshots.length > 0;
  const currentYear = new Date().getFullYear();

  const handleEquipmentSelect = useCallback(
    (equipmentType: string, uniqueName: string) => {
      setShowAddBuild(false);
      navigate(buildNewPath(equipmentType, uniqueName));
    },
    [navigate],
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const container = menuRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (userMenuOpen && items.length > 0) {
      items[0].focus();
    }
    if (prevUserMenuOpenRef.current && !userMenuOpen) {
      menuButtonRef.current?.focus();
    }
    prevUserMenuOpenRef.current = userMenuOpen;
  }, [userMenuOpen]);

  const handleUserMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (!userMenuOpen || !menuRef.current) return;
      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      if (items.length === 0) return;
      const activeIndex = items.findIndex((item) => item === document.activeElement);
      const first = items[0];
      const last = items[items.length - 1];

      if (event.key === 'Escape') {
        event.preventDefault();
        setUserMenuOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
        items[next].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const next =
          activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
        items[next].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        first.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        last.focus();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
          const next = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
          items[next].focus();
        } else {
          const next = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
          items[next].focus();
        }
      }
    },
    [userMenuOpen],
  );

  const profile = account.profile;
  const isLoggedIn = account.isAuthenticated && profile !== null;
  const isAdmin = profile?.isAdmin === true;
  const bundleStale = useStaleBundlePrompt(APP_VERSION);

  const compactModBuilderUi =
    searchParams.get('compact') === '1' && isCompactModBuilderRoute(location.pathname);

  if (compactModBuilderUi) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--color-bg-end)]">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <main
          id="main-content"
          tabIndex={-1}
          className="relative z-10 mx-auto flex min-h-0 w-full flex-1 flex-col p-3"
        >
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="bg-art" aria-hidden="true">
        {bgArt}
      </div>
      <header className="relative z-30 h-[100px] px-6">
        <div className="mx-auto grid h-full w-full max-w-[2000px] grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex w-fit max-w-full min-w-0 flex-col gap-0.5 justify-self-start">
            <Link to={APP_PATHS.home} className="brand-lockup w-fit">
              <img
                src={feathers}
                alt="Dark Avian Labs feather mark"
                className="brand-lockup__icon"
              />
              <span className="brand-lockup__title brand-lockup--fx">{APP_DISPLAY_NAME}</span>
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
              <span
                className="text-muted font-mono text-[10px] leading-none tracking-wide opacity-70"
                title={`Client ${APP_VERSION}`}
              >
                v{APP_VERSION}
              </span>
              {bundleStale ? (
                <button
                  type="button"
                  className="text-muted hover:text-foreground rounded px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-wide underline decoration-current/25 underline-offset-2 transition-colors hover:decoration-current/45"
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  Reload
                </button>
              ) : null}
            </div>
          </div>

          <div className="justify-self-center">{isLoggedIn ? <SearchBar /> : null}</div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <nav className="flex flex-wrap gap-2">
              <NavLink
                to={APP_PATHS.buildsExplore}
                end
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                Builds
              </NavLink>
              <NavLink
                to={APP_PATHS.myBuilds}
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                My Builds
              </NavLink>
            </nav>
            <button
              className="btn btn-accent text-sm"
              type="button"
              onClick={() => setShowAddBuild(true)}
            >
              + Add Build
            </button>

            <button
              type="button"
              className="icon-toggle-btn"
              onClick={toggleMode}
              aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
            >
              {mode === 'dark' ? (
                <MaterialSymbol name="light_mode" filled />
              ) : (
                <MaterialSymbol name="dark_mode" filled />
              )}
            </button>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                className="icon-toggle-btn"
                ref={menuButtonRef}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-controls={userMenuOpen ? userMenuId : undefined}
                aria-label="Open user menu"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setUserMenuOpen(true);
                  }
                }}
              >
                <MaterialSymbol name="person" filled />
              </button>
              {userMenuOpen && (
                <Menu baseClass="user-menu">
                  <div
                    id={userMenuId}
                    role="menu"
                    aria-orientation="vertical"
                    onKeyDown={handleUserMenuKeyDown}
                  >
                    {isAdmin ? (
                      <Link
                        to={APP_PATHS.admin}
                        className="user-menu-item"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    ) : null}
                    <a
                      href={`${AUTH_PROFILE_URL}?next=${encodeURIComponent(APP_PATHS.home)}`}
                      className="user-menu-item"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Profile
                    </a>
                    <button
                      type="button"
                      className="user-menu-item text-left"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void handleLogout();
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </Menu>
              )}
            </div>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={`relative z-10 flex-1 px-6 ${compareBarVisible ? 'pb-24' : 'pb-6'}`}
      >
        <Outlet />
      </main>

      <CompareBar />

      {showAddBuild ? (
        <Suspense fallback={<LazySuspenseFallback />}>
          <EquipmentGridModal
            onSelect={handleEquipmentSelect}
            onClose={() => setShowAddBuild(false)}
          />
        </Suspense>
      ) : null}
      <footer className="relative z-10 flex h-[50px] items-center justify-center px-6">
        <div className="mx-auto w-full max-w-[2000px] text-center">
          <a
            href={LEGAL_PAGE_URL}
            className="text-muted hover:text-foreground text-sm"
            target={LEGAL_PAGE_URL.startsWith('http') ? '_blank' : undefined}
            rel={LEGAL_PAGE_URL.startsWith('http') ? 'noreferrer' : undefined}
          >
            ©{currentYear} {LEGAL_ENTITY_NAME}
          </a>
        </div>
      </footer>
    </div>
  );
}
