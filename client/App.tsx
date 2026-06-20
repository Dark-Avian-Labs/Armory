import { ClerkProvider } from '@clerk/react';
import type { ReactNode } from 'react';

import { BuildStorageProvider } from './context/BuildStorageContext';
import { CompareProvider } from './context/CompareContext';
import { AuthProvider } from './features/auth/AuthContext';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function App({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center" role="alert">
        <p className="text-muted text-sm">
          Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to your environment file to enable sign-in.
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/builder/builds">
      <AuthProvider>
        <BuildStorageProvider>
          <CompareProvider>{children}</CompareProvider>
        </BuildStorageProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}
