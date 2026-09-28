import { createBrowserRouter, Navigate } from 'react-router';

import { App } from '../App';
import { Layout } from '../components/Layout/Layout';
import { NotFoundPage } from '../components/NotFoundPage/NotFoundPage';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { SignInPage } from '../features/auth/SignInPage';
import { SignUpPage } from '../features/auth/SignUpPage';
import { APP_PATHS } from './paths';
import {
  AdminPage,
  BuildOverview,
  UserBuildsPage,
  FavoritesPage,
  BuildsByEquipmentPage,
  BuildsCatalogPage,
  LegalPage,
  LoadoutDetailPage,
  ModBuilder,
} from './routes';

export const router = createBrowserRouter([
  {
    element: (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    ),
    children: [
      {
        element: <Layout />,
        children: [
          { path: APP_PATHS.legal, element: <LegalPage /> },
          { path: '/auth/legal', element: <Navigate to={APP_PATHS.legal} replace /> },
          { path: '/', element: <Navigate to={APP_PATHS.home} replace /> },
          { path: '/builder', element: <Navigate to={APP_PATHS.home} replace /> },
          {
            path: '/builder/builds/:equipmentType/:equipmentUniqueName',
            element: <BuildsByEquipmentPage />,
          },
          { path: '/builder/loadouts/:loadoutId', element: <LoadoutDetailPage /> },
          { path: APP_PATHS.buildsExplore, element: <BuildsCatalogPage /> },
          { path: APP_PATHS.myBuilds, element: <BuildOverview /> },
          { path: APP_PATHS.favorites, element: <FavoritesPage /> },
          { path: APP_PATHS.userBuilds, element: <UserBuildsPage /> },
          { path: APP_PATHS.buildNew, element: <ModBuilder /> },
          { path: APP_PATHS.buildEdit, element: <ModBuilder /> },
          { path: APP_PATHS.admin, element: <AdminPage /> },
          { path: `${APP_PATHS.signIn}/*`, element: <SignInPage /> },
          { path: `${APP_PATHS.signUp}/*`, element: <SignUpPage /> },
          { path: APP_PATHS.login, element: <Navigate to={APP_PATHS.signIn} replace /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
