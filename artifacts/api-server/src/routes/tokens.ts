/**
 * Internal token management routes — callable only by the Daydesk browser UI.
 *
 * All routes require a valid session cookie (set automatically by the app on
 * every API response). This ensures that only a browser that has previously
 * loaded the Daydesk app can manage tokens — curl and cross-origin scripts
 * cannot satisfy the SameSite=Strict cookie requirement.
 *
 * GET    /tokens          list all tokens (id, name, scopes, dates — no hash)
 * POST   /tokens          create a token  → returns plaintext token once
 * DELETE /tokens/:id      revoke a token
 */
import { Router, type IRouter } from "express";
import { createToken, listTokens, revokeToken } from "../lib/api-tokens";
import { requireSessionCookie } from "../lib/session-cookie";

const router: IRouter = Router();

// ─── GET /tokens ──────────────────────────────────────────────────────────────

router.get("/tokens", requireSessionCookie, async (_req, res): Promise<void> => {
  const tokens = await listTokens();
  res.json(tokens);
});

// ─── POST /tokens ─────────────────────────────────────────────────────────────

router.post("/tokens", requireSessionCookie, async (req, res): Promise<void> => {
  const { name, scopes } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const validScopes = ["read", "read,write"];
  const scope = typeof scopes === "string" ? scopes : "read";
  if (!validScopes.includes(scope)) {
    res.status(400).json({ error: "scopes must be 'read' or 'read,write'" });
    return;
  }

  const result = await createToken(name.trim(), scope);
  res.status(201).json(result);
});

// ─── DELETE /tokens/:id ───────────────────────────────────────────────────────

router.delete("/tokens/:id", requireSessionCookie, async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!id) { res.status(400).json({ error: "id is required" }); return; }

  await revokeToken(id);
  res.status(204).end();
});

export default router;
