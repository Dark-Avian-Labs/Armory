import { useEffect, useState } from 'react';

import { buildCentralAuthLoginUrl } from '../../utils/api';

export function LoginPage() {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };

    try {
      const nextAuthUrl = buildCentralAuthLoginUrl('/builder');

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(nextAuthUrl, window.location.origin);
      } catch {
        setShowFallback(true);
        return cleanup;
      }

      const isHttpUrl =
        parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
      if (!isHttpUrl) {
        setShowFallback(true);
        return cleanup;
      }

      setAuthUrl(nextAuthUrl);

      fallbackTimer = setTimeout(() => setShowFallback(true), 1500);

      try {
        window.location.href = nextAuthUrl;
      } catch {
        setShowFallback(true);
      }
    } catch {
      setShowFallback(true);
    }

    return cleanup;
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="auth-card">
          <div className="mb-6 text-center">
            <p className="page-hero__eyebrow">Authentication</p>
            <h1 className="display-title text-[2.1rem] text-foreground">
              Parametric
            </h1>
            <p className="mt-2 text-sm text-muted">
              Warframe mod planning with a calmer cinematic surface.
            </p>
          </div>
          <p
            className="text-center text-sm text-muted"
            role="status"
            aria-live="polite"
          >
            Redirecting to shared authentication...
          </p>
          {showFallback && authUrl ? (
            <p className="mt-4 text-center text-sm text-muted">
              If you are not redirected,{' '}
              <a className="text-foreground underline" href={authUrl}>
                continue to sign in
              </a>
              .
            </p>
          ) : showFallback && !authUrl ? (
            <p className="error-msg mt-4 text-center" role="alert">
              Unable to load sign-in link due to configuration error — contact
              support or try again.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
