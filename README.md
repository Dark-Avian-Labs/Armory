# Parametric

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node-%3E%3D25-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)

Parametric is a Warframe mod builder and build planner. It pulls game data from official exports, lets users build and compare loadouts, and delegates authentication/permissions to the shared Auth service.

## Requirements

- Node.js 25+
- npm

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env file:

   ```bash
   cp .env.example .env
   ```

3. Build and run:

   ```bash
   npm run build
   npm start
   ```

## dotenvx and encrypted env files

This project supports `dotenvx` for local `.env` loading now, and can optionally use encrypted env artifacts later.

- Keep local plaintext env in `.env` (gitignored).
- Never commit `.env.keys` (gitignored).
- You may commit `.env.vault` when you choose to adopt encrypted env files.
- Keep deployment SSH secrets in GitHub Secrets as-is (`SSH_PRIVATE_KEY`, `SERVER_*`).

Suggested secret naming when vault is enabled:

- `DOTENV_PRIVATE_KEY_DEVELOPMENT`
- `DOTENV_PRIVATE_KEY_PRODUCTION`

Use one key per environment to reduce blast radius.

### First-time dotenvx setup

If you have never used dotenvx before, use this flow:

1. Create a local env file from the example:

   ```bash
   cp .env.example .env
   ```

   PowerShell equivalent:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Encrypt your local `.env` into `.env.vault`:

   ```bash
   npx dotenvx encrypt -f .env
   ```

   This creates/updates:
   - `.env.vault` (safe to commit)
   - `.env.keys` (secret, never commit)

3. Add dotenv keys to GitHub Secrets (when you enable vault in CI/deploy):
   - `DOTENV_KEY_DEV`
   - `DOTENV_KEY_PROD`

4. Keep using normal app scripts locally (`npm start`, `npm run validate`).
   The server already loads local `.env` automatically via dotenvx.

## Environment

| Variable           | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `PORT`, `HOST`     | Server bind address (defaults: `3001`, `127.0.0.1`). |
| `SESSION_SECRET`   | Required in production; 32+ characters.              |
| `TRUST_PROXY`      | Set to `1` behind reverse proxy.                     |
| `SECURE_COOKIES`   | Set to `1` for HTTPS cookie behavior.                |
| `AUTH_SERVICE_URL` | Shared Auth base URL.                                |
| `CENTRAL_DB_PATH`  | Shared central DB path for users/sessions/access.    |
| `COOKIE_DOMAIN`    | Optional cross-subdomain cookie domain.              |

## Scripts

| Script               | Description                         |
| -------------------- | ----------------------------------- |
| `npm run dev:client` | Run Vite client dev server.         |
| `npm run build`      | Build server + client assets.       |
| `npm start`          | Run production server from `dist/`. |
| `npm run lint`       | Run ESLint.                         |
| `npm run format`     | Run Prettier formatting.            |
| `npm test`           | Run Vitest test suite.              |

## License

GPL-3.0-or-later
