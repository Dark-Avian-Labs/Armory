# Armory

## Cursor Cloud specific instructions

### Overview

Armory is a Warframe mod builder/planner. It imports game data from DE's public exports, uses Clerk for authentication, and exposes a Codex export mirror. It serves its web UI only in production mode; in development mode it is API-only.

### Running the service

See `README.md` for standard scripts (`pnpm run build`, `pnpm start`, `pnpm run validate`, etc.).

To start in development mode after building:

```bash
NODE_ENV=development node --env-file=.env dist/server/index.js
```

The server listens on port 3002 by default.

### Key gotchas

- **Node >= 25 and pnpm >= 11 required.** Use `nvm install 25` and `npm install -g pnpm@11.1.3`.
- **Encrypted `.env.development` / `.env.production` files.** Create a plain `.env` from `.env.example` for local dev. Run with `node --env-file=.env` so the plain values take precedence over encrypted dotenvx values.
- **API-only in development mode.** Armory only serves the React SPA when `NODE_ENV=production`. In development, the root URL returns 404 ("Cannot GET /"). This is by design; in normal dev flow you'd use Vite's dev server for the client.
- **Database auto-creates on first start.** Armory's schema is created automatically during server initialization, so no manual DB setup is needed.
- **Clerk keys are required in production.** Set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` (or `VITE_CLERK_PUBLISHABLE_KEY`). See `.env.example` for session-token metadata and admin role setup.
