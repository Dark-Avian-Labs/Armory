let cachedToken: string | null = null;
let inFlightPromise: Promise<string | null> | null = null;
let csrfTokenGeneration = 0;
let authRedirectPending = false;

function currentAppPath(): string {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

export function buildCentralAuthLoginUrl(nextPath?: string): string {
  const next = nextPath && nextPath.length > 0 ? nextPath : currentAppPath();
  return `/api/auth/login?next=${encodeURIComponent(next)}`;
}

export function redirectToCentralAuth(nextPath?: string): void {
  if (authRedirectPending) return;
  authRedirectPending = true;
  window.location.href = buildCentralAuthLoginUrl(nextPath);
}

async function getCsrfToken(): Promise<string | null> {
  if (cachedToken !== null) {
    return cachedToken;
  }
  if (inFlightPromise !== null) {
    return await inFlightPromise;
  }

  const generationAtStart = csrfTokenGeneration;
  const ref = { promise: null as Promise<string | null> | null };
  inFlightPromise = ref.promise = (async () => {
    try {
      const res = await fetch('/api/auth/csrf');
      if (!res.ok) {
        return null;
      }
      const body = (await res.json()) as { csrfToken?: string };
      if (!body.csrfToken) {
        return null;
      }
      if (generationAtStart === csrfTokenGeneration) {
        cachedToken = body.csrfToken;
      }
      return body.csrfToken;
    } catch {
      return null;
    } finally {
      if (inFlightPromise === ref.promise) inFlightPromise = null;
    }
  })();

  const token = await inFlightPromise;
  if (token === null) {
    cachedToken = null;
  }
  return token;
}

export function clearCsrfToken(): void {
  csrfTokenGeneration += 1;
  cachedToken = null;
  inFlightPromise = null;
}

async function isCsrfFailureResponse(response: Response): Promise<boolean> {
  const csrfErrorHeader = response.headers.get('X-CSRF-Error');
  if (response.status === 403 && csrfErrorHeader === '1') {
    return true;
  }

  try {
    const body = (await response.clone().json()) as {
      code?: string;
      errorCode?: string;
      error_code?: string;
      error?: string;
      message?: string;
    };
    const code = body.code ?? body.errorCode ?? body.error_code;
    const details = `${body.error ?? ''} ${body.message ?? ''}`.toLowerCase();
    return (
      response.status === 403 &&
      (code === 'CSRF_INVALID' || details.includes('csrf'))
    );
  } catch {
    try {
      const text = (await response.clone().text()).toLowerCase();
      return response.status === 403 && text.includes('csrf');
    } catch {
      return false;
    }
  }
}

function setJsonContentType(headers: Headers, init?: RequestInit): void {
  if (
    !headers.has('Content-Type') &&
    init?.body &&
    typeof init.body === 'string' &&
    (init.body.startsWith('{') || init.body.startsWith('['))
  ) {
    headers.set('Content-Type', 'application/json');
  }
}

function injectCsrfIntoJsonBody(
  body: BodyInit | null | undefined,
  csrfToken: string,
): BodyInit | null | undefined {
  if (typeof body !== 'string') {
    return body;
  }
  const trimmed = body.trimStart();
  if (!trimmed.startsWith('{')) {
    return body;
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return body;
    }
    if (typeof parsed._csrf === 'string' && parsed._csrf.length > 0) {
      return body;
    }
    return JSON.stringify({ ...parsed, _csrf: csrfToken });
  } catch {
    return body;
  }
}

export async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const needsCsrf =
    method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

  const headers = new Headers(init?.headers);
  setJsonContentType(headers, init);
  let requestBody = init?.body;

  if (needsCsrf) {
    const csrfToken = await getCsrfToken();
    if (csrfToken === null) {
      throw new Error('Failed to fetch CSRF token');
    }
    headers.set('X-CSRF-Token', csrfToken);
    requestBody = injectCsrfIntoJsonBody(requestBody, csrfToken);
  }

  const response = await fetch(url, { ...init, headers, body: requestBody });
  if (response.status === 401) {
    redirectToCentralAuth();
    return response;
  }
  if (!needsCsrf || !(await isCsrfFailureResponse(response))) {
    return response;
  }

  clearCsrfToken();
  const freshCsrfToken = await getCsrfToken();
  if (freshCsrfToken === null) {
    throw new Error('Failed to refresh CSRF token');
  }

  const retryHeaders = new Headers(init?.headers);
  setJsonContentType(retryHeaders, init);
  retryHeaders.set('X-CSRF-Token', freshCsrfToken);
  const retryBody = injectCsrfIntoJsonBody(init?.body, freshCsrfToken);
  return fetch(url, { ...init, headers: retryHeaders, body: retryBody });
}
