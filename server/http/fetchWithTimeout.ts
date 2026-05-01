export const FETCH_TIMEOUT_MS = {
  manifest: 120_000,
  exportDownload: 120_000,
  binaryImage: 60_000,
  htmlPage: 60_000,
  warframeMarketItems: 120_000,
  /** Overframe Next.js HTML (stance/arsenal detail, hidden weapon pages) */
  overframeDetailHtml: 8_000,
} as const;

export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const callerSignal = init?.signal;
  const signal =
    callerSignal !== undefined && callerSignal !== null
      ? AbortSignal.any([timeoutSignal, callerSignal])
      : timeoutSignal;
  return fetch(url, { ...init, signal });
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true;
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  );
}
