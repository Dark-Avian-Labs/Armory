import { useAuth as useClerkAuth } from '@clerk/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { apiFetch, clearCsrfToken, API_UNAUTHORIZED_EVENT } from '../../utils/api';
import type { AuthErrorDetail, AuthState } from './types';

interface AuthContextValue {
  auth: AuthState;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_AUTH_STATE: AuthState = {
  status: 'loading',
  userId: null,
  isArmoryAdmin: false,
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
  const { isSignedIn, isLoaded } = useClerkAuth();
  const [auth, setAuth] = useState<AuthState>(DEFAULT_AUTH_STATE);

  const refresh = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setAuth({ status: 'unauthenticated', userId: null, isArmoryAdmin: false });
      return;
    }
    try {
      const response = await apiFetch('/api/auth/me');
      if (!response.ok) {
        setAuth({ status: 'unauthenticated', userId: null, isArmoryAdmin: false });
        return;
      }
      const body = (await response.json()) as {
        authenticated?: boolean;
        userId?: string;
        isArmoryAdmin?: boolean;
      };
      if (!body.authenticated || !body.userId) {
        setAuth({ status: 'unauthenticated', userId: null, isArmoryAdmin: false });
        return;
      }
      setAuth({
        status: 'ok',
        userId: body.userId,
        isArmoryAdmin: body.isArmoryAdmin === true,
      });
    } catch (error) {
      setAuth({
        status: 'error',
        userId: null,
        isArmoryAdmin: false,
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

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearCsrfToken();
      window.location.href = '/builder/builds';
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ auth, refresh, logout }),
    [auth, refresh, logout],
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
