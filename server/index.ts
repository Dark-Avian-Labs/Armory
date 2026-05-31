import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

import cookieParser from 'cookie-parser';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';

import { clerkMiddleware } from './auth/middleware.js';
import { stopModListCacheCleanup } from './cache/modListCache.js';
import {
  APP_VERSION,
  PORT,
  HOST,
  SESSION_SECRET,
  NODE_ENV,
  SESSION_DB_PATH,
  LEGAL_PAGE_URL,
  TRUST_PROXY,
  SECURE_COOKIES,
  COOKIE_DOMAIN,
  SESSION_COOKIE_NAME,
  APP_NAME,
  PROJECT_ROOT,
  IMAGES_DIR,
  ensureDataDirs,
  SHUTDOWN_TIMEOUT_MS,
} from './config.js';
import { closeAll, getSessionDb, getDb } from './db/connection.js';
import { createAppSchema } from './db/schema.js';
import { seedArchonShards } from './db/seedArchonShards.js';
import { createSessionSchema } from './db/sessionSchema.js';
import { createAppHelmet } from './http/helmetCsp.js';
import { getRequestId, requestIdMiddleware } from './http/requestId.js';
import { isAdminImportRunning, waitForAdminImportIdle } from './import/adminImportJob.js';
import { recoverImportLeaseOnStartup } from './import/importRuns.js';
import { log } from './logger.js';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';
import { clerkWebhookRouter } from './routes/webhooks.js';

const require = createRequire(import.meta.url);
const SQLiteStore = require('better-sqlite3-session-store')(session);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

ensureDataDirs();
createAppSchema();
recoverImportLeaseOnStartup();

const sessionDb = getSessionDb();
createSessionSchema(sessionDb);
console.log(`[${APP_NAME}] Session DB ready (${SESSION_DB_PATH})`);

try {
  seedArchonShards();
} catch (e) {
  console.warn('[DB] Archon shard seed skipped:', e);
}

const app = express();

if (TRUST_PROXY) app.set('trust proxy', 1);
if (NODE_ENV === 'production' && SECURE_COOKIES && !TRUST_PROXY) {
  throw new Error('TRUST_PROXY must be enabled in production when SECURE_COOKIES is enabled.');
}

app.use(createAppHelmet());
app.use(requestIdMiddleware);

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimitDefaults = {
  windowMs: RATE_LIMIT_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
} as const;

const appApiLimiter = rateLimit({
  ...rateLimitDefaults,
  max: 600,
});

app.use(
  '/api/webhooks/clerk',
  appApiLimiter,
  express.raw({ type: 'application/json' }),
  clerkWebhookRouter,
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(clerkMiddleware());

const baselineLimiter = rateLimit({
  ...rateLimitDefaults,
  max: 1200,
  skip: (req) =>
    req.path === '/healthz' ||
    req.path === '/api/version' ||
    req.path === '/favicon.ico' ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/icons/') ||
    /^\/assets\/.+\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(req.path),
});
app.use(baselineLimiter);

const sessionStore = new SQLiteStore({
  client: sessionDb,
  expired: { clear: true, intervalMs: 15 * 60 * 1000 },
});

const cookieOptions: express.CookieOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: SECURE_COOKIES,
  sameSite: SECURE_COOKIES ? 'none' : 'lax',
};
if (COOKIE_DOMAIN) cookieOptions.domain = COOKIE_DOMAIN;

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: cookieOptions,
  }),
);

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req: express.Request) => {
    if (req.body?._csrf) return req.body._csrf as string;
    const header = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    return (Array.isArray(header) ? header[0] : header) ?? null;
  },
  getTokenFromState: (req) => {
    const s = req.session;
    if (!s) return null;
    return (s as { csrfToken?: string }).csrfToken ?? null;
  },
  storeTokenInState: (req, token) => {
    if (req.session) {
      req.session.csrfToken = token as string;
    }
  },
});

app.use(csrfSynchronisedProtection);

app.use((req, res, next) => {
  (res.locals as { csrfToken?: string }).csrfToken = generateToken(req);
  next();
});

const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
function isSameHostOrigin(req: express.Request, origin: string): boolean {
  try {
    const parsedOrigin = new URL(origin);
    const hostHeader = req.headers.host;
    if (typeof hostHeader !== 'string' || hostHeader.length === 0) {
      return false;
    }
    return parsedOrigin.host === hostHeader;
  } catch {
    return false;
  }
}

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!CSRF_PROTECTED_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const secFetchSiteHeader = req.headers['sec-fetch-site'];
  const secFetchSite = Array.isArray(secFetchSiteHeader)
    ? secFetchSiteHeader[0]
    : secFetchSiteHeader;
  if (typeof secFetchSite === 'string' && secFetchSite.toLowerCase() === 'cross-site') {
    res.status(403).json({ error: 'Cross-site request blocked', code: 'CSRF_ORIGIN_INVALID' });
    return;
  }

  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (typeof origin === 'string' && origin.length > 0) {
    if (!isSameHostOrigin(req, origin)) {
      res.status(403).json({ error: 'Origin not allowed', code: 'CSRF_ORIGIN_INVALID' });
      return;
    }
  }

  next();
});

