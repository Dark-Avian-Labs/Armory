import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from '../components/Layout/Layout';
import { NotFoundPage } from '../components/NotFoundPage/NotFoundPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { APP_PATHS } from './paths';

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
  children: ReactNode;
  reset?: () => void;
};

type ChunkErrorBoundaryState = {
  hasError: boolean;
};

class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, ChunkErrorBoundaryState> {
  state: ChunkErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ChunkErrorBoundary] Chunk load failed', error, info.componentStack);
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
          <div className="space-y-4 text-center">
            <p className="text-muted text-sm" role="alert">
              We could not load this page. Please try again.
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="btn btn-accent inline-flex items-center justify-center text-sm"
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
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-atomic="true"
    >
      <p className="text-muted text-sm">Loading...</p>
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
            <Route path="/" element={<Navigate to={APP_PATHS.home} replace />} />
            <Route path={APP_PATHS.buildOverview} element={<BuildOverview />} />
            <Route path={APP_PATHS.buildNew} element={<ModBuilder />} />
            <Route path={APP_PATHS.buildEdit} element={<ModBuilder />} />
            <Route path={APP_PATHS.admin} element={<AdminPage />} />
            <Route path={APP_PATHS.legal} element={<LegalPage />} />
          </Route>
          <Route path={APP_PATHS.login} element={<LoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
}
