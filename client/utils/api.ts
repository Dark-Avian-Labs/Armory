export type ClerkTokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;

let cachedToken: string | null = null;
let inFlightPromise: Promise<string | null> | null = null;
let csrfTokenGeneration = 0;
let getClerkToken: ClerkTokenGetter | null = null;
export const API_UNAUTHORIZED_EVENT = 'armory:api-unauthorized';

export function setClerkTokenGetter(getter: ClerkTokenGetter | null): void {
  getClerkToken = getter;
}

async function resolveClerkToken(skipCache = false): Promise<string | null> {
  if (!getClerkToken) {
    return null;
  }
  try {
    const token = await getClerkToken({ skipCache });
    return token ?? null;
  } catch {
    return null;
  }
}

function emitUnauthorized(url: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(API_UNAUTHORIZED_EVENT, {
      detail: { url },
    }),
  );
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
      const res = await fetch('/api/auth/csrf', { credentials: 'include', cache: 'no-store' });
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

export type ApiErrorBody = {
  error?: string;
  message?: string;
  code?: string;
  errorCode?: string;
  error_code?: string;
};

export type ParsedApiError = {
  status: number;
  message: string;
  code?: string;
};

export async function parseApiError(
  response: Response,
  fallback = 'Request failed',
): Promise<ParsedApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.clone().json()) as ApiErrorBody;
  } catch {
    body = null;
  }

  const code = body?.code ?? body?.errorCode ?? body?.error_code;
  const message =
    (typeof body?.error === 'string' && body.error.trim()) ||
    (typeof body?.message === 'string' && body.message.trim()) ||
    fallback;

  return {
    status: response.status,
    message,
    code: typeof code === 'string' ? code : undefined,
  };
}

export async function readApiErrorMessage(
  response: Response,
  fallback = 'Request failed',
): Promise<string> {
  const parsed = await parseApiError(response, fallback);
  return parsed.message;
}

export class UnauthorizedError extends Error {
  readonly response: Response;
  readonly url: string;

  constructor(url: string, response: Response) {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
    this.url = url;
    this.response = response;
  }
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
    return response.status === 403 && (code === 'CSRF_INVALID' || details.includes('csrf'));
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
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    try {
      const parsed = JSON.parse(init.body) as unknown;
      if (Array.isArray(parsed) || (parsed !== null && typeof parsed === 'object')) {
        headers.set('Content-Type', 'application/json');
      }
    } catch {
      // ignore
    }
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

function withClerkAuthorization(headers: Headers, token: string | null): Headers {
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }
  return headers;
}

function send(
  url: string,
  init: RequestInit | undefined,
  headers: Headers,
  body: BodyInit | null | undefined,
): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: init?.credentials ?? 'include',
    cache: init?.cache ?? 'no-store',
    headers,
    body,
  });
}

function throwIfUnauthorized(url: string, response: Response): void {
  if (response.status === 401) {
    emitUnauthorized(url);
    throw new UnauthorizedError(url, response);
  }
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const needsCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

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

  let clerkToken = await resolveClerkToken(false);
  withClerkAuthorization(headers, clerkToken);

  let response = await send(url, init, headers, requestBody);
  if (response.status === 401 && getClerkToken) {
    const refreshed = await resolveClerkToken(true);
    if (refreshed && refreshed !== clerkToken) {
      clerkToken = refreshed;
      response = await send(
        url,
        init,
        withClerkAuthorization(new Headers(headers), clerkToken),
        requestBody,
      );
    }
  }
  throwIfUnauthorized(url, response);
  if (!needsCsrf || !(await isCsrfFailureResponse(response))) {
    return response;
  }

  clearCsrfToken();
  if (init?.signal?.aborted) {
    throw new DOMException('Request aborted before CSRF retry', 'AbortError');
  }
  const freshCsrfToken = await getCsrfToken();
  if (freshCsrfToken === null) {
    throw new Error('Failed to refresh CSRF token');
  }
  if (init?.signal?.aborted) {
    throw new DOMException('Request aborted before CSRF retry', 'AbortError');
  }

  const retryHeaders = withClerkAuthorization(new Headers(init?.headers), clerkToken);
  setJsonContentType(retryHeaders, init);
  retryHeaders.set('X-CSRF-Token', freshCsrfToken);
  const retryBody = injectCsrfIntoJsonBody(init?.body, freshCsrfToken);
  const retryResponse = await send(url, init, retryHeaders, retryBody);
  throwIfUnauthorized(url, retryResponse);
  return retryResponse;
}
