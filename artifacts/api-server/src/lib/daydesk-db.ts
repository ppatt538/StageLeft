/**
 * Daydesk SQLite database — bootstrap, schema, and helpers.
 * Uses better-sqlite3 (synchronous API, Replit-friendly).
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { logger } from "./logger";

const dbPath = process.env.DATABASE_PATH ?? "./data/daydesk.db";
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL for better concurrency
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema bootstrap ────────────────────────────────────────────────────────

db.exec(`
CREATE TABLE IF NOT EXISTS objects (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  bucket          TEXT NOT NULL DEFAULT 'today',
  status          TEXT NOT NULL DEFAULT 'active',
  priority        INTEGER NOT NULL DEFAULT 0,
  tags            TEXT NOT NULL DEFAULT '[]',
  layout          TEXT,
  payload         TEXT NOT NULL DEFAULT '{}',
  source          TEXT NOT NULL DEFAULT '{"kind":"seed"}',
  search_text     TEXT NOT NULL DEFAULT '',
  ai              TEXT,
  links           TEXT NOT NULL DEFAULT '[]',
  snooze_until    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  last_touched_at TEXT NOT NULL,
  completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_objects_bucket ON objects(bucket);
CREATE INDEX IF NOT EXISTS idx_objects_status ON objects(status);
CREATE INDEX IF NOT EXISTS idx_objects_updated_at ON objects(updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  meta       TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id         TEXT PRIMARY KEY,
  filename   TEXT NOT NULL,
  mime       TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rollover_state (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  last_date    TEXT NOT NULL
);
`);

// ─── Types ───────────────────────────────────────────────────────────────────

export type ObjectRow = {
  id: string;
  type: string;
  title: string;
  bucket: string;
  status: string;
  priority: number;
  tags: string;
  layout: string | null;
  payload: string;
  source: string;
  search_text: string;
  ai: string | null;
  links: string;
  snooze_until: string | null;
  created_at: string;
  updated_at: string;
  last_touched_at: string;
  completed_at: string | null;
};

export type DaydeskObject = {
  id: string;
  type: string;
  title: string;
  bucket: string;
  status: string;
  priority: number;
  tags: unknown[];
  layout: unknown | null;
  payload: Record<string, unknown>;
  source: Record<string, unknown>;
  search_text: string;
  ai: unknown | null;
  links: unknown[];
  snooze_until: string | null;
  created_at: string;
  updated_at: string;
  last_touched_at: string;
  completed_at: string | null;
};

// ─── Row → Object (parse JSON columns) ───────────────────────────────────────

export function rowToObject(row: ObjectRow): DaydeskObject {
  return {
    ...row,
    tags: JSON.parse(row.tags),
    layout: row.layout ? JSON.parse(row.layout) : null,
    payload: JSON.parse(row.payload),
    source: JSON.parse(row.source),
    ai: row.ai ? JSON.parse(row.ai) : null,
    links: JSON.parse(row.links),
  };
}

// ─── search_text builder ─────────────────────────────────────────────────────

export function buildSearchText(
  title: string,
  payload: Record<string, unknown>,
): string {
  const parts: string[] = [title];
  const p = payload as Record<string, unknown>;

  if (typeof p.markdown === "string") parts.push(p.markdown);
  if (typeof p.url === "string") parts.push(p.url);
  if (typeof p.summary === "string") parts.push(p.summary);
  if (typeof p.ocrText === "string") parts.push(p.ocrText);
  if (typeof p.location === "string") parts.push(p.location);
  if (Array.isArray(p.items)) {
    for (const item of p.items as { text?: string }[]) {
      if (typeof item.text === "string") parts.push(item.text);
    }
  }

  return parts.join(" ").toLowerCase();
}

// ─── Seed data ───────────────────────────────────────────────────────────────

const SEED_CHECKED = db
  .prepare("SELECT COUNT(*) as count FROM objects")
  .get() as { count: number };

if (SEED_CHECKED.count === 0) {
  logger.info("Seeding database with initial data");

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO objects (id,type,title,bucket,status,priority,tags,payload,source,search_text,links,created_at,updated_at,last_touched_at)
    VALUES (@id,@type,@title,@bucket,@status,@priority,@tags,@payload,@source,@search_text,@links,@created_at,@updated_at,@last_touched_at)
  `);

  const seeds: Omit<ObjectRow, "layout" | "ai" | "snooze_until" | "completed_at">[] = [
    {
      id: nanoid(),
      type: "checklist",
      title: "Today's tasks",
      bucket: "today",
      status: "active",
      priority: 0,
      tags: JSON.stringify(["work"]),
      payload: JSON.stringify({
        items: [
          { id: "i1", text: "Review design mockups", done: false },
          { id: "i2", text: "Reply to Alex re: proposal", done: true },
          { id: "i3", text: "Book team lunch", done: false },
        ],
      }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "today's tasks review design mockups reply to alex re: proposal book team lunch",
      links: JSON.stringify([]),
      created_at: now,
      updated_at: now,
      last_touched_at: now,
    },
    {
      id: nanoid(),
      type: "note",
      title: "Product thoughts",
      bucket: "today",
      status: "active",
      priority: 1,
      tags: JSON.stringify([]),
      payload: JSON.stringify({
        markdown:
          "The onboarding flow needs a quick win in the first 30 seconds. Users who don't create their first card within 2 minutes rarely return. Consider a guided first-message prompt.",
      }),
      source: JSON.stringify({ kind: "seed" }),
      search_text:
        "product thoughts the onboarding flow needs a quick win in the first 30 seconds",
      links: JSON.stringify([]),
      created_at: now,
      updated_at: now,
      last_touched_at: now,
    },
    {
      id: nanoid(),
      type: "reminder",
      title: "Call dentist",
      bucket: "today",
      status: "active",
      priority: 0,
      tags: JSON.stringify([]),
      payload: JSON.stringify({
        when: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        location: "Dr. Park — 555-0123",
      }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "call dentist dr. park 555-0123",
      links: JSON.stringify([]),
      created_at: now,
      updated_at: now,
      last_touched_at: now,
    },
    {
      id: nanoid(),
      type: "link",
      title: "Linear — Sprint 14",
      bucket: "today",
      status: "active",
      priority: 0,
      tags: JSON.stringify([]),
      payload: JSON.stringify({
        url: "https://linear.app",
        title: "Linear Sprint 14",
        summary: "8 open issues, 3 in review",
      }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "linear sprint 14 8 open issues 3 in review https://linear.app",
      links: JSON.stringify([]),
      created_at: now,
      updated_at: now,
      last_touched_at: now,
    },
    {
      id: nanoid(),
      type: "media",
      title: "Conference poster",
      bucket: "today",
      status: "active",
      priority: 0,
      tags: JSON.stringify([]),
      payload: JSON.stringify({
        imageUrl: null,
        ocrText: "Design Summit 2026 — Aug 12–14, San Francisco",
      }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "conference poster design summit 2026 aug 12-14 san francisco",
      links: JSON.stringify([]),
      created_at: now,
      updated_at: now,
      last_touched_at: now,
    },
    {
      id: nanoid(),
      type: "checklist",
      title: "Week goals",
      bucket: "week",
      status: "active",
      priority: 0,
      tags: JSON.stringify(["planning"]),
      payload: JSON.stringify({
        items: [
          { id: "w1", text: "Ship Phase 1 of Daydesk", done: true },
          { id: "w2", text: "Prep Q3 review deck", done: false },
          { id: "w3", text: "Interview two candidates", done: false },
        ],
      }),
      source: JSON.stringify({ kind: "seed" }),
      search_text: "week goals ship phase 1 of daydesk prep q3 review deck interview two candidates",
      links: JSON.stringify([]),
      created_at: now,
      updated_at: now,
      last_touched_at: now,
    },
  ];

  const insertMany = db.transaction(
    (items: typeof seeds) => {
      for (const seed of items) insert.run(seed);
    },
  );
  insertMany(seeds);
}
