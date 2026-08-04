/**
 * GET /bootstrap
 *
 * Returns the admin key to same-origin callers only.
 *
 * Protection relies on two layers:
 *  1. No CORS headers → browsers enforce same-origin policy and block
 *     cross-origin scripts from reading the response.
 *  2. Sec-Fetch-Site header (set by all modern browsers for non-navigation
 *     requests) is checked; cross-site requests are rejected at the server
 *     level too. Note: Sec-Fetch-* headers cannot be set by JavaScript.
 *
 * Server-to-server callers (curl, Shortcuts) don't need the admin key —
 * they use bearer tokens for the data routes, not token management.
 */
import { Router, type IRouter } from "express";
import { ADMIN_KEY } from "../lib/admin-auth";

const router: IRouter = Router();

router.get("/bootstrap", (req, res): void => {
  // Reject requests where the browser explicitly says they are cross-site
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    res.status(403).json({ error: "Cross-origin access not permitted" });
    return;
  }

  // No CORS headers on this response — browsers will block cross-origin reads.
  res.json({ adminKey: ADMIN_KEY });
});

export default router;
