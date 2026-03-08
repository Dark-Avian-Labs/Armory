import { useEffect, type ReactNode } from 'react';

import { useAuth } from './AuthContext';
import { buildCentralAuthLoginUrl } from '../../utils/api';

function CentralAuthRedirect({ message }: { message: string }) {
  useEffect(() => {
    window.location.href = buildCentralAuthLoginUrl();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="glass-shell page-hero w-full max-w-lg">
        <div className="page-hero__eyebrow">Authentication</div>
        <h2 className="page-hero__title text-[1.9rem]">Redirecting securely</h2>
        <p className="text-sm text-muted">{message}</p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, logout } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-shell page-hero w-full max-w-lg text-center">
          <div className="page-hero__eyebrow">Session</div>
          <h2 className="page-hero__title text-[1.9rem]">Checking access</h2>
          <p className="text-muted">Checking session...</p>
        </div>
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
        <div className="glass-shell page-hero max-w-md text-center">
          <div className="page-hero__eyebrow">Permissions</div>
          <h1 className="page-hero__title text-[2rem]">Access denied</h1>
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
