import { useAuth as useClerkAuth } from '@clerk/react';
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

import { apiFetch, API_UNAUTHORIZED_EVENT, setClerkTokenGetter } from '../../utils/api';
import type { AuthErrorDetail, AuthState } from './types';

interface AuthContextValue {
  auth: AuthState;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_AUTH_STATE: AuthState = {
  status: 'loading',
  userId: null,
  isAdmin: false,
};

function toAuthErrorDetail(error: unknown): AuthErrorDetail {
  if (error instanceof Error || typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return { message };
    }
  }
  return { message: 'Unable to refresh authentication state.' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth();
  const [auth, setAuth] = useState<AuthState>(DEFAULT_AUTH_STATE);
  const refreshGenerationRef = useRef(0);

  useEffect(() => {
    setClerkTokenGetter((options) => getToken(options));
    return () => {
      setClerkTokenGetter(null);
    };
  }, [getToken]);

  const refresh = useCallback(async () => {
    if (!isLoaded) return;
    const generation = ++refreshGenerationRef.current;
    const applyAuth = (next: AuthState): void => {
      if (refreshGenerationRef.current === generation) {
        setAuth(next);
      }
    };
    if (!isSignedIn) {
      applyAuth({ status: 'unauthenticated', userId: null, isAdmin: false });
      return;
    }
    try {
      const response = await apiFetch('/api/auth/me');
      if (!response.ok) {
        applyAuth({ status: 'unauthenticated', userId: null, isAdmin: false });
        return;
      }
      const body = (await response.json()) as {
        authenticated?: boolean;
        userId?: string;
        isAdmin?: boolean;
      };
      if (!body.authenticated || !body.userId) {
        applyAuth({ status: 'unauthenticated', userId: null, isAdmin: false });
        return;
      }
      applyAuth({
        status: 'authenticated',
        userId: body.userId,
        isAdmin: body.isAdmin === true,
      });
    } catch (error) {
      applyAuth({
        status: 'error',
        userId: null,
        isAdmin: false,
        error: toAuthErrorDetail(error),
      });
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) {
      setAuth(DEFAULT_AUTH_STATE);
      return;
    }
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  useEffect(() => {
    const handleUnauthorized = (): void => {
      void refresh();
    };
    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => ({ auth, refresh }), [auth, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
