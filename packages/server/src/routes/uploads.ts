import { Router, type IRouter } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '../../data/uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${nanoid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

export const uploadsRouter: IRouter = Router();

uploadsRouter.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  const db = getDb();
  const id = nanoid();

  db.prepare(`
    INSERT INTO attachments (id, message_id, filename, mime_type, size, storage_path)
    VALUES (?, NULL, ?, ?, ?, ?)
  `).run(id, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename);

  res.json({
    id,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: `/api/files/${req.file.filename}`,
  });
});
