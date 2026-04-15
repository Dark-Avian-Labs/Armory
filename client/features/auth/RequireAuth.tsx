import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { buildCentralAuthLoginUrl } from '../../utils/api';
import { useAuth } from './AuthContext';

function CentralAuthRedirect({ message }: { message: string }) {
  useEffect(() => {
    window.location.href = buildCentralAuthLoginUrl();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, logout, refresh, rateLimitedUntilMs } = useAuth();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer =
      status === 'rate_limited'
        ? window.setInterval(() => {
            setNowMs(Date.now());
          }, 1000)
        : null;
    return () => {
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [status]);

  const secondsRemaining = useMemo(() => {
    if (!rateLimitedUntilMs) return 0;
    return Math.max(0, Math.ceil((rateLimitedUntilMs - nowMs) / 1000));
  }, [rateLimitedUntilMs, nowMs]);

  useEffect(() => {
    if (status !== 'rate_limited') return;
    if (secondsRemaining > 0) return;
    void refresh();
  }, [status, secondsRemaining, refresh]);

  if (status === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p className="text-muted">Checking session...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <CentralAuthRedirect message="Redirecting to central authentication..." />;
  }

  if (status === 'forbidden') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-panel max-w-md p-6 text-center">
          <h1 className="text-foreground mb-2 text-xl font-semibold">Access denied</h1>
          <p className="text-muted mb-4 text-sm">
            Your account is authenticated but does not have access to this application.
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

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-panel max-w-md p-6 text-center">
          <h1 className="text-foreground mb-2 text-xl font-semibold">Auth check failed</h1>
          <p className="text-muted mb-4 text-sm">
            We could not verify your session right now. Please try again.
          </p>
          <button
            className="btn btn-accent"
            type="button"
            onClick={() => {
              void refresh();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'rate_limited') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-panel max-w-md p-6 text-center">
          <h1 className="text-foreground mb-2 text-xl font-semibold">Too many requests</h1>
          <p className="text-muted mb-4 text-sm">
            Authentication checks are temporarily rate limited. Please wait before trying again.
          </p>
          <div className="text-warning mb-4 text-2xl font-semibold">{secondsRemaining}s</div>
          <button
            className="btn btn-accent"
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={secondsRemaining > 0}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return children;
}
