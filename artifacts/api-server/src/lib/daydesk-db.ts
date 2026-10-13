/**
 * StageLeft database layer — PostgreSQL via Drizzle ORM.
 *
 * Why PostgreSQL instead of the previous better-sqlite3:
 * Replit autoscale deployments run in ephemeral containers whose local
 * filesystem is wiped on every deploy.  SQLite data written in production was
 * lost on each new release.  Replit's managed PostgreSQL persists independently
 * of any container lifecycle.
 */

import { db } from "@workspace/db";
import {
  daydeskObjects,
  daydeskMessages,
  daydeskMedia,
  daydeskRolloverState,
  daydeskUndoLog,
} from "@workspace/db";
import { nanoid } from "nanoid";
import { logger } from "./logger";
import { eq, sql } from "drizzle-orm";

// ─── Re-exports consumed by routes ───────────────────────────────────────────

export {
  db,
  daydeskObjects,
  daydeskMessages,
  daydeskMedia,
  daydeskRolloverState,
  daydeskUndoLog,
};

export {
  eq, ne, and, or, ilike, desc, asc, lt, gt, inArray, sql,
} from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ObjectRow = typeof daydeskObjects.$inferSelect;

export type DaydeskObject = {
  id: string;
  type: string;
  title: string;
  bucket: string;
  status: string;
  priority: number;
  sort_order: number;
  tags: unknown[];
  layout: unknown | null;
  payload: Record<string, unknown>;
  source: Record<string, unknown>;
  search_text: string;
  ai: unknown | null;
  links: unknown[];
  notes: string | null;
  snooze_until: string | null;
  created_at: string;
  updated_at: string;
  last_touched_at: string;
  completed_at: string | null;
};

// ─── Row → Object (parse JSON text columns) ───────────────────────────────────

export function rowToObject(row: ObjectRow): DaydeskObject {
  // Normalize legacy rows that have bucket='pinned' (old data model).
  // Pin is now represented by priority=1 within today/week/archive.
  const bucket = row.bucket === "pinned" ? "today" : row.bucket;
  const priority = row.bucket === "pinned" ? Math.max(row.priority, 1) : row.priority;

  return {
    ...row,
    bucket,
    priority,
    tags:    JSON.parse(row.tags),
    layout:  row.layout  ? JSON.parse(row.layout)  : null,
    payload: JSON.parse(row.payload),
    source:  JSON.parse(row.source),
    ai:      row.ai      ? JSON.parse(row.ai)      : null,
    links:   JSON.parse(row.links),
  };
}

// ─── search_text builder ──────────────────────────────────────────────────────

export function buildSearchText(
  title: string,
  payload: Record<string, unknown>,
  notes?: string | null,
): string {
  const parts: string[] = [title];

  if (typeof payload.markdown  === "string") parts.push(payload.markdown);
  if (typeof payload.url       === "string") parts.push(payload.url);
  if (typeof payload.summary   === "string") parts.push(payload.summary);
  if (typeof payload.ocrText   === "string") parts.push(payload.ocrText);
  if (typeof payload.location  === "string") parts.push(payload.location);
  if (Array.isArray(payload.items)) {
    for (const item of payload.items as { text?: string }[]) {
      if (typeof item.text === "string") parts.push(item.text);
    }
  }
  if (typeof notes === "string" && notes) parts.push(notes);

  return parts.join(" ").toLowerCase();
}

// ─── One-time data migrations ─────────────────────────────────────────────────

/**
 * Runs idempotent schema/data migrations at startup.
 * Safe to call on every boot — each migration is a no-op when already applied.
 */
