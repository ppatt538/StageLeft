import { Router, type IRouter } from "express";
import { nanoid } from "nanoid";
import {
  db,
  daydeskObjects, daydeskMessages, daydeskMedia, daydeskUndoLog,
  rowToObject, buildSearchText,
  eq, ne, desc, inArray,
  type ObjectRow,
} from "../lib/daydesk-db";
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
   { "op": "create", "type": "checklist|note|reminder|event|link|media", "title": "...", "bucket": "today|week|archive", "priority": 0, "tags": [], "payload": { ...type-specific } }

2. Update a card (by id):
   { "op": "update", "id": "...", "title": "...", "bucket": "...", "status": "active|done|snoozed|discarded", "priority": 0, "payload": { ...partial } }

3. Delete a card (by id):
   { "op": "delete", "id": "..." }

4. Move a card between buckets:
   { "op": "move", "id": "...", "bucket": "today|week|archive" }

PAYLOAD SHAPES by type:
- checklist: { "items": [{ "id": "i1", "text": "...", "done": false }] }
- note:      { "markdown": "..." }
- reminder:  { "when": "<ISO-8601>", "location": "optional" }
- event:     { "start": "<ISO-8601>", "end": "<ISO-8601>", "location": "optional" }
- link:      { "url": "https://...", "title": "...", "summary": "optional" }
- media:     { "imageUrl": "<url or null>", "ocrText": "optional caption" }

