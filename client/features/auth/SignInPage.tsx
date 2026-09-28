import { APP_PATHS } from '@/app/paths';
import { ClerkAuthShell } from '@/components/ClerkAuthShell';
import { useTheme } from '@/context/ThemeContext';
import { buildClerkAppearance } from '@/lib/clerkAppearance';
import { SignIn } from '@clerk/react';
import { Navigate } from 'react-router';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function SignInPage() {
  const { mode } = useTheme();

  if (!publishableKey) {
    return <Navigate to={APP_PATHS.home} replace />;
  }

  return (
    <ClerkAuthShell
      title="Sign in to Armory"
      subtitle="Plan and share Warframe builds with your Dark Avian Labs account."
    >
      <SignIn
        routing="hash"
        signUpUrl={APP_PATHS.signUp}
        fallbackRedirectUrl={APP_PATHS.home}
        appearance={buildClerkAppearance(mode)}
      />
    </ClerkAuthShell>
  );
}
