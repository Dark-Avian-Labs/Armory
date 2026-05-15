import type { ReactNode } from 'react';

import { CompareProvider } from './context/CompareContext';
import { AuthProvider } from './features/auth/AuthContext';

export function App({ children }: { children: ReactNode }) {
  return (
    <AuthProvider defaultLogoutRedirectPath="/builder/builds">
      <CompareProvider>{children}</CompareProvider>
    </AuthProvider>
  );
}