export async function ensureMigrations(): Promise<void> {
  // Migration: add `notes` column if it doesn't exist yet (for databases
  // that were created before this column was introduced).
  await db.execute(
    sql`ALTER TABLE daydesk_objects ADD COLUMN IF NOT EXISTS notes TEXT`,
  );

  // Migration: establish a stable, user-controlled order within each bucket.
  // Existing rows keep the order users already saw: pinned first, then most
  // recently updated. Only rows without an assigned order are backfilled.
  await db.execute(
    sql`ALTER TABLE daydesk_objects ADD COLUMN IF NOT EXISTS sort_order INTEGER`,
  );
  await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY bucket
          ORDER BY priority DESC, updated_at DESC, id
        ) - 1 AS position
      FROM daydesk_objects
      WHERE sort_order IS NULL
    )
    UPDATE daydesk_objects AS objects
    SET sort_order = ranked.position
    FROM ranked
    WHERE objects.id = ranked.id
  `);
  await db.execute(
    sql`ALTER TABLE daydesk_objects ALTER COLUMN sort_order SET DEFAULT 0`,
  );
  await db.execute(
    sql`ALTER TABLE daydesk_objects ALTER COLUMN sort_order SET NOT NULL`,
  );

  // Migration: legacy bucket='pinned' → bucket='today' with priority=1.
  // Pin is now represented by priority=1 within today/week/archive.
  const now = new Date().toISOString();
  const result = await db
    .update(daydeskObjects)
    .set({ bucket: "today", priority: 1, updated_at: now })
    .where(eq(daydeskObjects.bucket, "pinned"));
  if ((result as unknown as { rowCount?: number }).rowCount) {
    logger.info(
      { rows: (result as unknown as { rowCount: number }).rowCount },
      "Migration: converted legacy pinned-bucket rows to today+priority=1",
    );
  }
}

// ─── Seed data (runs once on first boot against an empty DB) ─────────────────

export async function ensureSeeded(): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(daydeskObjects);

  if (Number(count) > 0) return;

  logger.info("Seeding database with initial data");

  const now = new Date().toISOString();

  const seeds: Omit<ObjectRow, "layout" | "ai" | "snooze_until" | "completed_at" | "notes" | "sort_order">[] = [
    {
      id: nanoid(), type: "checklist", title: "Today's tasks",
      bucket: "today", status: "active", priority: 0,
      tags: JSON.stringify(["work"]),
      payload: JSON.stringify({ items: [
        { id: "i1", text: "Review design mockups",       done: false },
        { id: "i2", text: "Reply to Alex re: proposal",  done: true  },
        { id: "i3", text: "Book team lunch",             done: false },
      ]}),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "today's tasks review design mockups reply to alex re: proposal book team lunch",
      links: JSON.stringify([]),
      created_at: now, updated_at: now, last_touched_at: now,
    },
    {
      id: nanoid(), type: "note", title: "Product thoughts",
      bucket: "today", status: "active", priority: 1,
      tags: JSON.stringify([]),
      payload: JSON.stringify({ markdown:
        "The onboarding flow needs a quick win in the first 30 seconds. Users who don't create their first card within 2 minutes rarely return. Consider a guided first-message prompt." }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "product thoughts the onboarding flow needs a quick win in the first 30 seconds",
      links: JSON.stringify([]),
      created_at: now, updated_at: now, last_touched_at: now,
    },
    {
      id: nanoid(), type: "reminder", title: "Call dentist",
      bucket: "today", status: "active", priority: 0,
      tags: JSON.stringify([]),
      payload: JSON.stringify({ when: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), location: "Dr. Park — 555-0123" }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "call dentist dr. park 555-0123",
      links: JSON.stringify([]),
      created_at: now, updated_at: now, last_touched_at: now,
    },
    {
      id: nanoid(), type: "link", title: "Linear — Sprint 14",
      bucket: "today", status: "active", priority: 0,
      tags: JSON.stringify([]),
      payload: JSON.stringify({ url: "https://linear.app", title: "Linear Sprint 14", summary: "8 open issues, 3 in review" }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "linear sprint 14 8 open issues 3 in review https://linear.app",
      links: JSON.stringify([]),
      created_at: now, updated_at: now, last_touched_at: now,
    },
    {
      id: nanoid(), type: "media", title: "Conference poster",
      bucket: "today", status: "active", priority: 0,
      tags: JSON.stringify([]),
      payload: JSON.stringify({ imageUrl: null, ocrText: "Design Summit 2026 — Aug 12–14, San Francisco" }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "conference poster design summit 2026 aug 12-14 san francisco",
      links: JSON.stringify([]),
      created_at: now, updated_at: now, last_touched_at: now,
    },
    {
      id: nanoid(), type: "checklist", title: "Week goals",
      bucket: "week", status: "active", priority: 0,
      tags: JSON.stringify(["planning"]),
      payload: JSON.stringify({ items: [
        { id: "w1", text: "Ship Phase 1 of StageLeft",   done: true  },
        { id: "w2", text: "Prep Q3 review deck",        done: false },
        { id: "w3", text: "Interview two candidates",   done: false },
      ]}),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "week goals ship phase 1 of daydesk prep q3 review deck interview two candidates",
      links: JSON.stringify([]),
      created_at: now, updated_at: now, last_touched_at: now,
    },
  ];

  const nextOrderByBucket = new Map<string, number>();
  await db.insert(daydeskObjects).values(
    seeds.map((s) => {
      const sort_order = nextOrderByBucket.get(s.bucket) ?? 0;
      nextOrderByBucket.set(s.bucket, sort_order + 1);
      return {
        ...s,
        sort_order,
        layout: null,
        ai: null,
        snooze_until: null,
        completed_at: null,
        notes: null,
      };
    }),
  );
}
