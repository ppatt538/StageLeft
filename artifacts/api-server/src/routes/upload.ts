import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { db, daydeskMedia } from "../lib/daydesk-db";
import { UploadMediaResponse } from "@workspace/api-zod";

const uploadDir = process.env.UPLOAD_DIR ?? "./data/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file,  cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Only image files are allowed"), allowed.includes(file.mimetype));
  },
});

const router: IRouter = Router();

router.post("/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const id  = nanoid();
  const url = `/api/uploads/${req.file.filename}`;
  const now = new Date().toISOString();

  await db.insert(daydeskMedia).values({
    id,
    filename:   req.file.filename,
    mime:       req.file.mimetype,
    url,
    created_at: now,
  });

  res.json(UploadMediaResponse.parse({
    id,
    filename: req.file.originalname,
    url,
    mime: req.file.mimetype,
  }));
});

export default router;
