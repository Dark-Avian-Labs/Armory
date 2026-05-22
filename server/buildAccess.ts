export type BuildVisibilityRow = {
  clerk_user_id: string;
  visibility?: string | null;
};

export function canReadBuild(
  row: BuildVisibilityRow,
  sessionUserId: string | null,
  isGameAdmin: boolean,
): boolean {
  if (sessionUserId && row.clerk_user_id === sessionUserId) return true;
  if (isGameAdmin) return true;
  const vis = row.visibility ?? 'private';
  return vis === 'public' || vis === 'unlisted';
}
