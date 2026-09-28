# Armory

## Org standards

Shared Dark Avian Labs engineering conventions (README shape, CI/PR runners, validate, release tracks) live in AppBase [`docs/org-standards/`](../AppBase/docs/org-standards/). The design system (theme axes, glass contracts, UI primitives, Clerk appearance) lives in AppBase [`AGENTS.md`](../AppBase/AGENTS.md). There is no shared UI package: when you change layout, glass, buttons, modals, or dropdowns here, apply the same change in Codex.

## Overview

Armory is a Warframe mod builder. **Codex owns the Warframe DE/wiki catalog import** (`warframe:import` → `WARFRAME_CATALOG_DB_PATH`). Armory keeps a local copy at `ARMORY_DB_PATH` via catalog sync (`pnpm run catalog:sync` or Admin → Sync catalog from Codex). Clerk handles sign-in.

The React SPA is served only when `NODE_ENV=production`. In development the API runs alone (root URL 404s); use Vite for the client. Default listen port is **3002**. See `README.md` for scripts and env.

## Databases

Three SQLite files. Do not point any two at the same path, and do not reuse Codex or BudgetPlanner files.

| File    | Env               | Role                                                                 |
| ------- | ----------------- | -------------------------------------------------------------------- |
| Catalog | `ARMORY_DB_PATH`  | Local copy of Codex catalog tables + `armory_users` for public URLs. |
| User    | `USER_DB_PATH`    | Builds, loadouts, favorites. Absolute path required in production.   |
| Session | `SESSION_DB_PATH` | CSRF only, not Clerk login.                                          |

Codex source (read-only for Armory):

| Env                              | Default                             |
| -------------------------------- | ----------------------------------- |
| `CODEX_WARFRAME_CATALOG_DB_PATH` | `../Codex/data/warframe-catalog.db` |
| `CODEX_WARFRAME_IMAGES_DIR`      | `../Codex/data/warframe-images`     |

Boot creates/migrates schema. If `warframes` is empty and the Codex catalog path exists, boot syncs once (failures log and do **not** crash). Admin sync returns **202** with an on-page live log. Sync copies catalog tables only (not `import_runs` / `import_lease`) and mirrors images into `IMAGES_DIR` so existing `/images{image_path}` URLs keep working. `armory_users` is never overwritten.

## Catalog tables

Synced from Codex: `warframes`, `abilities`, `weapons`, `companions`, `mod_sets`, `mods`, `mod_level_stats`, `mod_set_members`, `arcanes`, `archon_shard_types`, `archon_shard_buffs`, `warframe_market_links`, `codex_modular_weapons`. Prefer the Admin artifact-slot editor for polarity fixes; those edits live in Armory's local catalog until the next full sync replaces the table.

## Builds and sharing

Saves use `/Armory/Helminth/...`, `/Armory/Ability/...`, and `/Armory/Archon/...` in `mod_config`. Older v1 Helminth fields still resolve; keep that working if you touch `buildReference.ts`. Generated Helminth registry files are script-produced; do not hand-edit them.

Planner damage/riven stats are computed on the client. Per-user caps are **250 builds** and **50 loadouts**.

Visibility: `private` (owner/admin), `public` (listed), `unlisted` (token in `?token=` / `?share_token=` only). Default create is `private`. Denied reads return **404**, not 403. A loadout cannot become `public`/`unlisted` while any linked build is still `private`. An unlisted loadout token can reveal the owner's linked `public`/`unlisted` builds without each build's own token. Public discovery lists `public` only.

## Auth

Clerk keys are required in production (`apps.armory === 'admin'` for admin). Empty keys are fine outside production: `isClerkConfigured()` skips Clerk and treats every request as signed out (Vitest and Playwright rely on this). Placeholder keys (`pk_test_placeholder` / `sk_test_placeholder`) are fatal at boot. Leave both keys empty instead of faking values. Missing `SESSION_SECRET` outside production needs `ALLOW_INSECURE_DEV=1` and a loopback `HOST`. Production `SECURE_COOKIES` requires `TRUST_PROXY`. CSRF tokens rotate when the Clerk user id on the express session changes (`server/session/bindClerkUserSession.ts`).

Cursor agents sign in with Clerk Agent Tasks. Do not type a password. Decrypt `.env.development` and read `E2E_CLERK_USER_EMAIL` or `E2E_CLERK_USER_ID`. POST `https://api.clerk.com/v1/agents/tasks` using `CLERK_SECRET_KEY`. Send `agent_name`, `task_description`, `permissions` `*`, `redirect_url` `http://localhost:5173/`, and `on_behalf_of` with `user_id` or `identifier`. Open the URL Clerk returns. The same development user works for AppBase, Codex, Armory, BudgetPlanner, and Outfitter. Local cookies are host-only, so each app origin needs its own task. Do not invent local fake keys.

## Toolchain

Node **26+**, pnpm **12.x**, exact `packageManager` (Corepack rejects dist-tags). Encrypted `.env.development` / `.env.production` need `DOTENV_PRIVATE_KEY_*` or `.env.keys`. `pnpm run dev:client` decrypts `.env.development` with dotenvx (`--strict`) before Vite. `pnpm run validate` is the quality gate.

On Windows, Cursor agent shells may prepend bundled Node 22. After changing Node versions, run `pnpm rebuild better-sqlite3`.

## Tests

`pnpm run validate` is the quality gate: preflight, oxfmt, oxlint, typecheck, Vitest. In CI that Vitest step is instrumented (`pnpm run test:coverage`); locally `pnpm test` stays uninstrumented. Use `pnpm run test:watch` while iterating.

HTTP tests that need the real stack (health, CSRF, Helmet, `/api/version`) go through `createApp()` in `server/app.ts`. `server/index.ts` migrates schema, optionally boot-syncs an empty catalog from Codex, then listens. Route tests may mount `apiRouter` with mocked Clerk, but user tables must come from `applyUserSchema` / `server/testing/memoryUserDb.ts` — do not hand-roll `CREATE TABLE builds`.

Vitest runs two projects: Node for `*.test.ts`, happy-dom for `client/**/*.test.tsx`. Coverage includes `server/`, `client/utils/`, `shared/`, and `scripts/`.

Playwright (`pnpm run test:e2e`) is **not** inside validate. It boots the compiled server (`dist/server/index.js`) on port 3102 with throwaway sqlite files and hits Chromium smokes (probes, CSRF, API 404, SPA-not-served in non-production). Run `pnpm run build` first, and `pnpm run test:e2e:install` once per machine. The runner and browser downloads are Apache-2.0 / free; no cloud grid.
