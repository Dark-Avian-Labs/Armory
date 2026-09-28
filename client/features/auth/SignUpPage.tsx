import { APP_PATHS } from '@/app/paths';
import { ClerkAuthShell } from '@/components/ClerkAuthShell';
import { useTheme } from '@/context/ThemeContext';
import { buildClerkAppearance } from '@/lib/clerkAppearance';
import { SignUp } from '@clerk/react';
import { Navigate } from 'react-router';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function SignUpPage() {
  const { mode } = useTheme();

  if (!publishableKey) {
    return <Navigate to={APP_PATHS.home} replace />;
  }

  return (
    <ClerkAuthShell
      title="Create your account"
      subtitle="One account for Codex and Armory. We only store your user id in our apps."
    >
      <SignUp
        routing="hash"
        signInUrl={APP_PATHS.signIn}
        fallbackRedirectUrl={APP_PATHS.home}
        appearance={buildClerkAppearance(mode)}
      />
    </ClerkAuthShell>
  );
}
