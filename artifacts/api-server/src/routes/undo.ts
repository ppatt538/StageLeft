import { Router, type IRouter } from "express";
import {
  db, daydeskObjects, daydeskUndoLog,
  eq, desc,
  type ObjectRow,
} from "../lib/daydesk-db";

const router: IRouter = Router();

// POST /undo/:messageId — reverse all ops applied for a given chat message
router.post("/undo/:messageId", async (req, res): Promise<void> => {
  const { messageId } = req.params;

  const logs = await db
    .select()
    .from(daydeskUndoLog)
    .where(eq(daydeskUndoLog.message_id, messageId))
    .orderBy(desc(daydeskUndoLog.created_at)); // newest-first so ops are reversed in insertion order

  if (!logs.length) {
    res.status(404).json({ error: "No undo log found for this message." });
    return;
  }

  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    for (const log of logs) {
      if (log.action === "create") {
        // Reverse a create → soft-delete the object
        await tx
          .update(daydeskObjects)
          .set({ status: "discarded", updated_at: now })
          .where(eq(daydeskObjects.id, log.object_id));

      } else if (log.before_row) {
        // Reverse an update / delete / move → restore the row to its before-state
        const before = JSON.parse(log.before_row) as ObjectRow;
        await tx
          .update(daydeskObjects)
          .set({
            type:            before.type,
            title:           before.title,
            bucket:          before.bucket,
            status:          before.status,
            priority:        before.priority,
            tags:            before.tags,
            payload:         before.payload,
            search_text:     before.search_text,
            last_touched_at: before.last_touched_at,
            completed_at:    before.completed_at,
            updated_at:      now,
          })
          .where(eq(daydeskObjects.id, before.id));
      }
    }

    // Remove processed logs so they can't be double-applied
    await tx.delete(daydeskUndoLog).where(eq(daydeskUndoLog.message_id, messageId));
  });

  res.json({ ok: true, reversed: logs.length });
});

export default router;