RULES:
- Default bucket is "today" unless the user says "this week" → "week". Never use "pinned" as a bucket.
- To pin a card (keep it at the top of its bucket), set priority=1 in create or update. To unpin, set priority=0.
- For checklists, generate unique short IDs for each item (i1, i2, etc.).
- For reminders/events, infer date/time from context (today = current date: ${new Date().toLocaleDateString("en-CA")}).
- If user says "done", "finished", "mark X as done" → op "update" with status "done".
- If user says "delete", "remove", "get rid of" → op "delete".
- If user is just chatting (no card to create/modify) → return ops: [] and a helpful message.
- Always return valid JSON. Never wrap in markdown code blocks.`;

// ─── Mock AI (fallback when OpenAI not available) ─────────────────────────────

function mockAI(message: string, firstMediaUrl?: string): { message: string; ops: unknown[] } {
  const lower = message.toLowerCase();

  if (firstMediaUrl) {
    return {
      message: "Saved your image as a media card.",
      ops: [{ op: "create", type: "media", title: message.replace(/attach image:/i, "").trim() || "Captured image",
              bucket: "today", priority: 0, tags: [], payload: { imageUrl: firstMediaUrl, ocrText: "" } }],
    };
  }

  if (lower.includes("todo") || lower.includes("task") || lower.includes("list")) {
    const lines = message.split(/[,\n]/)
      .map((s) => s.replace(/^(todo|task|add|create|make a list of|list)/i, "").trim())
      .filter((s) => s.length > 2);
    return {
      message: `Created a checklist with ${lines.length || 1} item(s).`,
      ops: [{ op: "create", type: "checklist", title: lines[0] || message.slice(0, 40),
              bucket: "today", priority: 0, tags: [],
              payload: { items: (lines.length > 0 ? lines : [message]).map((t, i) => ({ id: `i${i + 1}`, text: t, done: false })) } }],
    };
  }

  if (lower.includes("remind") || lower.includes("at ") || lower.includes("pm") || lower.includes("am")) {
    return {
      message: "Created a reminder for you.",
      ops: [{ op: "create", type: "reminder", title: message.slice(0, 60),
              bucket: "today", priority: 0, tags: [],
              payload: { when: new Date(Date.now() + 60 * 60 * 1000).toISOString() } }],
    };
  }

  const urlMatch = message.match(/https?:\/\/\S+/);
  if (urlMatch) {
    return {
      message: "Saved the link for you.",
      ops: [{ op: "create", type: "link", title: message.replace(urlMatch[0], "").trim() || urlMatch[0],
              bucket: "today", priority: 0, tags: [],
              payload: { url: urlMatch[0], title: "", summary: "" } }],
    };
  }

  return {
    message: "Got it — saved as a note.",
    ops: [{ op: "create", type: "note", title: message.slice(0, 60),
            bucket: "today", priority: 0, tags: [], payload: { markdown: message } }],
  };
}

// ─── Op types ─────────────────────────────────────────────────────────────────

type Op =
  | { op: "create"; type: string; title: string; bucket: string; priority: number; tags: string[]; payload: Record<string, unknown> }
  | { op: "update"; id: string; title?: string; bucket?: string; status?: string; priority?: number; payload?: Record<string, unknown> }
  | { op: "delete"; id: string }
  | { op: "move";   id: string; bucket: string };

// ─── Apply ops inside a transaction ──────────────────────────────────────────

async function applyOps(ops: Op[], messageId: string): Promise<ObjectRow[]> {
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const changed: ObjectRow[] = [];

    for (const op of ops) {
      // ── create ────────────────────────────────────────────────────────────
      if (op.op === "create") {
        const id      = nanoid();
        const payload = op.payload ?? {};
        const [row]   = await tx
          .insert(daydeskObjects)
          .values({
            id, type: op.type, title: op.title,
            bucket:          op.bucket  ?? "today",
            status:          "active",
            priority:        op.priority ?? 0,
            tags:            JSON.stringify(op.tags  ?? []),
            payload:         JSON.stringify(payload),
            source:          JSON.stringify({ kind: "chat", messageId }),
            search_text:     buildSearchText(op.title, payload),
            links:           "[]",
            created_at:      now, updated_at: now, last_touched_at: now,
          })
          .returning();

        if (row) {
          changed.push(row);
          await tx.insert(daydeskUndoLog).values({
            id: nanoid(), message_id: messageId, object_id: id,
            action: "create", before_row: null, created_at: now,
          });
        }

      // ── update ────────────────────────────────────────────────────────────
      } else if (op.op === "update") {
        const [existing] = await tx.select().from(daydeskObjects).where(eq(daydeskObjects.id, op.id));
        if (!existing) continue;

        await tx.insert(daydeskUndoLog).values({
          id: nanoid(), message_id: messageId, object_id: op.id,
          action: "update", before_row: JSON.stringify(existing), created_at: now,
        });

        const newPayload = op.payload
          ? { ...JSON.parse(existing.payload), ...op.payload }
          : JSON.parse(existing.payload);
        const newTitle = op.title ?? existing.title;
        let completedAt = existing.completed_at;
        if (op.status === "done" && !completedAt) completedAt = now;
        if (op.status && op.status !== "done") completedAt = null;

        const [row] = await tx
          .update(daydeskObjects)
          .set({
            title: newTitle, bucket: op.bucket ?? existing.bucket,
            status: op.status ?? existing.status, priority: op.priority ?? existing.priority,
            payload: JSON.stringify(newPayload),
            search_text: buildSearchText(newTitle, newPayload),
            completed_at: completedAt, updated_at: now, last_touched_at: now,
          })
          .where(eq(daydeskObjects.id, op.id))
          .returning();

        if (row) changed.push(row);

      // ── delete ────────────────────────────────────────────────────────────
      } else if (op.op === "delete") {
        const [existing] = await tx.select().from(daydeskObjects).where(eq(daydeskObjects.id, op.id));
        if (existing) {
          await tx.insert(daydeskUndoLog).values({
            id: nanoid(), message_id: messageId, object_id: op.id,
            action: "delete", before_row: JSON.stringify(existing), created_at: now,
          });
        }

        const [row] = await tx
          .update(daydeskObjects)
          .set({ status: "discarded", updated_at: now })
          .where(eq(daydeskObjects.id, op.id))
          .returning();

        if (row) changed.push(row);

      // ── move ──────────────────────────────────────────────────────────────
      } else if (op.op === "move") {
        const [existing] = await tx.select().from(daydeskObjects).where(eq(daydeskObjects.id, op.id));
        if (existing) {
          await tx.insert(daydeskUndoLog).values({
            id: nanoid(), message_id: messageId, object_id: op.id,
            action: "move", before_row: JSON.stringify(existing), created_at: now,
          });
        }

        const [row] = await tx
          .update(daydeskObjects)
          .set({ bucket: op.bucket, updated_at: now, last_touched_at: now })
          .where(eq(daydeskObjects.id, op.id))
          .returning();

        if (row) changed.push(row);
      }
    }

    return changed;
  });
}

// ─── POST /chat ───────────────────────────────────────────────────────────────

router.post("/chat", async (req, res): Promise<void> => {
  const body = SendChatBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { message, mediaIds } = body.data;
  const now       = new Date().toISOString();
  const userMsgId = nanoid();

  // ── Resolve uploaded media URLs ────────────────────────────────────────────
  const mediaRows = mediaIds?.length
    ? await db
        .select({ id: daydeskMedia.id, url: daydeskMedia.url, filename: daydeskMedia.filename, mime: daydeskMedia.mime })
        .from(daydeskMedia)
        .where(inArray(daydeskMedia.id, mediaIds))
    : [];
  const firstMediaUrl = mediaRows[0]?.url ?? null;

  // Save user message
  await db.insert(daydeskMessages).values({ id: userMsgId, role: "user", content: message, created_at: now });

  // Load last 10 messages for context
  const history = await db
    .select({ role: daydeskMessages.role, content: daydeskMessages.content })
    .from(daydeskMessages)
    .orderBy(desc(daydeskMessages.created_at))
    .limit(10);
  const chatHistory = history.reverse();

  let aiResult: { message: string; ops: unknown[] };

  // Try OpenAI — fall back to mock if unavailable
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");

    const currentObjects = await db
      .select({ id: daydeskObjects.id, type: daydeskObjects.type, title: daydeskObjects.title, bucket: daydeskObjects.bucket, status: daydeskObjects.status })
      .from(daydeskObjects)
      .where(ne(daydeskObjects.status, "discarded"))
      .orderBy(desc(daydeskObjects.updated_at))
      .limit(30);

    const mediaContext = mediaRows.length > 0
      ? `\nThe user has attached ${mediaRows.length} image(s). Their URLs: ${mediaRows.map((m) => m.url).join(", ")}. If creating a media card, set imageUrl to the first URL.`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + mediaContext },
        { role: "system", content: `Current cards on the user's desk (for reference by id if they want to update/delete/move):\n${JSON.stringify(currentObjects, null, 2)}` },
        ...chatHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    aiResult  = JSON.parse(raw);
    req.log.info({ ops: (aiResult.ops as unknown[])?.length ?? 0 }, "AI ops parsed");
  } catch (err) {
    req.log.warn({ err }, "OpenAI unavailable — using mock AI");
    aiResult = mockAI(message, firstMediaUrl ?? undefined);
  }

  // Post-process: fill imageUrl for media ops that left it null
  const ops = Array.isArray(aiResult.ops) ? (aiResult.ops as Op[]) : [];
  if (firstMediaUrl) {
    for (const op of ops) {
      if (op.op === "create" && op.type === "media" && (op.payload as Record<string, unknown>).imageUrl == null) {
        (op.payload as Record<string, unknown>).imageUrl = firstMediaUrl;
      }
    }
  }

  const changed = await applyOps(ops, userMsgId);

  // Save assistant message
  const assistantMsgId  = nanoid();
  const assistantContent = aiResult.message ?? "Done.";
  await db.insert(daydeskMessages).values({
    id: assistantMsgId, role: "assistant", content: assistantContent, created_at: now,
    meta: JSON.stringify({ objectIds: changed.map((o) => o.id), undoMessageId: userMsgId }),
  });

  res.json(SendChatResponse.parse({
    message: { id: assistantMsgId, role: "assistant" as const, content: assistantContent, created_at: now },
    objectsChanged: changed.map(rowToObject),
    undoMessageId: userMsgId,
  }));
});

export default router;
