# Armory

## Cursor Cloud specific instructions

### Overview

Armory is a Warframe mod builder/planner. It imports game data from DE's public exports and uses Clerk for authentication. Codex reads Armory's SQLite catalog directly for Warframe sync. It serves its web UI only in production mode; in development mode it is API-only.

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
- **Tests:** `pnpm run test` and `pnpm run test:coverage`. On Windows, Cursor agent shells prepend bundled Node 22 — `.cursor/hooks/prepend-system-node.ps1` rewrites Shell commands to prefer `C:\Program Files\nodejs`. After changing Node versions, run `pnpm rebuild better-sqlite3`.

### UI consistency

Armory and Codex mirror the same design tokens and component patterns manually (no shared UI package). When changing layout, glass surfaces, buttons, modals, or dropdowns in one app, apply the same change in the other.

| Area                | Spec                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout max width    | `max-w-[2000px]` on header, main content wrapper, and footer                                                                                |
| Glass surfaces      | `glass-surface` (panels/cards), `glass-modal-surface` (dialogs), `glass-shell` (auth shells)                                                |
| Header nav          | `header-link` with `.active` modifier — 40px height, 1rem radius, accent tokens when active                                                 |
| Buttons             | `btn btn-accent`, `btn btn-danger`, `btn btn-cancel` (modal dismiss), `btn btn-secondary` (neutral actions)                                 |
| Modals              | Use `Modal` component; `className` includes `glass-modal-surface`; footers use `modal-actions`                                              |
| Dropdowns           | `SelectDropdown` with `triggerClassName` / `placement` props; user-menu triggers use `user-menu-select-trigger`                             |
| Stale client banner | Gold `stale-update-cta` button with `stale-update-cta__label` text "Refresh now!"                                                           |
| Suspense fallback   | `LazySuspenseFallback` component                                                                                                            |
| Toasts              | `.toast-pill` with optional `data-tone="success\|error\|warning"`                                                                           |
| Form focus          | `.form-input:focus` and `.form-group input:focus` — accent border + soft glow (`box-shadow` ring)                                           |
| Theme keys          | `--color-accent`, `--color-glass-border`, `--color-glass`, `--radius-ui`, `--shadow-panel`; UI style via `html.ui-clear` / `html.ui-shadow` |
