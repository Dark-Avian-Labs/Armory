<p align="center">
  <img src="https://raw.githubusercontent.com/Dark-Avian-Labs/.github/refs/heads/main/banner.png" alt="Dark Avian Labs">
</p>

# Armory

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/Armory/ci.yml?style=flat-square&label=CI)](https://github.com/Dark-Avian-Labs/Armory/actions/workflows/ci.yml)
[![PR](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/Armory/pr.yml?style=flat-square&label=PR)](https://github.com/Dark-Avian-Labs/Armory/actions/workflows/pr.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

Warframe mod builder and planner. Catalog comes from Digital Extremes' public export, with wiki and other sources filling gaps. Helminth, Archon shards, Incarnon, named builds and loadouts. Codex reads this catalog for Warframe collection tracking. Sign-in uses [Clerk](https://clerk.com).

Live: [armory.darkavianlabs.com](https://armory.darkavianlabs.com)

Default API port is **3002**. In development the API runs alone (root URL 404s); use Vite for the client.

## Gotchas

- Three SQLite files — catalog (`ARMORY_DB_PATH`), user (`USER_DB_PATH`), session (`SESSION_DB_PATH`). Do not point any two at the same path, and do not reuse Codex or BudgetPlanner files. `USER_DB_PATH` must be absolute in production.
- Boot creates schema. It does **not** fill the catalog. An empty database after first start is normal until `pnpm run data:import` or Admin Force Full Re-import. Codex needs a populated catalog before Warframe sync works.
- Wiki fetches need `WIKI_USER_AGENT`. Encrypted env files need `.env.keys` or `DOTENV_PRIVATE_KEY_*`. Never encrypt `VITE_*`.
- Empty Clerk keys skip auth. Placeholder keys are fatal. Production needs `APP_PUBLIC_BASE_URL` and, with `SECURE_COOKIES`, `TRUST_PROXY`.
- After changing Node versions on Windows, `pnpm rebuild better-sqlite3`.

## License

MIT
