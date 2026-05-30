export type VisibilityRow = {
  clerk_user_id: string;
  visibility?: string | null;
  share_token?: string | null;
};

export type ReadAccessContext = {
  sessionUserId: string | null;
  isGameAdmin: boolean;
  shareToken?: string | null;
};

function normalizeShareToken(token: string | null | undefined): string | null {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function canReadSharedResource(row: VisibilityRow, context: ReadAccessContext): boolean {
  const { sessionUserId, isGameAdmin, shareToken } = context;
  if (sessionUserId && row.clerk_user_id === sessionUserId) return true;
  if (isGameAdmin) return true;

  const vis = row.visibility ?? 'private';
  if (vis === 'public') return true;
  if (vis === 'unlisted') {
    const rowToken = normalizeShareToken(row.share_token);
    const queryToken = normalizeShareToken(shareToken);
    return Boolean(rowToken && queryToken && rowToken === queryToken);
  }
  return false;
}

export function canReadLoadout(row: VisibilityRow, context: ReadAccessContext): boolean {
  return canReadSharedResource(row, context);
}
