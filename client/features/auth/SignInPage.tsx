import { ClerkAuthShell } from '@/components/ClerkAuthShell';
import { useTheme } from '@/context/ThemeContext';
import { buildClerkAppearance } from '@/lib/clerkAppearance';
import { SignIn } from '@clerk/react';
import { Navigate } from 'react-router';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function SignInPage() {
  const { mode } = useTheme();

  if (!publishableKey) {
    return <Navigate to="/builder/builds" replace />;
  }

  return (
    <ClerkAuthShell
      title="Sign in to Armory"
      subtitle="Plan and share Warframe builds with your Dark Avian Labs account."
    >
      <SignIn
        routing="hash"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/builder/builds"
        appearance={buildClerkAppearance(mode)}
      />
    </ClerkAuthShell>
  );
}
