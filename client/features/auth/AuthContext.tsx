import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  API_UNAUTHORIZED_EVENT,
  apiFetch,
  buildCentralAuthLoginUrl,
  clearCsrfToken,
  UnauthorizedError,
} from '../../utils/api';
import { normalizeAvatarId } from '../../utils/profileIcons';
import { getStoredProfile, mergeStoredProfile } from '../profile/profileStore';
import type {
  AppAccountProfile,
  AppAccountState,
  AuthStatus,
  RemoteAuthUser,
  RemoteAuthState,
} from './types';

interface AuthContextValue {
  status: AuthStatus;
  account: AppAccountState;
  rateLimitedUntilMs: number | null;
  updateProfile: (updates: Partial<Pick<AppAccountProfile, 'displayName' | 'email'>>) => void;
  refresh: (signal?: AbortSignal) => Promise<void>;
  logout: (redirectPath?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function getRetryAfterMs(res: Response): Promise<number | null> {
  const header = res.headers.get('Retry-After');
  if (header) {
    const asSec = Number.parseInt(header, 10);
    if (Number.isFinite(asSec) && asSec > 0) return asSec * 1000;
    const asDate = Date.parse(header);
    if (Number.isFinite(asDate)) {
      const delta = asDate - Date.now();
      if (delta > 0) return delta;
    }
  }
  try {
    const body = (await res.clone().json()) as {
      auth_retry_after_sec?: number;
      retry_after_sec?: number;
    };
    const sec = body.auth_retry_after_sec ?? body.retry_after_sec;
    if (typeof sec === 'number' && Number.isFinite(sec) && sec > 0) {
      return sec * 1000;
    }
  } catch {
    // ignore
  }
  return null;
}

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
  defaultLogoutRedirectPath = '/builder/builds',
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [account, setAccount] = useState<AppAccountState>({
    isAuthenticated: false,
    profile: null,
  });
  const [rateLimitedUntilMs, setRateLimitedUntilMs] = useState<number | null>(null);
  const rateLimitedUntilMsRef = useRef<number | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await apiFetch('/api/auth/me', { signal });
      if (signal?.aborted) return;

      if (!res.ok) {
        if (res.status === 401) {
          setAccount({ isAuthenticated: false, profile: null });
          setStatus('unauthenticated');
          setRateLimitedUntilMs(null);
        } else if (res.status === 429) {
          const retryAfterMs = (await getRetryAfterMs(res)) ?? 30000;
          const untilMs = Date.now() + retryAfterMs;
          setRateLimitedUntilMs(untilMs);
          setStatus('rate_limited');
        } else {
          console.error('[AuthContext] refresh failed with status', res.status);
          setStatus('error');
          setRateLimitedUntilMs(null);
        }
        return;
      }

      const data = (await res.json()) as RemoteAuthState;
      if (signal?.aborted) return;

      if (data.authenticated !== true) {
        setAccount({ isAuthenticated: false, profile: null });
        setStatus('unauthenticated');
        setRateLimitedUntilMs(null);
        return;
      }
      if (data.has_game_access !== true) {
        setAccount({ isAuthenticated: false, profile: null });
        setStatus('forbidden');
        setRateLimitedUntilMs(null);
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
      setRateLimitedUntilMs(null);
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      if (error instanceof UnauthorizedError) {
        setAccount({ isAuthenticated: false, profile: null });
        setStatus('unauthenticated');
        setRateLimitedUntilMs(null);
        return;
      }
      console.error('[AuthContext] refresh failed', error);
      setStatus((prev) => (prev === 'loading' ? 'error' : prev));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {
      controller.abort();
    };
  }, [refresh]);

  useEffect(() => {
    rateLimitedUntilMsRef.current = rateLimitedUntilMs;
  }, [rateLimitedUntilMs]);

  useEffect(() => {
    const onUnauthorized = (_event: Event & { detail?: { url?: string } }) => {
      const currentRateLimitUntilMs = rateLimitedUntilMsRef.current;
      if (currentRateLimitUntilMs && Date.now() < currentRateLimitUntilMs) {
        return;
      }
      void refresh();
    };
    window.addEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized as EventListener);
    return () => {
      window.removeEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized as EventListener);
    };
  }, [refresh]);

  const updateProfile = useCallback<AuthContextValue['updateProfile']>((updates) => {
    setAccount((prev) => {
      if (!prev.profile) {
        return prev;
      }
      return { ...prev, profile: mergeStoredProfile(prev.profile, updates) };
    });
  }, []);

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
        window.location.href = buildCentralAuthLoginUrl(redirectPath ?? defaultLogoutRedirectPath);
      }
    },
    [defaultLogoutRedirectPath],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      account,
      rateLimitedUntilMs,
      updateProfile,
      refresh,
      logout,
    }),
    [status, account, rateLimitedUntilMs, updateProfile, refresh, logout],
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
