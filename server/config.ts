import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { config as loadEnv } from '@dotenvx/dotenvx';

import { normalizeClerkEnv } from './clerkEnv.js';

function resolveEnvFilePath(projectRoot: string): string | null {
  const normalizedNodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  const envFileByMode: Record<string, string> = {
    production: '.env.production',
    development: '.env.development',
    test: '.env.test',
  };
  const prioritizedFileSet = new Set<string>();
  const primaryEnvFile = envFileByMode[normalizedNodeEnv];
  if (primaryEnvFile) {
    prioritizedFileSet.add(primaryEnvFile);
  }
  prioritizedFileSet.add('.env.production');
  prioritizedFileSet.add('.env.development');
  const prioritizedFiles = Array.from(prioritizedFileSet);

  for (const fileName of prioritizedFiles) {
    const candidatePath = path.join(projectRoot, fileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

const projectRoot = process.cwd();
const envKeysPath = path.join(projectRoot, '.env.keys');
if (fs.existsSync(envKeysPath)) {
  try {
    loadEnv({ path: envKeysPath });
  } catch (error) {
    console.error(`[Config] Failed to load environment keys from "${envKeysPath}".`, error);
    throw error;
  }
}

const envPath = resolveEnvFilePath(projectRoot);
if (envPath) {
  try {
    loadEnv({ path: envPath });
  } catch (error) {
    console.error(`[Config] Failed to load environment via loadEnv from "${envPath}".`, error);
    throw error;
  }
} else {
  console.debug(
    `[Config] No env file resolved (envPath is null); skipping loadEnv for cwd "${projectRoot}".`,
  );
}

normalizeClerkEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parentName = path.basename(path.resolve(__dirname, '..'));
export const PROJECT_ROOT = path.resolve(__dirname, parentName === 'dist' ? '../..' : '..');

function readPackageVersion(projectRoot: string): string {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    const v = pkg.version?.trim();
    return v && v.length > 0 ? v : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const APP_VERSION = readPackageVersion(PROJECT_ROOT);

export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');
export const ARMORY_DB_PATH =
  process.env.ARMORY_DB_PATH?.trim() || path.join(DATA_DIR, 'armory.db');
function resolveSessionDbPath(): string {
  const configured = process.env.SESSION_DB_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(PROJECT_ROOT, configured);
  }
  return path.join(DATA_DIR, 'session.db');
}

export const SESSION_DB_PATH = resolveSessionDbPath();

const _port = parseInt(process.env.PORT || '3002', 10);
export const PORT = Number.isFinite(_port) && _port > 0 ? _port : 3002;
const _shutdownTimeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);
export const SHUTDOWN_TIMEOUT_MS =
  Number.isFinite(_shutdownTimeoutMs) && _shutdownTimeoutMs > 0 ? _shutdownTimeoutMs : 10_000;
export const HOST = process.env.HOST || '127.0.0.1';
export const NODE_ENV = process.env.NODE_ENV || 'development';
const DEV_SESSION_SECRET = 'armory-dev-only-session-secret-32ch';
const rawSessionSecret =
  process.env.SESSION_SECRET?.trim() || (NODE_ENV === 'production' ? '' : DEV_SESSION_SECRET);
if (NODE_ENV === 'production' && rawSessionSecret.length < 32) {
  throw new Error('[FATAL] SESSION_SECRET must be set and at least 32 characters in production.');
}
export const SESSION_SECRET = rawSessionSecret;

export const APP_NAME = 'Armory';

export const MANIFEST_URL = 'https://origin.warframe.com/PublicExport/index_en.txt.lzma';
export const CONTENT_BASE_URL = 'https://content.warframe.com/PublicExport/Manifest/';
export const IMAGE_BASE_URL = 'https://content.warframe.com/PublicExport';

export const REQUIRED_EXPORTS = [
  'ExportCustoms',
  'ExportDrones',
  'ExportFlavour',
  'ExportFusionBundles',
  'ExportGear',
  'ExportKeys',
  'ExportManifest',
  'ExportRecipes',
  'ExportRegions',
  'ExportRelicArcane',
  'ExportResources',
  'ExportSentinels',
  'ExportSortieRewards',
  'ExportUpgrades',
  'ExportWarframes',
  'ExportWeapons',
] as const;

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

export const TRUST_PROXY = parseBooleanEnv(process.env.TRUST_PROXY) ?? false;
export const SECURE_COOKIES =
  parseBooleanEnv(process.env.SECURE_COOKIES) ?? NODE_ENV === 'production';
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME?.trim() || 'darkavianlabs.armory.sid';
export const LEGAL_PAGE_URL =
  process.env.LEGAL_PAGE_URL?.trim() || 'https://darkavianlabs.com/legal/';
export const CLERK_WEBHOOK_SIGNING_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim() || '';
if (NODE_ENV === 'production' && !CLERK_WEBHOOK_SIGNING_SECRET) {
  throw new Error('[FATAL] CLERK_WEBHOOK_SIGNING_SECRET must be set in production.');
}
export { GAME_ID } from './gameId.js';

export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR, EXPORTS_DIR, IMAGES_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  fs.mkdirSync(path.dirname(SESSION_DB_PATH), { recursive: true });
}
