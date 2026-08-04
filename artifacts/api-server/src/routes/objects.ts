import { Router, type IRouter } from "express";
import { nanoid } from "nanoid";
import {
  db, daydeskObjects, rowToObject, buildSearchText,
  eq, ne, and, or, ilike, desc, sql,
  type ObjectRow,
} from "../lib/daydesk-db";
import { maybeRollover } from "../lib/rollover";
import {
  ListObjectsQueryParams, ListObjectsResponse,
  GetObjectParams,      GetObjectResponse,
  UpdateObjectParams,   UpdateObjectBody, UpdateObjectResponse,
  DeleteObjectParams,   DeleteObjectResponse,
} from "@workspace/api-zod";
import { requireBearerToken } from "../lib/api-tokens";

const router: IRouter = Router();

// ─── GET /objects ─────────────────────────────────────────────────────────────

router.get("/objects", requireBearerToken("read"), async (req, res): Promise<void> => {
  // Run rollover lazily on each list request (at most once per calendar day)
  await maybeRollover();

  const query = ListObjectsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const { bucket, q } = query.data;

  const rows = await db
    .select()
    .from(daydeskObjects)
    .where(and(
      ne(daydeskObjects.status, "discarded"),
      bucket && bucket !== "all" ? eq(daydeskObjects.bucket, bucket) : undefined,
      q?.trim()
        ? or(
            ilike(daydeskObjects.search_text, `%${q}%`),
            ilike(daydeskObjects.title,       `%${q}%`),
          )
        : undefined,
    ))
    .orderBy(desc(daydeskObjects.priority), desc(daydeskObjects.updated_at));

  res.json(ListObjectsResponse.parse(rows.map(rowToObject)));
});

// ─── GET /objects/:id ─────────────────────────────────────────────────────────

router.get("/objects/:id", requireBearerToken("read"), async (req, res): Promise<void> => {
  const params = GetObjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [row] = await db
    .select()
    .from(daydeskObjects)
    .where(eq(daydeskObjects.id, params.data.id));

  if (!row) { res.status(404).json({ error: "Object not found" }); return; }

  res.json(GetObjectResponse.parse(rowToObject(row)));
});

// ─── PATCH /objects/:id ───────────────────────────────────────────────────────

router.patch("/objects/:id", async (req, res): Promise<void> => {
  const params = UpdateObjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = UpdateObjectBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [existing] = await db
    .select()
    .from(daydeskObjects)
    .where(eq(daydeskObjects.id, params.data.id));

  if (!existing) { res.status(404).json({ error: "Object not found" }); return; }

  const now   = new Date().toISOString();
  const patch = body.data;

  const newPayload  = patch.payload
    ? { ...JSON.parse(existing.payload), ...(patch.payload as Record<string, unknown>) }
    : JSON.parse(existing.payload);
  const newTitle     = patch.title ?? existing.title;
  const newSearchText = buildSearchText(newTitle, newPayload);

  let completedAt = existing.completed_at;
  if (patch.status === "done" && !completedAt) completedAt = now;
  if (patch.status && patch.status !== "done") completedAt = null;

  // Priority resolution: explicit `priority` wins; otherwise `pinned` boolean
  // is a convenience setter (true → 1, false → 0); fall back to existing value.
  const newPriority =
    patch.priority !== undefined
      ? patch.priority
      : patch.pinned !== undefined
        ? (patch.pinned ? 1 : 0)
        : existing.priority;

  const [updated] = await db
    .update(daydeskObjects)
    .set({
      title:           newTitle,
      bucket:          patch.bucket   ?? existing.bucket,
      status:          patch.status   ?? existing.status,
      priority:        newPriority,
      tags:            patch.tags     ? JSON.stringify(patch.tags) : existing.tags,
      layout:          patch.layout !== undefined
                         ? (patch.layout ? JSON.stringify(patch.layout) : null)
                         : existing.layout,
      payload:         JSON.stringify(newPayload),
      search_text:     newSearchText,
      snooze_until:    patch.snooze_until !== undefined ? patch.snooze_until : existing.snooze_until,
      completed_at:    completedAt,
      updated_at:      now,
      last_touched_at: now,
    })
    .where(eq(daydeskObjects.id, params.data.id))
    .returning();

  res.json(UpdateObjectResponse.parse(rowToObject(updated as ObjectRow)));
});

// ─── DELETE /objects/:id (soft) ───────────────────────────────────────────────

router.delete("/objects/:id", async (req, res): Promise<void> => {
  const params = DeleteObjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db
    .select()
    .from(daydeskObjects)
    .where(eq(daydeskObjects.id, params.data.id));

  if (!existing) { res.status(404).json({ error: "Object not found" }); return; }

  const now = new Date().toISOString();

  const [updated] = await db
    .update(daydeskObjects)
    .set({ status: "discarded", updated_at: now })
    .where(eq(daydeskObjects.id, params.data.id))
    .returning();

  res.json(DeleteObjectResponse.parse(rowToObject(updated as ObjectRow)));
});

export default router;
