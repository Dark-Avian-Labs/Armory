# Armory

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white)](https://cursor.com)
![Node](https://img.shields.io/badge/Node-%3E%3D25-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)

Armory is a mod builder and planner for Warframe. It mirrors in-game feel where practical and surfaces extra detail and stats.
Mod and equipment data come from Digital Extremes’ public export, with wiki and third-party sources used where helpful.
Armory also backs Codex’s Warframe import workflow and uses the central Auth service for login, per-game access, and profile settings.

## Requirements

- Node.js 25+
- pnpm 11+

## Setup

1. Install Node.js and pnpm using your preferred method for your OS.

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy and edit the environment file:

   ```bash
   cp .env.example .env
   nano .env
   ```

4. Build and run:

   ```bash
   pnpm run build
   pnpm start
   ```

## dotenvx and encrypted env files

This project supports `dotenvx` for local `.env` loading and can optionally use encrypted env artifacts.

- Use `pnpm dlx dotenvx encrypt` to encrypt your local `.env` file when you want it safe to commit.
- That flow also creates a `.env.keys` file with your private encryption key, which must **never** be committed.
- To change variables, use `pnpm dlx dotenvx decrypt` with the key in `.env.keys` to restore a plain `.env`.
- Re-encrypt afterward (keys are reused) and commit only the encrypted artifacts.
- Store private keys in your secrets manager the same way you would an SSH deploy key.

Suggested secret naming when vault is enabled:

- `DOTENV_PRIVATE_KEY_DEVELOPMENT`
- `DOTENV_PRIVATE_KEY_PRODUCTION`

Use one key per environment to reduce blast radius.

## Environment variables

| Variable                   | Description                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `PORT`, `HOST`             | Server bind address (defaults: `3002`, `127.0.0.1`).                           |
| `NODE_ENV`                 | `development`, `test`, or `production`.                                        |
| `APP_PUBLIC_BASE_URL`      | **Required.** Public site base URL (used for auth redirects); `https` in prod. |
| `SESSION_SECRET`           | Required in production; dev uses a non-prod default if unset.                  |
| `TRUST_PROXY`              | Set to `1` behind a reverse proxy.                                             |
| `SECURE_COOKIES`           | Set to `1` for HTTPS-only cookie behavior (defaults follow `NODE_ENV`).        |
| `AUTH_SERVICE_URL`         | Shared Auth base URL (`https://…` required in production).                     |
| `AUTH_FETCH_TIMEOUT_MS`    | Optional timeout (ms) for Auth API calls (default: `5000`).                    |
| `CENTRAL_DB_PATH`          | Shared central DB for users/sessions/access (default under `./data/`).         |
| `ARMORY_DB_PATH`           | Optional override for the main app SQLite file (default `./data/armory.db`).   |
| `CODEX_EXPORT_DB_PATH`     | Optional override for the Codex export mirror DB (default `./data/codex.db`).  |
| `COOKIE_DOMAIN`            | Optional cross-subdomain cookie domain.                                        |
| `SESSION_COOKIE_NAME`      | Session cookie name.                                                           |
| `HELMINTH_WIKI_USER_AGENT` | Optional `User-Agent` for Helminth wiki fetches (see `helminthWiki.ts`).       |

Client `VITE_*` variables are listed in `.env.example`.

## Scripts

| Script                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `pnpm run build`        | Compile server TypeScript and Vite client build. |
| `pnpm start`            | Run production server from `dist/`.              |
| `pnpm run typecheck`    | Typecheck server and client.                     |
| `pnpm run data:import`  | Run manual data import pipeline (built server).  |
| `pnpm run lint`         | Run Oxlint.                                      |
| `pnpm run lint:fix`     | Run Oxlint with `--fix`.                         |
| `pnpm run format`       | Run Oxfmt.                                       |
| `pnpm run check-format` | Verify Oxfmt formatting.                         |
| `pnpm run validate`     | Format check, lint, typecheck, and tests.        |
| `pnpm run test`         | Run Vitest once.                                 |

## License

GPL-3.0-or-later
