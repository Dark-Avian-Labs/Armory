import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  AppAccountProfile,
  AppAccountState,
  AuthStatus,
  RemoteAuthUser,
  RemoteAuthState,
} from './types';
import {
  apiFetch,
  buildCentralAuthLoginUrl,
  clearCsrfToken,
} from '../../utils/api';
import { normalizeAvatarId } from '../../utils/profileIcons';
import { getStoredProfile, mergeStoredProfile } from '../profile/profileStore';

interface AuthContextValue {
  status: AuthStatus;
  account: AppAccountState;
  updateProfile: (
    updates: Partial<Pick<AppAccountProfile, 'displayName' | 'email'>>,
  ) => void;
  refresh: (signal?: AbortSignal) => Promise<void>;
  logout: (redirectPath?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildProfile(user: RemoteAuthUser): AppAccountProfile {
  const stored = getStoredProfile(user.id);
  return {
    userId: user.id,
    username: user.username,
    isAdmin: user.is_admin,
    displayName: stored?.displayName || user.display_name || user.username,
    email: user.email || '',
    avatarId: normalizeAvatarId(user.avatar),
  };
}

interface AuthProviderProps {
  children: ReactNode;
  defaultLogoutRedirectPath?: string;
}

export function AuthProvider({
  children,
  defaultLogoutRedirectPath = '/builder',
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [account, setAccount] = useState<AppAccountState>({
    isAuthenticated: false,
    profile: null,
  });

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await apiFetch('/api/auth/me', { signal });
      if (signal?.aborted) return;

      if (!res.ok) {
        setAccount({ isAuthenticated: false, profile: null });
        setStatus('unauthenticated');
        return;
      }

      const data = (await res.json()) as RemoteAuthState;
      if (signal?.aborted) return;

      if (data.authenticated !== true) {
        setAccount({ isAuthenticated: false, profile: null });
        setStatus('unauthenticated');
        return;
      }
      if (data.has_game_access !== true) {
        setAccount({ isAuthenticated: false, profile: null });
        setStatus('forbidden');
        return;
      }

      const user = data.user;
      if (
        !user ||
        typeof user.id !== 'number' ||
        typeof user.username !== 'string' ||
        typeof user.is_admin !== 'boolean'
      ) {
        setAccount({ isAuthenticated: false, profile: null });
        setStatus('unauthenticated');
        return;
      }

      setAccount({ isAuthenticated: true, profile: buildProfile(user) });
      setStatus('ok');
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setAccount({ isAuthenticated: false, profile: null });
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {
      controller.abort();
    };
  }, [refresh]);

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(
    (updates) => {
      setAccount((prev) => {
        if (!prev.profile) {
          return prev;
        }
        return { ...prev, profile: mergeStoredProfile(prev.profile, updates) };
      });
    },
    [],
  );

  const logout = useCallback(
    async (redirectPath?: string) => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        console.error(
          '[AuthContext] logout: apiFetch(/api/auth/logout) failed; redirectPath=',
          redirectPath ?? defaultLogoutRedirectPath,
          error,
        );
      } finally {
        clearCsrfToken();
        window.location.href = buildCentralAuthLoginUrl(
          redirectPath ?? defaultLogoutRedirectPath,
        );
      }
    },
    [defaultLogoutRedirectPath],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, account, updateProfile, refresh, logout }),
    [status, account, updateProfile, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
