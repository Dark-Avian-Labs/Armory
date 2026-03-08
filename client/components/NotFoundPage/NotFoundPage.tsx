import { Link } from 'react-router-dom';

import { APP_PATHS } from '../../app/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-shell page-hero w-full max-w-xl text-center">
        <span
          className="block text-7xl font-semibold leading-none text-muted/75"
          role="status"
          aria-label="Error 404"
        >
          404
        </span>
        <div className="page-hero__eyebrow">Navigation</div>
        <h1 className="page-hero__title text-[2rem]">Page not found</h1>
        <p className="text-sm text-muted">
          We could not find the page you were looking for.
        </p>
        <Link to={APP_PATHS.home} className="btn btn-accent mx-auto">
          Return home
        </Link>
      </div>
    </div>
  );
}
