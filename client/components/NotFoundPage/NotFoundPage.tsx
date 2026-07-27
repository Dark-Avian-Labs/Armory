import { Link } from 'react-router';

import { APP_PATHS } from '../../app/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="space-y-3 text-center">
        <span
          className="text-muted/80 block text-8xl leading-none font-bold"
          role="status"
          aria-label="Error 404"
        >
          404
        </span>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted text-sm">We could not find the page you were looking for.</p>
        <Link
          to={APP_PATHS.home}
          className="btn btn-accent inline-flex items-center justify-center text-sm"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
