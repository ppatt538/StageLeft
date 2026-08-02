---
name: PostgreSQL migration
description: Why and how Daydesk moved from better-sqlite3 to Replit managed PostgreSQL
---

## Rule
All Daydesk persistent data lives in Replit's managed PostgreSQL (`DATABASE_URL`). Never introduce a local SQLite file for any production-bound data.

**Why:** Replit autoscale deployments run in ephemeral containers. Any data written to the local filesystem (including SQLite) is lost when the container is recycled or a new deploy fires.

**How to apply:**
- Drizzle ORM + pg driver via `@workspace/db` (`lib/db/src/`).
- All five Daydesk tables are defined in `lib/db/src/schema/daydesk.ts` and exported from `lib/db/src/schema/index.ts`.
- After any schema change run `pnpm --filter @workspace/db run push` (dev) or push via deployment pipeline for production.
- `api-server/src/lib/daydesk-db.ts` is the import hub: re-exports `db`, all table refs, and common Drizzle operators so routes only import from there.
- `api-server/src/lib/rollover.ts` and all routes are fully async (Drizzle returns Promises; no synchronous SQLite calls remain).
- `better-sqlite3` and `@types/better-sqlite3` have been removed from api-server's package.json.
- `artifacts/api-server/data/` is in `.gitignore` — the SQLite file must not be tracked or committed.

## Upload caveat
Media uploads (`/api/uploads/`) still land on the container's local filesystem (ephemeral). For persistent uploads the fix is Replit Object Storage — tracked as a separate task.
