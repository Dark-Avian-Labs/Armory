---
type: Workflow
title: Share and Visibility
description: Build and loadout visibility (private/public/unlisted), share tokens, and public discovery routes.
tags: [sharing, visibility, builds, loadouts]
timestamp: 2026-07-18T21:05:00Z
---

# Share and Visibility

Builds and loadouts in the [user database](../architecture/database.md) support three visibility modes plus unlisted share tokens. This gates read access on top of [Clerk auth](../integrations/clerk-auth.md) and is used by the [mod building](mod-building.md) save APIs.

## Where to start

| Concern            | Path                                                    |
| ------------------ | ------------------------------------------------------- |
| Visibility helpers | `server/visibilityTokens.ts`                            |
| Token generation   | `server/shareToken.ts`                                  |
| Access checks      | `server/loadoutAccess.ts`, `server/buildAccess.ts`      |
| Builds API         | `server/routes/buildsRouter.ts`                         |
| Loadouts API       | `server/routes/loadoutsRouter.ts`                       |
| Response shaping   | `server/routes/apiShared.ts`                            |
| Schema             | `server/db/userSchema.ts` (`visibility`, `share_token`) |

## Visibility model

| Value      | Read access                                           | Listed in public discovery |
| ---------- | ----------------------------------------------------- | -------------------------- |
| `private`  | Owner or Armory admin                                 | No                         |
| `public`   | Anyone                                                | Yes                        |
| `unlisted` | Owner, admin, or matching `?token=` / `?share_token=` | No                         |

- Tokens are `randomBytes(24).toString('base64url')`, generated when entering `unlisted`, cleared when leaving it.
- Denied reads return **404** (not 403) to avoid leaking existence.
- `share_token` is included in JSON only for owners/admins.
- A loadout cannot become `public`/`unlisted` while any linked build is still `private`.
- Unlisted loadout token can reveal the owner’s linked `public`/`unlisted` builds without each build’s token.

## Public discovery (examples)

- `GET /users/:username/builds`
- `GET /builds/catalog`
- `GET /builds/by-user?clerk_user_id=`
- `GET /builds/by-equipment?equipment_type=&equipment_unique_name=`

These list **`public` only**. Token-gated deep links use `GET /builds/:id` and `GET /loadouts/:id` via `buildReadAccessContext`.

## What to watch out for

- Default create visibility is `private` (`parseVisibility` fallback).
- Do not weaken `canReadSharedResource` or leak tokens in list responses.
- Prefer `buildReadAccessContext` for query token parsing (same keys as `readShareTokenFromQuery`).
- Public loadout listings require linked builds to also be public where that filter applies.

## Related

- [Mod building](mod-building.md)
- [Clerk auth](../integrations/clerk-auth.md)
- [Databases](../architecture/database.md)
