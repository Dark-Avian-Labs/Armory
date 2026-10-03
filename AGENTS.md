# Armory

Shell, auth, env, and validate are in AppBase `AGENTS.md`. Port 3002. Playwright 3102. Signed-in Playwright 4102.

Warframe mod builder. Codex owns the DE and wiki import. Armory copies that catalog into `ARMORY_DB_PATH` with `pnpm run catalog:sync` or Admin. In development the API does not serve the SPA. Test and production serve `dist/client` when `index.html` exists, and return 503 when it does not.

Three SQLite files, and they must be different paths. `ARMORY_DB_PATH` is the catalog plus `armory_users`. `USER_DB_PATH` is builds, and it must be absolute in production. `SESSION_DB_PATH` is CSRF only. Codex is read-only here: `CODEX_WARFRAME_CATALOG_DB_PATH` and `CODEX_WARFRAME_IMAGES_DIR`.

Boot syncs once when `warframes` is empty and the Codex catalog exists. Failures log and the process stays up. Admin sync returns 202. Sync does not copy `import_runs` or `import_lease`, and it does not overwrite `armory_users`. Atragraph path preserve hooks are no-ops. The next sync replaces the mod rows.

Polarity edits in the artifact-slot editor last until the next full sync replaces that table. Helminth registry files are generated. Older v1 Helminth fields in `buildReference.ts` still resolve.

Caps are 250 builds and 50 loadouts per user. A denied read is 404. A loadout cannot become `public` or `unlisted` while a linked build is `private`. An unlisted loadout token can reveal that owner's linked public and unlisted builds.

Outside production, a missing `SESSION_SECRET` needs `ALLOW_INSECURE_DEV=1` and a loopback `HOST`.

Vitest includes happy-dom for `client/**/*.test.tsx`. User tables in route tests come from `applyUserSchema` or `server/testing/memoryUserDb.ts`.
