# Parametric

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/Node-%3E%3D25-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)

Parametric is a mod builder and planner for the game Warframe. It tries to mimic the in-game aesthetic and feel but provides further details and stats.
Mods and Warframe/Weapon stats are pulled from the official Public API export and is enhanced with data from the Warframe Wiki as well as from Overframe where needed.
The app also serves as a database for Corpus' Warframe module import workflow and uses the central Auth service for login, per-game access control, and profile settings.

## Requirements

- Node.js 25+
- pnpm 10+

## Setup

1. Install Node and pnpm:

`use whatever installation method you prefer for your system`

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy and edit env file:

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

This project supports `dotenvx` for local `.env` loading now, and can optionally use encrypted env artifacts.

- use `pnpm dlx dotenvx encrypt` to encrypt your local `.env` file and make it safe to commit
- this will also create a `.env.keys` file with your private encryption key, which should NEVER be committed.
- if you need to change env variables, use `pnpm dlx dotenvx decrypt` to use the key in `.env.keys` to restore the `.env` file
- re-encrypt afterwards (it will reuse the same keys) and commit the changes
- keep the private key in GitHub secrets like you would your SSH_KEY

Suggested secret naming when vault is enabled:

- `DOTENV_PRIVATE_KEY_DEVELOPMENT`
- `DOTENV_PRIVATE_KEY_PRODUCTION`

Use one key per environment to reduce blast radius.

## Environment

| Variable           | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `PORT`, `HOST`     | Server bind address (defaults: `3002`, `127.0.0.1`). |
| `SESSION_SECRET`   | Required in production; 32+ characters.              |
| `TRUST_PROXY`      | Set to `1` behind reverse proxy.                     |
| `SECURE_COOKIES`   | Set to `1` for HTTPS cookie behavior.                |
| `AUTH_SERVICE_URL` | Shared Auth base URL.                                |
| `CENTRAL_DB_PATH`  | Shared central DB path for users/sessions/access.    |
| `COOKIE_DOMAIN`    | Optional cross-subdomain cookie domain.              |

## Scripts

| Script              | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm run build`    | Compile TypeScript to `dist/`.        |
| `pnpm start`        | Run production server from `dist/`.   |
| `pnpm run lint`     | Run OxLint.                           |
| `pnpm run format`   | Run Oxfmt formatting.                 |
| `pnpm run validate` | Check format, lint, typesafety, tests |

## License

GPL-3.0-or-later
