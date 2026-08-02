/**
 * Daydesk tables — stored in Replit's managed PostgreSQL so data survives
 * across autoscale deployments. All JSON columns kept as `text` to match the
 * existing serialisation layer.
 */
import { pgTable, text, integer, index } from "drizzle-orm/pg-core";

// ─── Objects ──────────────────────────────────────────────────────────────────

export const daydeskObjects = pgTable(
  "daydesk_objects",
  {
    id:              text("id").primaryKey(),
    type:            text("type").notNull(),
    title:           text("title").notNull(),
    bucket:          text("bucket").notNull().default("today"),
    status:          text("status").notNull().default("active"),
    priority:        integer("priority").notNull().default(0),
    tags:            text("tags").notNull().default("[]"),
    layout:          text("layout"),
    payload:         text("payload").notNull().default("{}"),
    source:          text("source").notNull().default('{"kind":"seed"}'),
    search_text:     text("search_text").notNull().default(""),
    ai:              text("ai"),
    links:           text("links").notNull().default("[]"),
    snooze_until:    text("snooze_until"),
    created_at:      text("created_at").notNull(),
    updated_at:      text("updated_at").notNull(),
    last_touched_at: text("last_touched_at").notNull(),
    completed_at:    text("completed_at"),
  },
  (t) => [
    index("idx_daydesk_objects_bucket").on(t.bucket),
    index("idx_daydesk_objects_status").on(t.status),
    index("idx_daydesk_objects_updated_at").on(t.updated_at),
  ],
);

// ─── Messages ─────────────────────────────────────────────────────────────────

export const daydeskMessages = pgTable("daydesk_messages", {
  id:         text("id").primaryKey(),
  role:       text("role").notNull(),
  content:    text("content").notNull(),
  created_at: text("created_at").notNull(),
  meta:       text("meta"),
});

// ─── Media uploads ────────────────────────────────────────────────────────────

export const daydeskMedia = pgTable("daydesk_media", {
  id:         text("id").primaryKey(),
  filename:   text("filename").notNull(),
  mime:       text("mime").notNull(),
  url:        text("url").notNull(),
  created_at: text("created_at").notNull(),
});

// ─── Rollover state (single-row sentinel) ─────────────────────────────────────

export const daydeskRolloverState = pgTable("daydesk_rollover_state", {
  id:        integer("id").primaryKey(),   // always 1
  last_date: text("last_date").notNull(),
});

// ─── Undo log ─────────────────────────────────────────────────────────────────

export const daydeskUndoLog = pgTable(
  "daydesk_undo_log",
  {
    id:         text("id").primaryKey(),
    message_id: text("message_id").notNull(),
    object_id:  text("object_id").notNull(),
    action:     text("action").notNull(),   // create | update | delete | move
    before_row: text("before_row"),
    created_at: text("created_at").notNull(), // used for DESC ordering (replaces SQLite rowid)
  },
  (t) => [
    index("idx_daydesk_undo_log_message_id").on(t.message_id),
  ],
);
