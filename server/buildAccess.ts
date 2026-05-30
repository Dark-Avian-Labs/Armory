import {
  canReadSharedResource,
  type ReadAccessContext,
  type VisibilityRow,
} from './loadoutAccess.js';

export type BuildVisibilityRow = VisibilityRow;

export function canReadBuild(row: BuildVisibilityRow, context: ReadAccessContext): boolean;
export function canReadBuild(
  row: BuildVisibilityRow,
  sessionUserId: string | null,
  isGameAdmin: boolean,
  shareToken?: string | null,
): boolean;
export function canReadBuild(
  row: BuildVisibilityRow,
  sessionUserIdOrContext: string | null | ReadAccessContext,
  isGameAdmin?: boolean,
  shareToken?: string | null,
): boolean {
  const context: ReadAccessContext =
    typeof sessionUserIdOrContext === 'object' && sessionUserIdOrContext !== null
      ? sessionUserIdOrContext
      : {
          sessionUserId: sessionUserIdOrContext,
          isGameAdmin: isGameAdmin ?? false,
          shareToken,
        };

  return canReadSharedResource(row, context);
}
