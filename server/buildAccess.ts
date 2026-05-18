export type BuildVisibilityRow = {
  user_id: number;
  visibility?: string | null;
};

export function canReadBuild(
  row: BuildVisibilityRow,
  sessionUserId: number,
  isGameAdmin: boolean,
): boolean {
  if (row.user_id === sessionUserId) return true;
  if (isGameAdmin) return true;
  const vis = row.visibility ?? 'private';
  return vis === 'public' || vis === 'unlisted';
}
