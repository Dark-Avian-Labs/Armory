import { useParams } from 'react-router-dom';

import { BuildOverview } from './BuildOverview';

export function UserBuildsPage() {
  const { userId: userIdParam } = useParams<{ userId: string }>();
  const userId = Number(userIdParam);

  if (!Number.isInteger(userId) || userId <= 0) {
    return (
      <div className="mx-auto max-w-[2000px]">
        <div className="glass-shell flex h-64 items-center justify-center">
          <p className="text-muted">Invalid user.</p>
        </div>
      </div>
    );
  }

  return <BuildOverview ownerUserId={userId} />;
}
