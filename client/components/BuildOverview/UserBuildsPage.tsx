import { useParams } from 'react-router';

import { isClerkUserId } from '../../utils/isClerkUserId';
import { BuildOverview } from './BuildOverview';

export function UserBuildsPage() {
  const { userSlug: userSlugParam } = useParams<{ userSlug: string }>();
  const userSlug = userSlugParam?.trim() ?? '';

  if (!userSlug) {
    return (
      <div className="mx-auto max-w-[2000px]">
        <div className="glass-shell flex h-64 items-center justify-center">
          <p className="text-muted">Invalid user.</p>
        </div>
      </div>
    );
  }

  return (
    <BuildOverview
      ownerUserSlug={userSlug}
      ownerUserId={isClerkUserId(userSlug) ? userSlug : undefined}
    />
  );
}
