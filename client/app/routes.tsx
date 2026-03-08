import { Component, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { APP_PATHS } from './paths';
import { Layout } from '../components/Layout/Layout';
import { NotFoundPage } from '../components/NotFoundPage/NotFoundPage';
import { RequireAuth } from '../features/auth/RequireAuth';

const BuildOverview = lazy(() =>
  import('../components/BuildOverview/BuildOverview').then((mod) => ({
    default: mod.BuildOverview,
  })),
);
const ModBuilder = lazy(() =>
  import('../components/ModBuilder/ModBuilder').then((mod) => ({
    default: mod.ModBuilder,
  })),
);
const AdminPage = lazy(() =>
  import('../components/Auth/AdminPage').then((mod) => ({
    default: mod.AdminPage,
  })),
);
const ProfilePage = lazy(() =>
  import('../features/profile/ProfilePage').then((mod) => ({
    default: mod.ProfilePage,
  })),
);
const LoginPage = lazy(() =>
  import('../components/Auth/LoginPage').then((mod) => ({
    default: mod.LoginPage,
  })),
);
const LegalPage = lazy(() =>
  import('../features/legal/LegalPage').then((mod) => ({
    default: mod.LegalPage,
  })),
);

type ChunkErrorBoundaryProps = {
  children: React.ReactNode;
  reset?: () => void;
};

type ChunkErrorBoundaryState = {
  hasError: boolean;
};

class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(
      '[ChunkErrorBoundary] Chunk load failed',
      error,
      info.componentStack,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    if (this.props.reset) {
      this.props.reset();
      return;
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="glass-shell page-hero w-full max-w-xl text-center">
            <div className="page-hero__eyebrow">Routing</div>
            <h2 className="page-hero__title text-[2rem]">
              This page did not arrive cleanly.
            </h2>
            <p className="text-sm text-muted" role="alert">
              We could not load this page. Please try again.
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="btn btn-accent mx-auto"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-shell page-hero w-full max-w-lg text-center">
        <div className="page-hero__eyebrow">Loading</div>
        <h2 className="page-hero__title text-[1.9rem]">
          Preparing the next view
        </h2>
        <p className="text-sm text-muted" role="status" aria-live="polite">
          Loading...
        </p>
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route
              path="/"
              element={<Navigate to={APP_PATHS.home} replace />}
            />
            <Route path={APP_PATHS.buildOverview} element={<BuildOverview />} />
            <Route path={APP_PATHS.buildNew} element={<ModBuilder />} />
            <Route path={APP_PATHS.buildEdit} element={<ModBuilder />} />
            <Route path={APP_PATHS.admin} element={<AdminPage />} />
            <Route path={APP_PATHS.profile} element={<ProfilePage />} />
            <Route path={APP_PATHS.legal} element={<LegalPage />} />
          </Route>
          <Route path={APP_PATHS.login} element={<LoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
}
