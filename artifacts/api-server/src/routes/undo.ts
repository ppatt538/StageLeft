import { Router, type IRouter } from "express";
import { db, type ObjectRow } from "../lib/daydesk-db";

const router: IRouter = Router();

// POST /undo/:messageId — reverse all ops applied for a given assistant message
router.post("/undo/:messageId", (req, res): void => {
  const { messageId } = req.params;

  const logs = db
    .prepare("SELECT * FROM undo_log WHERE message_id = @messageId ORDER BY rowid DESC")
    .all({ messageId }) as {
    id: string;
    message_id: string;
    object_id: string;
    action: "create" | "update" | "delete" | "move";
    before_row: string | null;
  }[];

  if (!logs.length) {
    res.status(404).json({ error: "No undo log found for this message." });
    return;
  }

  const now = new Date().toISOString();

  const doUndo = db.transaction(() => {
    for (const log of logs) {
      if (log.action === "create") {
        // Reverse a create → soft-delete the object
        db.prepare("UPDATE objects SET status='discarded', updated_at=@now WHERE id=@id").run({
          id: log.object_id,
          now,
        });
      } else if (log.before_row) {
        // Reverse an update / delete / move → restore the row to its before-state
        const before = JSON.parse(log.before_row) as ObjectRow;
        db.prepare(
          `UPDATE objects SET
            type=@type, title=@title, bucket=@bucket, status=@status,
            priority=@priority, tags=@tags, payload=@payload,
            search_text=@search_text, updated_at=@now, last_touched_at=@last_touched_at,
            completed_at=@completed_at
           WHERE id=@id`,
        ).run({
          id: before.id,
          type: before.type,
          title: before.title,
          bucket: before.bucket,
          status: before.status,
          priority: before.priority,
          tags: before.tags,
          payload: before.payload,
          search_text: before.search_text,
          last_touched_at: before.last_touched_at,
          completed_at: before.completed_at ?? null,
          now,
        });
      }
    }

    // Remove processed undo logs so they can't be double-applied
    db.prepare("DELETE FROM undo_log WHERE message_id = @messageId").run({ messageId });
  });

  doUndo();
  res.json({ ok: true, reversed: logs.length });
});

export default router;
