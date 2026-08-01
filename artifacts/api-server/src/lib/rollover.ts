/**
 * Rollover logic: age objects between Today → Week → Archive.
 * Rules:
 * 1) pinned: never auto-move
 * 2) status=done → archive (if not pinned); set completed_at if missing
 * 3) incomplete today items with last_touched before today's local date → week
 * 4) incomplete week items older than 7 local days → archive
 * 5) reminders/events with when < start of today: stay visible (overdue badge in UI)
 */
import { db } from "./daydesk-db";
import { logger } from "./logger";

function todayLocalDate(tz: string): string {
  // Returns YYYY-MM-DD in the user's timezone
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sevenDaysAgo(tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function runRollover(): { moved: number; details: string } {
  const tz = process.env.USER_TZ ?? "America/New_York";
  const today = todayLocalDate(tz);
  const sevenAgo = sevenDaysAgo(tz);
  const now = new Date().toISOString();

  let moved = 0;
  const details: string[] = [];

  // 2) done items → archive
  const doneResult = db
    .prepare(
      `UPDATE objects
       SET bucket = 'archive', completed_at = COALESCE(completed_at, @now), updated_at = @now
       WHERE bucket != 'pinned' AND status = 'done' AND bucket != 'archive'`,
    )
    .run({ now });
  if (doneResult.changes > 0) {
    moved += doneResult.changes;
    details.push(`${doneResult.changes} done→archive`);
  }

  // 3) incomplete today items last touched before today → week
  const todayResult = db
    .prepare(
      `UPDATE objects
       SET bucket = 'week', updated_at = @now
       WHERE bucket = 'today'
         AND status = 'active'
         AND substr(last_touched_at, 1, 10) < @today`,
    )
    .run({ now, today });
  if (todayResult.changes > 0) {
    moved += todayResult.changes;
    details.push(`${todayResult.changes} today→week`);
  }

  // 4) incomplete week items older than 7 days → archive
  const weekResult = db
    .prepare(
      `UPDATE objects
       SET bucket = 'archive', updated_at = @now
       WHERE bucket = 'week'
         AND status = 'active'
         AND substr(last_touched_at, 1, 10) <= @sevenAgo`,
    )
    .run({ now, sevenAgo });
  if (weekResult.changes > 0) {
    moved += weekResult.changes;
    details.push(`${weekResult.changes} week→archive`);
  }

  if (moved > 0) {
    logger.info({ moved, details: details.join(", ") }, "Rollover complete");
  }

  return { moved, details: details.join("; ") || "nothing to roll" };
}

/** Run rollover once per calendar day. Safe to call on every request. */
export function maybeRollover(): void {
  const tz = process.env.USER_TZ ?? "America/New_York";
  const today = todayLocalDate(tz);

  const existing = db
    .prepare("SELECT last_date FROM rollover_state WHERE id = 1")
    .get() as { last_date: string } | undefined;

  if (!existing) {
    db.prepare("INSERT INTO rollover_state (id, last_date) VALUES (1, @today)").run({ today });
    runRollover();
  } else if (existing.last_date < today) {
    db.prepare("UPDATE rollover_state SET last_date = @today WHERE id = 1").run({ today });
    runRollover();
  }
}
