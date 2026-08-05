---
name: Deployment password wall blocks external API callers
description: Why external tools (Apple Shortcuts, curl) time out against the published Daydesk API
---

Replit deployments with `visibility: "password"` intercept EVERY request — including API paths — with a 307 redirect to the password page. External callers (Apple Shortcuts, webhooks, curl scripts) can't follow it and appear to "time out."

**Why:** The password wall is platform-level and sits in front of the app; the app's own auth (bearer tokens, session cookies) never sees the request.

**How to apply:** If external tools report timeouts against the production URL, check `getDeploymentInfo().visibility` FIRST before debugging app code. External API access requires public visibility; UI privacy then needs in-app auth instead.
