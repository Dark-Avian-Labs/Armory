/**
 * Pointer-driven mod slot "peek" (taller hit region + JS hover state) instead of relying on
 * CSS :hover alone for the expanded card. Microsoft Edge enables this automatically; any
 * browser can opt in with `?edge=true` to reproduce Edge behavior while debugging in Chrome.
 */
export function shouldUseModSlotPointerPeek(searchParams: URLSearchParams): boolean {
  if (searchParams.get('edge') === 'true') return true;
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    userAgentData?: { brands?: ReadonlyArray<{ brand: string; version: string }> };
  };
  try {
    const brands = nav.userAgentData?.brands;
    if (brands?.some((b) => /Microsoft Edge/i.test(b.brand))) return true;
  } catch {
    // ignore
  }
  return /\bEdg\//i.test(navigator.userAgent);
}
