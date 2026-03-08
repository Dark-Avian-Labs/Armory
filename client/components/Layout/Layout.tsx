import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { EquipmentGridModal } from './EquipmentGridModal';
import { SearchBar } from './SearchBar';
import {
  APP_DISPLAY_NAME,
  LEGAL_ENTITY_NAME,
  LEGAL_PAGE_URL,
} from '../../app/config';
import { APP_PATHS, buildNewPath } from '../../app/paths';
import bgArt from '../../assets/background.txt?raw';
import feathers from '../../assets/feathers.png';
import { useCompare } from '../../context/CompareContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../features/auth/AuthContext';
import { getProfileIconSrc } from '../../utils/profileIcons';
import { CompareBar } from '../Compare/CompareBar';
import { Menu } from '../ui/Menu';

export function Layout() {
  const [showAddBuild, setShowAddBuild] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevUserMenuOpenRef = useRef(false);
  const userMenuId = 'parametric-user-menu';
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
      const items = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      );
      if (items.length === 0) return;
      const activeIndex = items.findIndex(
        (item) => item === document.activeElement,
      );
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
          activeIndex < 0
            ? items.length - 1
            : (activeIndex - 1 + items.length) % items.length;
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
  const avatarSrc = getProfileIconSrc(profile?.avatarId ?? 1);

  return (
    <div className="page-frame flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-black focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <div className="bg-art" aria-hidden="true">
        {bgArt}
      </div>
      <header className="relative z-30 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mx-auto w-full max-w-[2000px]">
          <div className="glass-shell px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Link to={APP_PATHS.home} className="brand-lockup w-fit">
                  <img
                    src={feathers}
                    alt="Dark Avian Labs feather mark"
                    className="brand-lockup__icon"
                  />
                  <span className="brand-lockup__copy">
                    <span className="brand-lockup__eyebrow">
                      Dark Avian Labs
                    </span>
                    <span className="brand-lockup__title brand-lockup--fx">
                      {APP_DISPLAY_NAME}
                    </span>
                    <span className="brand-lockup__subtitle">
                      Precision planning for refined Warframe builds
                    </span>
                  </span>
                </Link>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-center">
                {isLoggedIn ? (
                  <div className="w-full max-w-xl">
                    <SearchBar />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                <nav className="flex flex-wrap gap-2">
                  <NavLink
                    to={APP_PATHS.buildOverview}
                    end
                    className={({ isActive }) =>
                      `shell-nav-link ${
                        isActive
                          ? 'border-accent/30 bg-accent/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                          : ''
                      }`
                    }
                  >
                    Builds
                  </NavLink>
                </nav>
                <button
                  className="btn btn-accent text-sm"
                  type="button"
                  onClick={() => setShowAddBuild(true)}
                >
                  <span aria-hidden="true">+</span>
                  Add Build
                </button>
                <button
                  type="button"
                  className="icon-toggle-btn"
                  onClick={toggleMode}
                  aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
                  title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
                >
                  <span aria-hidden="true">{mode === 'dark' ? '☀' : '☾'}</span>
                </button>
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    className="icon-toggle-btn profile-avatar-btn"
                    ref={menuButtonRef}
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    aria-controls={userMenuOpen ? userMenuId : undefined}
                    aria-label="Open user menu"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'ArrowDown' ||
                        event.key === 'Enter' ||
                        event.key === ' '
                      ) {
                        event.preventDefault();
                        setUserMenuOpen(true);
                      }
                    }}
                  >
                    <img
                      src={avatarSrc}
                      alt=""
                      className="profile-avatar-image"
                    />
                  </button>
                  {userMenuOpen && (
                    <Menu baseClass="user-menu" className="focus:outline-none">
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
                        <Link
                          to={APP_PATHS.profile}
                          className="user-menu-item"
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          Profile
                        </Link>
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
            <div className="mt-4 flex flex-col gap-3 border-t border-glass-divider pt-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="status-pill status-pill--accent">
                  Refined Cinematic
                </span>
                <span className="status-pill">
                  {compareBarVisible
                    ? `${snapshots.length} in compare`
                    : 'Comparison queue idle'}
                </span>
              </div>
              <p className="max-w-2xl text-sm text-muted">
                Cleaner hierarchy, calmer controls, and deeper glass surfaces
                without losing the tactical feel.
              </p>
            </div>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={`relative z-10 flex-1 px-4 pb-6 pt-6 sm:px-6 ${compareBarVisible ? 'pb-28' : ''}`}
      >
        <Outlet />
      </main>

      <CompareBar />

      {showAddBuild && (
        <EquipmentGridModal
          onSelect={handleEquipmentSelect}
          onClose={() => setShowAddBuild(false)}
        />
      )}
      <footer className="relative z-10 px-4 pb-5 sm:px-6 sm:pb-6">
        <div className="mx-auto w-full max-w-[2000px]">
          <div className="glass-surface flex flex-col gap-2 px-5 py-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0">
              Deliberate buildcraft, faster comparisons, and less visual noise.
            </p>
            <a
              href={LEGAL_PAGE_URL}
              className="transition-colors hover:text-foreground"
              target={LEGAL_PAGE_URL.startsWith('http') ? '_blank' : undefined}
              rel={LEGAL_PAGE_URL.startsWith('http') ? 'noreferrer' : undefined}
            >
              ©{currentYear} {LEGAL_ENTITY_NAME}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
