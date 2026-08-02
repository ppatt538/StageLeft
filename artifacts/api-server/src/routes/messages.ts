import { Router, type IRouter } from "express";
import { db, daydeskMessages, desc, lt } from "../lib/daydesk-db";
import { ListMessagesQueryParams, ListMessagesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/messages", async (req, res): Promise<void> => {
  const query = ListMessagesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const limit  = query.data.limit ?? 50;
  const before = query.data.before;

  const rows = await db
    .select()
    .from(daydeskMessages)
    .where(before ? lt(daydeskMessages.created_at, before) : undefined)
    .orderBy(desc(daydeskMessages.created_at))
    .limit(limit);

  const messages = rows.reverse().map((row) => ({
    ...row,
    meta: row.meta ? JSON.parse(row.meta) : undefined,
  }));

  res.json(ListMessagesResponse.parse(messages));
});

export default router;
