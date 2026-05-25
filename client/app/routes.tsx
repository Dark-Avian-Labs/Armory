import { Component, lazy, type ErrorInfo, type ReactNode } from 'react';

export const BuildOverview = lazy(() =>
  import('../components/BuildOverview/BuildOverview').then((mod) => ({
    default: mod.BuildOverview,
  })),
);
export const UserBuildsPage = lazy(() =>
  import('../components/BuildOverview/UserBuildsPage').then((mod) => ({
    default: mod.UserBuildsPage,
  })),
);
export const FavoritesPage = lazy(() =>
  import('../components/BuildOverview/FavoritesPage').then((mod) => ({
    default: mod.FavoritesPage,
  })),
);
export const BuildsCatalogPage = lazy(() =>
  import('../components/BuildsCatalog/BuildsCatalogPage').then((mod) => ({
    default: mod.BuildsCatalogPage,
  })),
);
export const BuildsByEquipmentPage = lazy(() =>
  import('../components/BuildsCatalog/BuildsByEquipmentPage').then((mod) => ({
    default: mod.BuildsByEquipmentPage,
  })),
);
export const LoadoutDetailPage = lazy(() =>
  import('../components/Loadout/LoadoutDetailPage').then((mod) => ({
    default: mod.LoadoutDetailPage,
  })),
);
export const ModBuilder = lazy(() =>
  import('../components/ModBuilder/ModBuilder').then((mod) => ({
    default: mod.ModBuilder,
  })),
);
export const AdminPage = lazy(() =>
  import('../components/Auth/AdminPage').then((mod) => ({
    default: mod.AdminPage,
  })),
);
export const LegalPage = lazy(() =>
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

export class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
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

export function RouteFallback() {
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