app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ version: APP_VERSION });
});

const publicPageLimiter = rateLimit({
  ...rateLimitDefaults,
  max: 1200,
});

app.use('/api/auth', authRouter);
app.use('/api', appApiLimiter, apiRouter);

app.use('/images', express.static(IMAGES_DIR));

app.use('/icons', express.static(path.join(PROJECT_ROOT, 'icons')));
app.get('/favicon.ico', publicPageLimiter, (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'favicon.ico'));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', app: APP_NAME });
});

app.get('/readyz', (_req, res) => {
  try {
    sessionDb.prepare('SELECT 1').get();
    getDb().prepare('SELECT 1').get();
    res.json({ status: 'ready', app: APP_NAME });
  } catch (err) {
    log('error', 'Readiness check failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    res.status(503).json({ status: 'not_ready', app: APP_NAME });
  }
});

const clientDir = path.resolve(__dirname, '..', 'client');

function sendLegalRedirect(res: express.Response): void {
  res.redirect(LEGAL_PAGE_URL);
}

app.get('/auth/profile', publicPageLimiter, (_req, res) => {
  res.redirect('/sign-in');
});
app.get('/profile', publicPageLimiter, (_req, res) => {
  res.redirect('/sign-in');
});
app.get('/auth/legal', publicPageLimiter, (_req, res) => {
  sendLegalRedirect(res);
});

if (NODE_ENV === 'production') {
  app.use(publicPageLimiter, express.static(clientDir));

  app.get('/login', publicPageLimiter, (_req, res) => {
    res.redirect('/sign-in');
  });
  app.get('/sign-in', publicPageLimiter, (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
  app.get('/sign-up', publicPageLimiter, (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  app.get('/legal', publicPageLimiter, (_req, res) => {
    sendLegalRedirect(res);
  });

  app.get(/.*/, publicPageLimiter, (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err.message || '';
  const lowerMessage = message.toLowerCase();
  const errorCode = (err as { code?: string }).code;
  const isNamedCsrfError =
    err.name === 'CsrfError' || (err.constructor && err.constructor.name === 'CsrfError');
  const isForbiddenError =
    err.name === 'ForbiddenError' || (err.constructor && err.constructor.name === 'ForbiddenError');
  const isCsrfError =
    isNamedCsrfError ||
    errorCode === 'EBADCSRFTOKEN' ||
    (isForbiddenError && lowerMessage.includes('csrf'));
  if (isCsrfError) {
    res.setHeader('X-CSRF-Error', '1');
    res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
    return;
  }
  log('error', 'Unhandled request error', {
    requestId: getRequestId(res),
    err: err.stack ?? message,
  });
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, HOST, () => {
  log('info', `${APP_NAME} server listening`, { host: HOST, port: PORT, nodeEnv: NODE_ENV });
});

function shutdown(): void {
  let done = false;
  function closeAndExit(exitCode: number): void {
    if (done) return;
    done = true;
    stopModListCacheCleanup();
    try {
      closeAll();
    } catch (err) {
      log('error', 'Failed to close DB connections during shutdown', {
        err: err instanceof Error ? err.message : String(err),
      });
      exitCode = 1;
    }
    process.exit(exitCode); // eslint-disable-line n/no-process-exit -- required for graceful shutdown
  }

  const hardTimeout = setTimeout(() => {
    log('warn', 'Shutdown timeout reached; forcing exit', { timeoutMs: SHUTDOWN_TIMEOUT_MS });
    closeAndExit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  void (async () => {
    if (isAdminImportRunning()) {
      log('info', 'Waiting for admin import job before shutdown');
      const importWaitMs = Math.max(SHUTDOWN_TIMEOUT_MS - 2000, 1000);
      const finished = await waitForAdminImportIdle(importWaitMs);
      if (!finished) {
        log('warn', 'Admin import still running; proceeding with shutdown');
      }
    }

    server.close((err) => {
      clearTimeout(hardTimeout);
      if (err) {
        log('error', 'HTTP server close failed', {
          err: err instanceof Error ? err.message : String(err),
        });
        closeAndExit(1);
        return;
      }
      closeAndExit(0);
    });
  })();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
