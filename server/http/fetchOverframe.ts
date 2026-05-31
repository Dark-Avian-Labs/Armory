import { createCuimpHttp } from 'cuimp';

import { FETCH_TIMEOUT_MS } from './fetchWithTimeout.js';

const OVERFRAME_BASE_URL = 'https://overframe.gg';
const BUILD_ID_BOOTSTRAP_PATH = '/build/new/warframes/';

const overframeClient = createCuimpHttp({
  descriptor: { browser: 'chrome', version: '146' },
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
});

let cachedBuildId: string | null = null;

export function resetOverframeSession(): void {
  cachedBuildId = null;
}

export function getOverframeBuildId(): string | null {
  return cachedBuildId;
}

export function extractBuildIdFromHtml(html: string): string | null {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const end = html.indexOf('</script>', start);
  if (end < 0) return null;

  try {
    const parsed = JSON.parse(html.slice(start + marker.length, end)) as { buildId?: unknown };
    return typeof parsed.buildId === 'string' && parsed.buildId.length > 0 ? parsed.buildId : null;
  } catch {
    return null;
  }
}

function toAbsoluteOverframeUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return `${OVERFRAME_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function responseBodyText(rawBody: Buffer, data: unknown): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf-8');
  if (rawBody.length > 0) return rawBody.toString('utf-8');
  if (data !== null && data !== undefined) return JSON.stringify(data);
  return '';
}

async function fetchOverframeRaw(
  pathOrUrl: string,
  timeoutMs: number,
): Promise<{ status: number; body: string; rawBody: Buffer }> {
  const url = toAbsoluteOverframeUrl(pathOrUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await overframeClient.get(url, { signal: controller.signal });
    const body = responseBodyText(response.rawBody, response.data);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return { status: response.status, body, rawBody: response.rawBody };
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`Failed to fetch ${url}: timed out after ${timeoutMs}ms`);
      timeoutError.name = 'AbortError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchOverframeHtml(
  path: string,
  timeoutMs: number = FETCH_TIMEOUT_MS.htmlPage,
): Promise<string> {
  const { body } = await fetchOverframeRaw(path, timeoutMs);
  const buildId = extractBuildIdFromHtml(body);
  if (buildId) {
    cachedBuildId ??= buildId;
  }
  return body;
}

export async function fetchOverframeBytes(
  pathOrUrl: string,
  timeoutMs: number = FETCH_TIMEOUT_MS.binaryImage,
): Promise<Buffer> {
  const { rawBody } = await fetchOverframeRaw(pathOrUrl, timeoutMs);
  return rawBody;
}

export async function ensureOverframeBuildId(
  timeoutMs: number = FETCH_TIMEOUT_MS.htmlPage,
): Promise<string> {
  if (cachedBuildId) return cachedBuildId;

  const html = await fetchOverframeHtml(BUILD_ID_BOOTSTRAP_PATH, timeoutMs);
  const buildId = extractBuildIdFromHtml(html);
  if (!buildId) {
    throw new Error('Failed to extract Overframe buildId from bootstrap page');
  }

  cachedBuildId = buildId;
  return buildId;
}

export function overframeJsonPath(pagePath: string, buildId: string): string {
  const normalized = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  const withoutTrailingSlash = normalized.replace(/\/+$/, '');
  return `/_next/data/${buildId}${withoutTrailingSlash}.json`;
}

export async function fetchOverframePageJson<T>(
  pagePath: string,
  timeoutMs: number = FETCH_TIMEOUT_MS.overframeDetailHtml,
): Promise<T> {
  const buildId = await ensureOverframeBuildId(timeoutMs);
  const jsonPath = overframeJsonPath(pagePath, buildId);
  const { body } = await fetchOverframeRaw(jsonPath, timeoutMs);

  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse Overframe JSON for ${pagePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
