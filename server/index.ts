import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

import cookieParser from 'cookie-parser';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';

import {
  authLoginRedirect,
  requireAuthApiJson,
  requireGameAccess,
  requirePageGameAccess,
} from './auth/middleware.js';
import {
  PORT,
  HOST,
  SESSION_SECRET,
  NODE_ENV,
  CENTRAL_DB_PATH,
  TRUST_PROXY,
  SECURE_COOKIES,
  COOKIE_DOMAIN,
  SESSION_COOKIE_NAME,
  GAME_ID,
  APP_NAME,
  PROJECT_ROOT,
  IMAGES_DIR,
  ensureDataDirs,
} from './config.js';
import { createCentralSchema } from './db/centralSchema.js';
import { closeAll, getCentralDb } from './db/connection.js';
import { createAppSchema } from './db/schema.js';
import { seedArchonShards } from './db/seedArchonShards.js';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';

const require = createRequire(import.meta.url);
const SQLiteStore = require('better-sqlite3-session-store')(session);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

ensureDataDirs();
createAppSchema();

const centralDb = getCentralDb();
createCentralSchema(centralDb);
console.log(`[${APP_NAME}] Central DB ready (${CENTRAL_DB_PATH})`);

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

app.use(helmet());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const baselineLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === '/healthz' ||
    req.path === '/favicon.ico' ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/icons/') ||
    /^\/assets\/.+\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(req.path),
});
app.use(baselineLimiter);

const sessionStore = new SQLiteStore({
  client: centralDb,
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

const appApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicPageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authRouter);
app.use('/api', appApiLimiter, requireAuthApiJson, requireGameAccess(GAME_ID), apiRouter);

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
    centralDb.prepare('SELECT 1').get();
    res.json({ status: 'ready', app: APP_NAME });
  } catch {
    res.status(503).json({ status: 'not_ready', app: APP_NAME });
  }
});

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL?.trim().replace(/\/+$/, '');
const productionClientDir = path.resolve(__dirname, '..', 'client');

function sendLegalSpa(res: express.Response): void {
  if (NODE_ENV !== 'production') {
    res.status(502).send('Auth service URL is not configured.');
    return;
  }
  res.sendFile(path.join(productionClientDir, 'index.html'));
}

app.get('/auth/profile', publicPageLimiter, (_req, res) => {
  if (AUTH_SERVICE_URL) {
    res.redirect(`${AUTH_SERVICE_URL}/profile`);
    return;
  }
  res.redirect('/login');
});
app.get('/profile', publicPageLimiter, (_req, res) => {
  res.redirect('/auth/profile');
});
app.get('/auth/legal', publicPageLimiter, (_req, res) => {
  if (AUTH_SERVICE_URL) {
    res.redirect(`${AUTH_SERVICE_URL}/legal`);
    return;
  }
  sendLegalSpa(res);
});

if (NODE_ENV === 'production') {
  const clientDir = path.resolve(__dirname, '..', 'client');
  app.use(publicPageLimiter, express.static(clientDir));

  app.get('/login', publicPageLimiter, (req, res) => {
    authLoginRedirect(req, res);
  });

  app.get('/legal', publicPageLimiter, (_req, res) => {
    if (AUTH_SERVICE_URL) {
      res.redirect(`${AUTH_SERVICE_URL}/legal`);
      return;
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  app.get(/.*/, publicPageLimiter, requirePageGameAccess, (_req, res) => {
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
  console.error('[Error]', err.stack ?? message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[${APP_NAME}] Server running on http://${HOST}:${PORT} (${NODE_ENV})`);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;
function shutdown(): void {
  let done = false;
  function closeAndExit(): void {
    if (done) return;
    done = true;
    try {
      closeAll();
    } catch (err) {
      console.error('[Shutdown] Failed to close DB connections:', err);
    }
    process.exit(0); // eslint-disable-line n/no-process-exit -- required for graceful shutdown
  }
  const timeout = setTimeout(() => closeAndExit(), SHUTDOWN_TIMEOUT_MS);
  server.close(() => {
    clearTimeout(timeout);
    closeAndExit();
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
