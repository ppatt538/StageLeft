/**
 * Admin key — protects the token management routes.
 *
 * The key is derived deterministically from SESSION_SECRET so it is stable
 * across restarts and deployments without needing a separate env var.
 *
 * It is never stored in the DB or returned directly to the client; the
 * frontend obtains it through the /api/bootstrap same-origin-only endpoint.
 */
import { createHmac } from "crypto";
import type { Request, Response, NextFunction } from "express";

const secret = process.env.SESSION_SECRET;
if (!secret) {
  throw new Error("SESSION_SECRET env var is required for admin auth");
}

/** HMAC-SHA256 of SESSION_SECRET — stable, unpredictable to outsiders */
export const ADMIN_KEY = createHmac("sha256", secret)
  .update("daydesk-admin-v1")
  .digest("hex");

/**
 * Middleware: requires a valid X-Admin-Key header.
 * Used on all /api/tokens management routes.
 */
export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-admin-key"];
  if (!key || key !== ADMIN_KEY) {
    res.status(401).json({ error: "Admin access required" });
    return;
  }
  next();
}
