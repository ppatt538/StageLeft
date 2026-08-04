import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { setSessionCookie, COOKIE_NAME } from "./lib/session-cookie";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Parse cookies — required for session-cookie auth on token management routes.
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set the session cookie on every API response so any browser that opens the
// app automatically acquires it. HttpOnly + SameSite=Strict mean it cannot be
// read by JS or sent from a cross-origin context.
app.use((_req, res, next) => {
  // Only set if not already present (avoid redundant Set-Cookie headers).
  // Note: req.cookies is populated by cookieParser above.
  setSessionCookie(res);
  next();
});

// Serve uploaded files statically
const uploadDir = process.env.UPLOAD_DIR ?? "./data/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/api/uploads", express.static(path.resolve(uploadDir)));

app.use("/api", router);

export default app;
