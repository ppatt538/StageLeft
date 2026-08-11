/**
 * Session cookie — the lightweight "is this the owner's browser?" check for
 * token management routes.
 *
 * How it works:
 *  - A deterministic value (HMAC of SESSION_SECRET) is stored as an HttpOnly,
 *    SameSite=Strict cookie on every API response.
 *  - Token management routes require this cookie.
 *
 * Security properties:
 *  - HttpOnly: JavaScript cannot read or exfiltrate the value.
 *  - SameSite=Strict: browsers will NOT send it on cross-origin requests, so
 *    a malicious third-party site cannot trigger token management even if it
 *    knows the app URL.
 *  - Stable: derived from SESSION_SECRET, so it survives server restarts.
 *  - Never transmitted in plain text over HTTP (Secure flag in production).
 *
 * Limitation (by design): any browser that has ever loaded the app (any
 * /api/* endpoint) will have the cookie. This is intentional — for a
 * single-owner personal tool there is no login step; the "identity check" is
 * "you used your own browser to open the app."
 */
import { createHmac } from "crypto";
import type { Request, Response, NextFunction } from "express";

const secret = process.env.SESSION_SECRET;
if (!secret) {
  throw new Error("SESSION_SECRET env var is required");
}

export const COOKIE_NAME = "dd_session";

// Deterministic — same value every restart, bound to SESSION_SECRET.
const COOKIE_VALUE = createHmac("sha256", secret)
  .update("daydesk-session-v1")
  .digest("hex");

const IS_PROD = process.env.NODE_ENV === "production";

/** Set the session cookie on a response (idempotent). */
export function setSessionCookie(res: Response): void {
  res.cookie(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "strict",
    secure: IS_PROD,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    path: "/",
  });
}

/**
 * Middleware — requires a valid session cookie.
 * Returns 401 if absent or wrong; intended for token management routes.
 */
export function requireSessionCookie(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const value = cookies?.[COOKIE_NAME];
  if (!value || value !== COOKIE_VALUE) {
    res.status(401).json({
      error: "Open StageLeft in your browser first — session required for token management",
    });
    return;
  }
  next();
}
