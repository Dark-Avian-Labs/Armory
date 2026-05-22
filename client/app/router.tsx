import { Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

import { App } from '../App';
import { Layout } from '../components/Layout/Layout';
import { NotFoundPage } from '../components/NotFoundPage/NotFoundPage';
import { SignInPage } from '../features/auth/SignInPage';
import { SignUpPage } from '../features/auth/SignUpPage';
import { APP_PATHS } from './paths';
import {
  AdminPage,
  BuildOverview,
  UserBuildsPage,
  BuildsByEquipmentPage,
  BuildsCatalogPage,
  ChunkErrorBoundary,
  LegalPage,
  LoadoutDetailPage,
  ModBuilder,
  RouteFallback,
} from './routes';

export const router = createBrowserRouter([
  {
    element: (
      <App>
        <ChunkErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </ChunkErrorBoundary>
      </App>
    ),
    children: [
      {
        element: <Layout />,
        children: [
          { path: APP_PATHS.legal, element: <LegalPage /> },
          { path: '/auth/legal', element: <LegalPage /> },
          { path: '/', element: <Navigate to={APP_PATHS.home} replace /> },
          { path: '/builder', element: <Navigate to={APP_PATHS.home} replace /> },
          {
            path: '/builder/builds/:equipmentType/:equipmentUniqueName',
            element: <BuildsByEquipmentPage />,
          },
          { path: '/builder/loadouts/:loadoutId', element: <LoadoutDetailPage /> },
          { path: APP_PATHS.buildsExplore, element: <BuildsCatalogPage /> },
          { path: APP_PATHS.myBuilds, element: <BuildOverview /> },
          { path: APP_PATHS.userBuilds, element: <UserBuildsPage /> },
          { path: APP_PATHS.buildNew, element: <ModBuilder /> },
          { path: APP_PATHS.buildEdit, element: <ModBuilder /> },
          { path: APP_PATHS.admin, element: <AdminPage /> },
          { path: '/sign-in/*', element: <SignInPage /> },
          { path: '/sign-up/*', element: <SignUpPage /> },
          { path: APP_PATHS.login, element: <Navigate to="/sign-in" replace /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
