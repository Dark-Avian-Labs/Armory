import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { LEGAL_ENTITY_NAME } from '../../app/config';

export function LegalPage() {
  const { pathname } = useLocation();
  const onAuthLegalPath = pathname === '/auth/legal';

  useEffect(() => {
    if (onAuthLegalPath) return;
    window.location.replace('/auth/legal');
  }, [onAuthLegalPath]);

  if (onAuthLegalPath) {
    return (
      <section className="mx-auto max-w-[900px] rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-6">
        <h1 className="mb-3 text-2xl font-semibold">Legal</h1>
        <p className="text-muted text-sm">
          Legal information for {LEGAL_ENTITY_NAME} applications is published by the central Auth
          service. Configure AUTH_SERVICE_URL so this page can redirect to the full legal notice.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[900px] rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-6">
      <h1 className="mb-3 text-2xl font-semibold">Legal</h1>
      <p className="text-muted text-sm" role="status" aria-live="polite">
        Redirecting to legal information…
      </p>
    </section>
  );
}
