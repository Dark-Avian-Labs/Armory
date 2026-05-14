/**
 * Opt-in mod-slot pointer "peek" experiment (`?edge=true`). No UA sniffing — normal builds
 * stay on the default CSS :hover path so production is unchanged.
 */
export function shouldUseModSlotPointerPeek(searchParams: URLSearchParams): boolean {
  return searchParams.get('edge') === 'true';
}
