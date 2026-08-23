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

import { apiFetch, API_UNAUTHORIZED_EVENT } from '../../utils/api';
import type { AuthErrorDetail, AuthState } from './types';

interface AuthContextValue {
  auth: AuthState;
  refresh: () => Promise<void>;
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
  const refreshGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!isLoaded) return;
    const generation = ++refreshGenerationRef.current;
    const applyAuth = (next: AuthState): void => {
      if (refreshGenerationRef.current === generation) {
        setAuth(next);
      }
    };
    if (!isSignedIn) {
      applyAuth({ status: 'unauthenticated', userId: null, isArmoryAdmin: false });
      return;
    }
    try {
      const response = await apiFetch('/api/auth/me');
      if (!response.ok) {
        applyAuth({ status: 'unauthenticated', userId: null, isArmoryAdmin: false });
        return;
      }
      const body = (await response.json()) as {
        authenticated?: boolean;
        userId?: string;
        isArmoryAdmin?: boolean;
      };
      if (!body.authenticated || !body.userId) {
        applyAuth({ status: 'unauthenticated', userId: null, isArmoryAdmin: false });
        return;
      }
      applyAuth({
        status: 'ok',
        userId: body.userId,
        isArmoryAdmin: body.isArmoryAdmin === true,
      });
    } catch (error) {
      applyAuth({
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
