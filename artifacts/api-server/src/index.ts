import app from "./app";
import { logger } from "./lib/logger";
import { ensureSeeded, ensureMigrations } from "./lib/daydesk-db";
import { maybeRollover } from "./lib/rollover";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

async function startup() {
  // Run data migrations first (idempotent, safe every boot)
  try {
    await ensureMigrations();
  } catch (err) {
    logger.warn({ err }, "ensureMigrations failed (non-fatal)");
  }

  // Seed the database on first boot, then run any pending rollover
  try {
    await ensureSeeded();
  } catch (err) {
    logger.warn({ err }, "ensureSeeded failed (non-fatal)");
  }

  try {
    await maybeRollover();
  } catch (err) {
    logger.warn({ err }, "maybeRollover on startup failed (non-fatal)");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

startup().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
