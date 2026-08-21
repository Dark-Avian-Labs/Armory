# Armory

## Org standards

Shared Dark Avian Labs engineering conventions (README shape, CI/PR runners, validate, release tracks, OpenWiki) live in AppBase [`docs/org-standards/`](../AppBase/docs/org-standards/). Prefer those docs when aligning workflows or quality gates.

## Cursor Cloud specific instructions

### Overview

Armory is a Warframe mod builder/planner. It imports game data from DE's public exports and uses Clerk for authentication. Codex reads Armory's SQLite catalog directly for Warframe sync. It serves its web UI only in production mode; in development mode it is API-only.

### Running the service

See `README.md` for standard scripts (`pnpm run build`, `pnpm start`, `pnpm run validate`, etc.).

To start in development mode after building (preferred when `DOTENV_PRIVATE_KEY_DEVELOPMENT` is available):

```bash
NODE_ENV=development pnpm dotenvx run -f .env.development -- node dist/server/index.js
```

Without the private key, use a plain `.env` instead:

```bash
NODE_ENV=development node --env-file=.env dist/server/index.js
```

The server listens on port 3002 by default.

### Key gotchas

- **Node >= 26 and pnpm >= 11 required.** Use `nvm install 26` and `npm install -g pnpm@latest-11`. The `packageManager` field in `package.json` must stay an exact version (e.g. `pnpm@11.3.0`) — Corepack does not accept dist-tags like `latest-11`.
- **Encrypted `.env.development` / `.env.production` files.** When `DOTENV_PRIVATE_KEY_DEVELOPMENT` is set as an env var, use dotenvx to decrypt at runtime: `NODE_ENV=development pnpm dotenvx run -f .env.development -- node dist/server/index.js`. Without the private key, create a plain `.env` from `.env.example` and run with `node --env-file=.env`.
- **API-only in development mode.** Armory only serves the React SPA when `NODE_ENV=production`. In development, the root URL returns 404 ("Cannot GET /"). This is by design; in normal dev flow you'd use Vite's dev server for the client.
- **Database auto-creates on first start.** Armory uses two SQLite files: `ARMORY_DB_PATH` (catalog only; Codex reads this) and `USER_DB_PATH` (builds, loadouts, favorites). Use absolute paths in production. See `docs/catalog-rebuild.md` for catalog-only rebuilds.
- **Force Full Re-import** (admin) resets catalog tables only, then runs a fresh import (no restore of scraped/image columns). User DB is untouched.
- **Build keys:** Saves use `/Armory/Helminth/...`, `/Armory/Ability/...`, and `/Armory/Archon/...` in `mod_config` (v1 fields still load for older JSON).
- **Clerk keys are required in production.** Set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` (or `VITE_CLERK_PUBLISHABLE_KEY`). See `.env.example` for session-token metadata and admin role setup.
- **Clerk middleware returns 500 on all routes with placeholder keys.** With `pk_test_placeholder` / `sk_test_placeholder`, the Clerk middleware throws on every request. The server still starts and listens correctly — auth-dependent endpoints just fail. This is expected in local dev without real Clerk keys.
- **Build Armory before Codex.** Codex reads Armory's `armory.db` directly via `ARMORY_DB_PATH`. Armory auto-creates and populates its DB on first start, so run/start Armory at least once before Codex.
- **Tests:** `pnpm run validate` (or `pnpm run test:coverage` for coverage). On Windows, Cursor agent shells prepend bundled Node 22 — `.cursor/hooks/prepend-system-node.ps1` rewrites Shell commands to prefer `C:\Program Files\nodejs`. After changing Node versions, run `pnpm rebuild better-sqlite3`.

### Cloud VM-specific notes

- **PATH override:** The Cloud VM has `/exec-daemon/node` (Node 22) ahead of nvm in PATH. Prepend nvm's Node 26 path: `export PATH="/home/ubuntu/.nvm/versions/node/v26.4.0/bin:$PATH"`.

### UI consistency

Armory and Codex mirror the same design tokens and component patterns manually (no shared UI package). When changing layout, glass surfaces, buttons, modals, or dropdowns in one app, apply the same change in the other.

| Area                | Spec                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout max width    | `max-w-[2000px]` on header, main content wrapper, and footer                                                                                                       |
| Glass surfaces      | `glass-surface` (panels/cards), `glass-modal-surface` (dialogs), `glass-shell` (auth shells)                                                                       |
| Header nav          | `header-link` with `.active` modifier — 40px height, 1rem radius, accent tokens when active                                                                        |
| Buttons             | `btn btn-accent`, `btn btn-danger`, `btn btn-cancel` (modal dismiss), `btn btn-secondary` (neutral actions)                                                        |
| Modals              | Use `Modal` component; `className` includes `glass-modal-surface`; footers use `modal-actions`                                                                     |
| Dropdowns           | `SelectDropdown` with `triggerClassName` / `placement` props; user-menu triggers use `user-menu-select-trigger`                                                    |
| Stale client banner | Gold `stale-update-cta` button with `stale-update-cta__label` text "Refresh now!"                                                                                  |
| Suspense fallback   | `LazySuspenseFallback` component                                                                                                                                   |
| Toasts              | `.toast-pill` with optional `data-tone="success\|error\|warning"`                                                                                                  |
| Form focus          | `.form-input:focus` and `.form-group input:focus` — accent border + soft glow (`box-shadow` ring)                                                                  |
| Theme keys          | `--color-accent`, `--color-glass-border`, `--color-glass`, `--radius-ui`, `--shadow-panel`; UI style via `html.ui-prism` / `ui-shadow` / `ui-clear` / `ui-acrylic` |

## OpenWiki

This repository has documentation located in the /openwiki directory.

Start here:

- [OpenWiki quickstart](openwiki/quickstart.md)

OpenWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this repository, read the OpenWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.
