/**
 * API token helpers — create, list, revoke personal access tokens.
 * Tokens are stored as SHA-256 hashes; the plaintext is returned only
 * at creation time and is never stored.
 */
import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { daydeskApiTokens } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

// ─── Crypto helpers ───────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function createToken(
  name: string,
  scopes: string,
): Promise<{ id: string; name: string; scopes: string; created_at: string; token: string }> {
  const plaintext  = randomBytes(32).toString("hex");
  const token_hash = hashToken(plaintext);
  const now        = new Date().toISOString();
  const id         = nanoid();

  await db.insert(daydeskApiTokens).values({ id, name, token_hash, scopes, created_at: now });

  return { id, name, scopes, created_at: now, token: plaintext };
}

export async function listTokens() {
  return db
    .select({
      id:           daydeskApiTokens.id,
      name:         daydeskApiTokens.name,
      scopes:       daydeskApiTokens.scopes,
      created_at:   daydeskApiTokens.created_at,
      last_used_at: daydeskApiTokens.last_used_at,
    })
    .from(daydeskApiTokens)
    .orderBy(daydeskApiTokens.created_at);
}

export async function revokeToken(id: string): Promise<void> {
  await db.delete(daydeskApiTokens).where(eq(daydeskApiTokens.id, id));
}

// ─── Express middleware ───────────────────────────────────────────────────────

/**
 * Validates a bearer token when the Authorization header is present.
 *
 * Behaviour:
 *   - No `Authorization: Bearer` header  → pass through (in-app browser request)
 *   - Header present, token unknown      → 401
 *   - Token valid, scope insufficient    → 403
 *   - Token valid, scope OK              → next() + update last_used_at async
 */
export function requireBearerToken(requiredScope: "read" | "write") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = req.headers.authorization;

    // No header at all → treat as in-app browser request, allow through
    if (!auth) {
      next();
      return;
    }

    // Header present but not a valid Bearer token → reject
    if (!auth.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authorization header must use Bearer scheme" });
      return;
    }

    const plaintext = auth.slice(7).trim();
    if (!plaintext) {
      res.status(401).json({ error: "Invalid API token" });
      return;
    }

    const hash = hashToken(plaintext);

    let row: typeof daydeskApiTokens.$inferSelect | undefined;
    try {
      [row] = await db
        .select()
        .from(daydeskApiTokens)
        .where(eq(daydeskApiTokens.token_hash, hash));
    } catch (err) {
      // DB error (e.g. table not yet migrated in production) — fail closed with
      // a clear 500 so the caller gets a response instead of a timeout.
      res.status(500).json({ error: "Token validation unavailable — database not ready" });
      return;
    }

    if (!row) {
      res.status(401).json({ error: "Invalid API token" });
      return;
    }

    const tokenScopes = row.scopes.split(",").map((s) => s.trim());
    if (!tokenScopes.includes(requiredScope)) {
      res.status(403).json({ error: `Token does not have '${requiredScope}' scope` });
      return;
    }

    // Update last_used_at non-blocking
    db.update(daydeskApiTokens)
      .set({ last_used_at: new Date().toISOString() })
      .where(eq(daydeskApiTokens.id, row.id))
      .catch(() => { /* ignore */ });

    next();
  };
}
