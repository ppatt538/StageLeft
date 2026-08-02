/**
 * Rollover logic: age objects between Today → Week → Archive.
 * Rules:
 * 1) pinned: never auto-move
 * 2) status=done → archive (if not pinned); set completed_at if missing
 * 3) incomplete today items with last_touched before today's local date → week
 * 4) incomplete week items older than 7 local days → archive
 * 5) reminders/events with when < start of today: stay visible (overdue badge in UI)
 */
import { db, daydeskObjects, daydeskRolloverState, eq, ne, and, sql } from "./daydesk-db";
import { logger } from "./logger";

function todayLocalDate(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function sevenDaysAgo(tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

export async function runRollover(): Promise<{ moved: number; details: string }> {
  const tz = process.env.USER_TZ ?? "America/New_York";
  const today    = todayLocalDate(tz);
  const sevenAgo = sevenDaysAgo(tz);
  const now      = new Date().toISOString();

  let moved = 0;
  const details: string[] = [];

  // 2) done items → archive (COALESCE keeps existing completed_at if set)
  const doneRows = await db
    .update(daydeskObjects)
    .set({
      bucket:       "archive",
      updated_at:   now,
      completed_at: sql`COALESCE(${daydeskObjects.completed_at}, ${now})`,
    })
    .where(and(
      eq(daydeskObjects.priority, 0),        // never auto-move pinned (priority=1) cards
      ne(daydeskObjects.bucket,  "pinned"),  // safety net for any legacy pinned-bucket rows
      eq(daydeskObjects.status,  "done"),
      ne(daydeskObjects.bucket,  "archive"),
    ))
    .returning({ id: daydeskObjects.id });

  if (doneRows.length > 0) {
    moved += doneRows.length;
    details.push(`${doneRows.length} done→archive`);
  }

  // 3) incomplete today items last touched before today → week
  const todayRows = await db
    .update(daydeskObjects)
    .set({ bucket: "week", updated_at: now })
    .where(and(
      eq(daydeskObjects.priority, 0),        // never auto-move pinned cards
      ne(daydeskObjects.bucket,  "pinned"),  // safety net for legacy rows
      eq(daydeskObjects.bucket, "today"),
      eq(daydeskObjects.status, "active"),
      sql`LEFT(${daydeskObjects.last_touched_at}, 10) < ${today}`,
    ))
    .returning({ id: daydeskObjects.id });

  if (todayRows.length > 0) {
    moved += todayRows.length;
    details.push(`${todayRows.length} today→week`);
  }

  // 4) incomplete week items older than 7 days → archive
  const weekRows = await db
    .update(daydeskObjects)
    .set({ bucket: "archive", updated_at: now })
    .where(and(
      eq(daydeskObjects.priority, 0),        // never auto-move pinned cards
      ne(daydeskObjects.bucket,  "pinned"),  // safety net for legacy rows
      eq(daydeskObjects.bucket, "week"),
      eq(daydeskObjects.status, "active"),
      sql`LEFT(${daydeskObjects.last_touched_at}, 10) <= ${sevenAgo}`,
    ))
    .returning({ id: daydeskObjects.id });

  if (weekRows.length > 0) {
    moved += weekRows.length;
    details.push(`${weekRows.length} week→archive`);
  }

  if (moved > 0) {
    logger.info({ moved, details: details.join(", ") }, "Rollover complete");
  }

  return { moved, details: details.join("; ") || "nothing to roll" };
}

/** Run rollover at most once per calendar day. Safe to call on every request. */
export async function maybeRollover(): Promise<void> {
  const tz    = process.env.USER_TZ ?? "America/New_York";
  const today = todayLocalDate(tz);

  const [existing] = await db
    .select()
    .from(daydeskRolloverState)
    .where(eq(daydeskRolloverState.id, 1));

  if (!existing) {
    await db.insert(daydeskRolloverState).values({ id: 1, last_date: today });
    await runRollover();
  } else if (existing.last_date < today) {
    await db
      .update(daydeskRolloverState)
      .set({ last_date: today })
      .where(eq(daydeskRolloverState.id, 1));
    await runRollover();
  }
}
