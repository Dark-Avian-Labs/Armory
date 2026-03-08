import { useEffect, type ReactNode } from 'react';

import { useAuth } from './AuthContext';
import { buildCentralAuthLoginUrl } from '../../utils/api';

function CentralAuthRedirect({ message }: { message: string }) {
  useEffect(() => {
    window.location.href = buildCentralAuthLoginUrl();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, logout } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Checking session...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <CentralAuthRedirect message="Redirecting to central authentication..." />
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-panel max-w-md p-6 text-center">
          <h1 className="mb-2 text-xl font-semibold text-foreground">
            Access denied
          </h1>
          <p className="mb-4 text-sm text-muted">
            Your account is authenticated but does not have access to this
            application.
          </p>
          <button
            className="btn btn-accent"
            type="button"
            onClick={() => {
              void logout();
            }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return children;
}
