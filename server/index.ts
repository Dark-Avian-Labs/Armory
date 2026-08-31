import path from 'path';
import { fileURLToPath } from 'url';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';

import { clerkMiddleware, getClerkAuthState } from './auth/middleware.js';
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
  USING_INSECURE_DEV_SESSION_SECRET,
} from './config.js';
import { closeAll, getCatalogDb, getSessionDb, getUserDb } from './db/connection.js';
import { repairPlaceholderArtifactSlots } from './db/repairArtifactSlots.js';
import { createAppSchema } from './db/schema.js';
import { createSessionSchema } from './db/sessionSchema.js';
import { SqliteSessionStore } from './db/sqliteSessionStore.js';
import { createAppHelmet } from './http/helmetCsp.js';
import { getRequestId, requestIdMiddleware } from './http/requestId.js';
import { isAdminImportRunning, waitForAdminImportIdle } from './import/adminImportJob.js';
import { recoverImportLeaseOnStartup } from './import/importRuns.js';
import { log } from './logger.js';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';
import { clerkWebhookRouter } from './routes/webhooks.js';
import { bindClerkUserSessionMiddleware } from './session/bindClerkUserSession.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

ensureDataDirs();
createAppSchema();
repairPlaceholderArtifactSlots();
recoverImportLeaseOnStartup();

const sessionDb = getSessionDb();
createSessionSchema(sessionDb);
log('info', 'Session DB ready', { path: SESSION_DB_PATH });

const app = express();

if (TRUST_PROXY) app.set('trust proxy', 1);
if (NODE_ENV === 'production' && SECURE_COOKIES && !TRUST_PROXY) {
  throw new Error('TRUST_PROXY must be enabled in production when SECURE_COOKIES is enabled.');
}

app.use(createAppHelmet());
app.use(requestIdMiddleware);
app.use(
  compression({
    filter: (req, res) => {
      if (req.path.includes('/stream')) return false;
      const accept = req.headers.accept;
      if (typeof accept === 'string' && accept.includes('text/event-stream')) return false;
      const contentType = res.getHeader('Content-Type');
      if (typeof contentType === 'string' && contentType.includes('text/event-stream'))
        return false;
      return compression.filter(req, res);
    },
  }),
);

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

const writeApiLimiter = rateLimit({
  ...rateLimitDefaults,
  max: 120,
  message: { error: 'Too many write requests, please try again later' },
});

const probeLimiter = rateLimit({
  ...rateLimitDefaults,
  max: 1200,
});

app.use(
  '/api/webhooks/clerk',
  appApiLimiter,
  express.raw({ type: 'application/json' }),
  clerkWebhookRouter,
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', app: APP_NAME });
});

app.get('/readyz', probeLimiter, (_req, res) => {
  try {
    sessionDb.prepare('SELECT 1').get();
    getCatalogDb().prepare('SELECT 1').get();
    getUserDb().prepare('SELECT 1').get();
    res.json({ status: 'ready', app: APP_NAME });
  } catch (err) {
    log('error', 'Readiness check failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    res.status(503).json({ status: 'not_ready', app: APP_NAME });
  }
});

app.use(clerkMiddleware());

const baselineLimiter = rateLimit({
  ...rateLimitDefaults,
  max: 1200,
  skip: (req) =>
    req.path === '/healthz' ||
    req.path === '/readyz' ||
    req.path === '/api/version' ||
    req.path === '/favicon.ico' ||
    req.path === '/favicon.png' ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/icons/') ||
    /^\/assets\/.+\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(req.path),
});
app.use(baselineLimiter);

app.use('/api', (req, res, next) => {
  const method = req.method.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    writeApiLimiter(req, res, next);
    return;
  }
  next();
});

const sessionStore = new SqliteSessionStore({
  db: sessionDb,
  cleanupIntervalMs: 15 * 60 * 1000,
});

const cookieOptions: express.CookieOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: SECURE_COOKIES,
  sameSite: 'lax',
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
app.locals.generateCsrfToken = generateToken;
app.use(
  '/api',
  bindClerkUserSessionMiddleware(
    (req) => getClerkAuthState(req).userId,
    (req) => {
      const generate = req.app.locals.generateCsrfToken as
        | ((request: express.Request, overwrite?: boolean) => string)
        | undefined;
      generate?.(req, true);
    },
  ),
);

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

app.use('/images', (req, res, next) => {
  if (/\.hash$/i.test(req.path)) {
    res.status(404).end();
    return;
  }
  next();
});
const GAME_ASSET_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
app.use(
  '/images',
  express.static(IMAGES_DIR, {
    maxAge: GAME_ASSET_MAX_AGE_MS,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.hash')) {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }),
);

app.use(
  '/icons',
  express.static(path.join(PROJECT_ROOT, 'icons'), { maxAge: GAME_ASSET_MAX_AGE_MS }),
);
const faviconPng = path.join(PROJECT_ROOT, 'favicon.png');
app.get('/favicon.png', publicPageLimiter, (_req, res) => {
  res.sendFile(faviconPng);
});
app.get('/favicon.ico', publicPageLimiter, (_req, res) => {
  res.sendFile(faviconPng);
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
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
  const sendSpaIndex = (res: express.Response): void => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDir, 'index.html'));
  };

  app.use(
    publicPageLimiter,
    express.static(clientDir, {
      index: false,
      setHeaders: (res, filePath) => {
        const relative = path.relative(clientDir, filePath);
        if (relative.startsWith(`assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  app.get('/login', publicPageLimiter, (_req, res) => {
    res.redirect('/sign-in');
  });
  app.get('/sign-in', publicPageLimiter, (_req, res) => {
    sendSpaIndex(res);
  });
  app.get('/sign-up', publicPageLimiter, (_req, res) => {
    sendSpaIndex(res);
  });

  app.get('/legal', publicPageLimiter, (_req, res) => {
    sendLegalRedirect(res);
  });

  app.get(/.*/, publicPageLimiter, (_req, res) => {
    sendSpaIndex(res);
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
  if (USING_INSECURE_DEV_SESSION_SECRET) {
    const hostIsLoopback =
      HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1' || HOST === '[::1]';
    if (!hostIsLoopback) {
      log(
        'warn',
        'INSECURE DEV SESSION_SECRET is active while HOST is non-loopback. Set SESSION_SECRET or bind to 127.0.0.1.',
        { host: HOST },
      );
    } else {
      log(
        'warn',
        'Using insecure DEV SESSION_SECRET (ALLOW_INSECURE_DEV=1). Do not use in production.',
      );
    }
  }
});
server.headersTimeout = 65_000;
server.requestTimeout = 120_000;

function shutdown(baseExitCode = 0): void {
  let done = false;
  function closeAndExit(exitCode: number): void {
    if (done) return;
    done = true;
    stopModListCacheCleanup();
    sessionStore.dispose();
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
      closeAndExit(baseExitCode);
    });
    server.closeIdleConnections();
    const forceCloseMs = Math.max(0, SHUTDOWN_TIMEOUT_MS - 500);
    setTimeout(() => {
      server.closeAllConnections();
    }, forceCloseMs);
  })();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection; shutting down', {
    err: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  });
  shutdown(1);
});

process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception; shutting down', {
    err: err.stack ?? err.message,
  });
  shutdown(1);
});

export default app;
