import { Router, type IRouter } from "express";
import { db } from "../lib/daydesk-db";
import { ListMessagesQueryParams, ListMessagesResponse } from "@workspace/api-zod";

type MessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  meta: string | null;
};

const router: IRouter = Router();

router.get("/messages", async (req, res): Promise<void> => {
  const query = ListMessagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const limit = query.data.limit ?? 50;
  const rows = db
    .prepare("SELECT * FROM messages ORDER BY created_at DESC LIMIT @limit")
    .all({ limit }) as MessageRow[];

  const messages = rows.reverse().map((row) => ({
    ...row,
    meta: row.meta ? JSON.parse(row.meta) : undefined,
  }));

  res.json(ListMessagesResponse.parse(messages));
});

export default router;
