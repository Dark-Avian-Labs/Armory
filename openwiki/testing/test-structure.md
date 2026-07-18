---
type: Testing Guide
title: Test Structure
description: Vitest layout, runtime preflight, and the validate quality gate for Armory.
tags: [testing, vitest, validate]
timestamp: 2026-07-18T20:40:00Z
---

# Test Structure

Armory uses Vitest across server, client, shared, scripts, and `tests/`. The agent-facing gate is `pnpm run validate`, which also powers [deployment](../operations/deployment.md) CI checks.

## Where to start

| Concern      | Path                                                            |
| ------------ | --------------------------------------------------------------- |
| Quality gate | `run-quality-checks.mjs` → `pnpm run validate`                  |
| Preflight    | `scripts/runtime-preflight.mjs` (Node 26+, better-sqlite3 load) |
| Config       | `vitest.config.ts`                                              |
| Helpers      | `tests/helpers/` (e.g. Express test helpers)                    |
| Coverage     | `pnpm run test:coverage` + `scripts/patchCoverageLayout.mjs`    |

## What runs

`validate` typically: runtime preflight → format check → lint → typecheck → tests.

Suites live beside code (`*.test.ts`) and under `tests/`. Many API tests use in-memory SQLite + HTTP assertions against the Express app.

## What to watch out for

- On Windows agent shells, bundled Node 22 may appear first — prefer system Node 26; rebuild native bindings if tests fail to load `better-sqlite3`.
- Do not skip preflight failures; they catch environment mismatches early.
- Auth tests often mock Clerk session claims rather than calling live Clerk.

## Related

- [Quickstart](../quickstart.md)
- [Deployment](../operations/deployment.md)
- [Clerk auth](../integrations/clerk-auth.md)
