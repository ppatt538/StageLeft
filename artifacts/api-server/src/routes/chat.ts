import { Router, type IRouter } from "express";
import { nanoid } from "nanoid";
import { db, rowToObject, buildSearchText, type ObjectRow } from "../lib/daydesk-db";
import { SendChatBody, SendChatResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Daydesk — a personal AI temporal desktop assistant.
The user captures things by talking to you (tasks, notes, reminders, links, events, media).
Your job is to understand what they want and produce a JSON response that creates or modifies cards.

RESPONSE FORMAT (always valid JSON, no markdown fences):
{
  "message": "<short friendly reply>",
  "ops": [ ...operations ]
}

OPERATION TYPES:
1. Create a card:
   { "op": "create", "type": "checklist|note|reminder|event|link|media", "title": "...", "bucket": "today|week|archive|pinned", "priority": 0, "tags": [], "payload": { ...type-specific } }

2. Update a card (by id):
   { "op": "update", "id": "...", "title": "...", "bucket": "...", "status": "active|done|snoozed|discarded", "payload": { ...partial } }

3. Delete a card (by id):
   { "op": "delete", "id": "..." }

4. Move a card between buckets:
   { "op": "move", "id": "...", "bucket": "today|week|archive|pinned" }

PAYLOAD SHAPES by type:
- checklist: { "items": [{ "id": "i1", "text": "...", "done": false }] }
- note:      { "markdown": "..." }
- reminder:  { "when": "<ISO-8601>", "location": "optional" }
- event:     { "start": "<ISO-8601>", "end": "<ISO-8601>", "location": "optional" }
- link:      { "url": "https://...", "title": "...", "summary": "optional" }
- media:     { "imageUrl": "<url or null>", "ocrText": "optional caption" }

RULES:
- Default bucket is "today" unless the user says "this week" → "week".
- For checklists, generate unique short IDs for each item (i1, i2, etc.).
- For reminders/events, infer date/time from context (today = current date: ${new Date().toLocaleDateString("en-CA")}).
- If user says "done", "finished", "mark X as done" → op "update" with status "done".
- If user says "delete", "remove", "get rid of" → op "delete".
- If user is just chatting (no card to create/modify) → return ops: [] and a helpful message.
- Always return valid JSON. Never wrap in markdown code blocks.`;

// ─── Mock AI (fallback when OpenAI not available) ─────────────────────────────

function mockAI(message: string, firstMediaUrl?: string): { message: string; ops: unknown[] } {
  const lower = message.toLowerCase();

  // If images were attached, create a media card
  if (firstMediaUrl) {
    return {
      message: "Saved your image as a media card.",
      ops: [
        {
          op: "create",
          type: "media",
          title: message.replace(/attach image:/i, "").trim() || "Captured image",
          bucket: "today",
          priority: 0,
          tags: [],
          payload: { imageUrl: firstMediaUrl, ocrText: "" },
        },
      ],
    };
  }

  // Detect checklist intent
  if (lower.includes("todo") || lower.includes("task") || lower.includes("list")) {
    const lines = message
      .split(/[,\n]/)
      .map((s) => s.replace(/^(todo|task|add|create|make a list of|list)/i, "").trim())
      .filter((s) => s.length > 2);
    return {
      message: `Created a checklist with ${lines.length || 1} item(s).`,
      ops: [
        {
          op: "create",
          type: "checklist",
          title: lines[0] || message.slice(0, 40),
          bucket: "today",
          priority: 0,
          tags: [],
          payload: {
            items: (lines.length > 0 ? lines : [message]).map((t, i) => ({
              id: `i${i + 1}`,
              text: t,
              done: false,
            })),
          },
        },
      ],
    };
  }

  // Detect reminder intent
  if (lower.includes("remind") || lower.includes("at ") || lower.includes("pm") || lower.includes("am")) {
    return {
      message: "Created a reminder for you.",
      ops: [
        {
          op: "create",
          type: "reminder",
          title: message.slice(0, 60),
          bucket: "today",
          priority: 0,
          tags: [],
          payload: {
            when: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        },
      ],
    };
  }

  // Detect link intent
  const urlMatch = message.match(/https?:\/\/\S+/);
  if (urlMatch) {
    return {
      message: `Saved the link for you.`,
      ops: [
        {
          op: "create",
          type: "link",
          title: message.replace(urlMatch[0], "").trim() || urlMatch[0],
          bucket: "today",
          priority: 0,
          tags: [],
          payload: { url: urlMatch[0], title: "", summary: "" },
        },
      ],
    };
  }

  // Default: create a note
  return {
    message: "Got it — saved as a note.",
    ops: [
      {
        op: "create",
        type: "note",
        title: message.slice(0, 60),
        bucket: "today",
        priority: 0,
        tags: [],
        payload: { markdown: message },
      },
    ],
  };
}

// ─── Apply ops to DB (with undo logging) ─────────────────────────────────────

type Op =
  | { op: "create"; type: string; title: string; bucket: string; priority: number; tags: string[]; payload: Record<string, unknown> }
  | { op: "update"; id: string; title?: string; bucket?: string; status?: string; priority?: number; payload?: Record<string, unknown> }
  | { op: "delete"; id: string }
  | { op: "move"; id: string; bucket: string };

function logUndo(msgId: string, objectId: string, action: string, beforeRow: ObjectRow | null) {
  db.prepare(
    "INSERT INTO undo_log (id, message_id, object_id, action, before_row) VALUES (@id, @msgId, @objectId, @action, @beforeRow)",
  ).run({
    id: nanoid(),
    msgId,
    objectId,
    action,
    beforeRow: beforeRow ? JSON.stringify(beforeRow) : null,
  });
}

function applyOps(ops: Op[], messageId: string): ObjectRow[] {
  const changed: ObjectRow[] = [];
  const now = new Date().toISOString();

  const applyAll = db.transaction(() => {
    for (const op of ops) {
      if (op.op === "create") {
        const id = nanoid();
        const payload = op.payload ?? {};
        const searchText = buildSearchText(op.title, payload);
        db.prepare(
          `INSERT INTO objects (id,type,title,bucket,status,priority,tags,payload,source,search_text,links,created_at,updated_at,last_touched_at)
           VALUES (@id,@type,@title,@bucket,'active',@priority,@tags,@payload,@source,@search_text,'[]',@now,@now,@now)`,
        ).run({
          id,
          type: op.type,
          title: op.title,
          bucket: op.bucket ?? "today",
          priority: op.priority ?? 0,
          tags: JSON.stringify(op.tags ?? []),
          payload: JSON.stringify(payload),
          source: JSON.stringify({ kind: "chat", messageId }),
          search_text: searchText,
          now,
        });
        const row = db.prepare("SELECT * FROM objects WHERE id=@id").get({ id }) as ObjectRow;
        changed.push(row);
        // Undo: created → can be discarded
        logUndo(messageId, id, "create", null);
      } else if (op.op === "update") {
        const existing = db.prepare("SELECT * FROM objects WHERE id=@id").get({ id: op.id }) as ObjectRow | undefined;
        if (!existing) continue;
        // Log before state for undo
        logUndo(messageId, op.id, "update", existing);
        const newPayload = op.payload
          ? { ...JSON.parse(existing.payload), ...op.payload }
          : JSON.parse(existing.payload);
        const newTitle = op.title ?? existing.title;
        let completedAt = existing.completed_at;
        if (op.status === "done" && !completedAt) completedAt = now;
        if (op.status && op.status !== "done") completedAt = null;
        db.prepare(
          `UPDATE objects SET title=@title, bucket=@bucket, status=@status, priority=@priority,
           payload=@payload, search_text=@search_text, completed_at=@completed_at,
           updated_at=@now, last_touched_at=@now WHERE id=@id`,
        ).run({
          id: op.id,
          title: newTitle,
          bucket: op.bucket ?? existing.bucket,
          status: op.status ?? existing.status,
          priority: op.priority ?? existing.priority,
          payload: JSON.stringify(newPayload),
          search_text: buildSearchText(newTitle, newPayload),
          completed_at: completedAt,
          now,
        });
        const row = db.prepare("SELECT * FROM objects WHERE id=@id").get({ id: op.id }) as ObjectRow;
        changed.push(row);
      } else if (op.op === "delete") {
        const existing = db.prepare("SELECT * FROM objects WHERE id=@id").get({ id: op.id }) as ObjectRow | undefined;
        if (existing) logUndo(messageId, op.id, "delete", existing);
        db.prepare("UPDATE objects SET status='discarded', updated_at=@now WHERE id=@id").run({ id: op.id, now });
        const row = db.prepare("SELECT * FROM objects WHERE id=@id").get({ id: op.id }) as ObjectRow;
        if (row) changed.push(row);
      } else if (op.op === "move") {
        const existing = db.prepare("SELECT * FROM objects WHERE id=@id").get({ id: op.id }) as ObjectRow | undefined;
        if (existing) logUndo(messageId, op.id, "move", existing);
        db.prepare("UPDATE objects SET bucket=@bucket, updated_at=@now, last_touched_at=@now WHERE id=@id")
          .run({ id: op.id, bucket: op.bucket, now });
        const row = db.prepare("SELECT * FROM objects WHERE id=@id").get({ id: op.id }) as ObjectRow;
        if (row) changed.push(row);
      }
    }
  });

  applyAll();
  return changed;
}

// ─── POST /chat ───────────────────────────────────────────────────────────────

router.post("/chat", async (req, res): Promise<void> => {
  const body = SendChatBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { message, mediaIds } = body.data;
  const now = new Date().toISOString();
  const userMsgId = nanoid();

  // ── Resolve uploaded media URLs ──────────────────────────────────────────
  type MediaRow = { id: string; url: string; filename: string; mime: string };
  const mediaRows: MediaRow[] = mediaIds?.length
    ? (db
        .prepare(`SELECT id, url, filename, mime FROM media WHERE id IN (${mediaIds.map(() => "?").join(",")})`)
        .all(...mediaIds) as MediaRow[])
    : [];
  const firstMediaUrl = mediaRows[0]?.url ?? null;

  // Save user message
  db.prepare(
    "INSERT INTO messages (id,role,content,created_at) VALUES (@id,'user',@content,@now)",
  ).run({ id: userMsgId, content: message, now });

  // Load last 10 messages for context
  const history = db
    .prepare("SELECT role, content FROM messages ORDER BY created_at DESC LIMIT 10")
    .all() as { role: string; content: string }[];
  const chatHistory = history.reverse();

  let aiResult: { message: string; ops: unknown[] };

  // Try OpenAI — fall back to mock if unavailable
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");

    // Fetch current objects for context (so AI can reference them by id)
    const currentObjects = (
      db.prepare("SELECT id,type,title,bucket,status FROM objects WHERE status != 'discarded' ORDER BY updated_at DESC LIMIT 30").all() as ObjectRow[]
    ).map((r) => ({ id: r.id, type: r.type, title: r.title, bucket: r.bucket, status: r.status }));

    // Build media context lines if images were attached
    const mediaContext = mediaRows.length > 0
      ? `\nThe user has attached ${mediaRows.length} image(s). Their URLs: ${mediaRows.map((m) => m.url).join(", ")}. If creating a media card, set imageUrl to the first URL.`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + mediaContext },
        {
          role: "system",
          content: `Current cards on the user's desk (for reference by id if they want to update/delete/move):\n${JSON.stringify(currentObjects, null, 2)}`,
        },
        ...chatHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    aiResult = JSON.parse(raw);
    req.log.info({ ops: (aiResult.ops as unknown[])?.length ?? 0 }, "AI ops parsed");
  } catch (err) {
    req.log.warn({ err }, "OpenAI unavailable — using mock AI");
    aiResult = mockAI(message, firstMediaUrl ?? undefined);
  }

  // ── Post-process ops: if media was attached and a media create op has imageUrl null,
  //    fill in the first uploaded URL automatically
  const ops = Array.isArray(aiResult.ops) ? (aiResult.ops as Op[]) : [];
  if (firstMediaUrl) {
    for (const op of ops) {
      if (
        op.op === "create" &&
        op.type === "media" &&
        (op.payload as Record<string, unknown>).imageUrl == null
      ) {
        (op.payload as Record<string, unknown>).imageUrl = firstMediaUrl;
      }
    }
  }

  const changed = applyOps(ops, userMsgId);

  // Save assistant message
  const assistantMsgId = nanoid();
  const assistantContent = aiResult.message ?? "Done.";
  db.prepare(
    "INSERT INTO messages (id,role,content,created_at,meta) VALUES (@id,'assistant',@content,@now,@meta)",
  ).run({
    id: assistantMsgId,
    content: assistantContent,
    now,
    meta: JSON.stringify({ objectIds: changed.map((o) => o.id), undoMessageId: userMsgId }),
  });

  const responsePayload = {
    message: {
      id: assistantMsgId,
      role: "assistant" as const,
      content: assistantContent,
      created_at: now,
    },
    objectsChanged: changed.map(rowToObject),
    undoMessageId: userMsgId,
  };

  res.json(SendChatResponse.parse(responsePayload));
});

export default router;
