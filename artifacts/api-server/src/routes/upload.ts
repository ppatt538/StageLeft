import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { db } from "../lib/daydesk-db";
import { UploadMediaResponse } from "@workspace/api-zod";

const uploadDir = process.env.UPLOAD_DIR ?? "./data/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const router: IRouter = Router();

router.post("/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const id = nanoid();
  const url = `/api/uploads/${req.file.filename}`;
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO media (id, filename, mime, url, created_at) VALUES (@id, @filename, @mime, @url, @created_at)",
  ).run({
    id,
    filename: req.file.filename,
    mime: req.file.mimetype,
    url,
    created_at: now,
  });

  res.json(
    UploadMediaResponse.parse({
      id,
      filename: req.file.originalname,
      url,
      mime: req.file.mimetype,
    }),
  );
});

export default router;
