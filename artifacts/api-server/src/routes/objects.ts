import { Router, type IRouter } from "express";
import { nanoid } from "nanoid";
import { db, rowToObject, buildSearchText, type ObjectRow } from "../lib/daydesk-db";
import { maybeRollover } from "../lib/rollover";
import {
  ListObjectsQueryParams,
  ListObjectsResponse,
  GetObjectParams,
  GetObjectResponse,
  UpdateObjectParams,
  UpdateObjectBody,
  UpdateObjectResponse,
  DeleteObjectParams,
  DeleteObjectResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── GET /objects ─────────────────────────────────────────────────────────────

router.get("/objects", async (req, res): Promise<void> => {
  // Run rollover lazily on each list request
  maybeRollover();

  const query = ListObjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { bucket, q } = query.data;

  let sql = "SELECT * FROM objects WHERE status != 'discarded'";
  const params: Record<string, string> = {};

  if (bucket && bucket !== "all") {
    sql += " AND bucket = @bucket";
    params.bucket = bucket;
  }

  if (q && q.trim()) {
    sql +=
      " AND (LOWER(search_text) LIKE @q OR LOWER(title) LIKE @q)";
    params.q = `%${q.toLowerCase()}%`;
  }

  sql += " ORDER BY priority DESC, updated_at DESC";

  const rows = db.prepare(sql).all(params) as ObjectRow[];
  const objects = rows.map(rowToObject);

  res.json(ListObjectsResponse.parse(objects));
});

// ─── GET /objects/:id ─────────────────────────────────────────────────────────

router.get("/objects/:id", async (req, res): Promise<void> => {
  const params = GetObjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const row = db
    .prepare("SELECT * FROM objects WHERE id = @id")
    .get({ id: params.data.id }) as ObjectRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Object not found" });
    return;
  }

  res.json(GetObjectResponse.parse(rowToObject(row)));
});

// ─── PATCH /objects/:id ───────────────────────────────────────────────────────

router.patch("/objects/:id", async (req, res): Promise<void> => {
  const params = UpdateObjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateObjectBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const existing = db
    .prepare("SELECT * FROM objects WHERE id = @id")
    .get({ id: params.data.id }) as ObjectRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Object not found" });
    return;
  }

  const now = new Date().toISOString();
  const patch = body.data;

  // Merge payload if provided
  const newPayload = patch.payload
    ? { ...JSON.parse(existing.payload), ...(patch.payload as Record<string, unknown>) }
    : JSON.parse(existing.payload);

  const newTitle = patch.title ?? existing.title;
  const newSearchText = buildSearchText(newTitle, newPayload);

  // Build completed_at
  let completedAt = existing.completed_at;
  if (patch.status === "done" && !completedAt) completedAt = now;
  if (patch.status && patch.status !== "done") completedAt = null;

  db.prepare(
    `UPDATE objects SET
      title           = @title,
      bucket          = @bucket,
      status          = @status,
      priority        = @priority,
      tags            = @tags,
      layout          = @layout,
      payload         = @payload,
      search_text     = @search_text,
      snooze_until    = @snooze_until,
      completed_at    = @completed_at,
      updated_at      = @now,
      last_touched_at = @now
    WHERE id = @id`,
  ).run({
    id: params.data.id,
    title: newTitle,
    bucket: patch.bucket ?? existing.bucket,
    status: patch.status ?? existing.status,
    priority: patch.priority ?? existing.priority,
    tags: patch.tags ? JSON.stringify(patch.tags) : existing.tags,
    layout: patch.layout !== undefined
      ? (patch.layout ? JSON.stringify(patch.layout) : null)
      : existing.layout,
    payload: JSON.stringify(newPayload),
    search_text: newSearchText,
    snooze_until: patch.snooze_until !== undefined ? patch.snooze_until : existing.snooze_until,
    completed_at: completedAt,
    now,
  });

  const updated = db
    .prepare("SELECT * FROM objects WHERE id = @id")
    .get({ id: params.data.id }) as ObjectRow;

  res.json(UpdateObjectResponse.parse(rowToObject(updated)));
});

// ─── DELETE /objects/:id (soft) ───────────────────────────────────────────────

router.delete("/objects/:id", async (req, res): Promise<void> => {
  const params = DeleteObjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const existing = db
    .prepare("SELECT * FROM objects WHERE id = @id")
    .get({ id: params.data.id }) as ObjectRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Object not found" });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE objects SET status = 'discarded', updated_at = @now WHERE id = @id",
  ).run({ id: params.data.id, now });

  const updated = db
    .prepare("SELECT * FROM objects WHERE id = @id")
    .get({ id: params.data.id }) as ObjectRow;

  res.json(DeleteObjectResponse.parse(rowToObject(updated)));
});

export default router;
