import { Router, type IRouter } from 'express';
import { nanoid } from 'nanoid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db/index.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createSession, deleteSession, sessionMiddleware } from '../auth/sessions.js';
import { UPLOADS_DIR } from './uploads.js';

export const authRouter: IRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    if (username.length < 2 || username.length > 32) {
      res.status(400).json({ error: 'Username must be 2-32 characters' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const id = nanoid();
    const passwordHash = await hashPassword(password);
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, passwordHash);

    const token = createSession(id);

    res.status(201).json({ user: { id, username, avatarUrl: null }, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id, username, password_hash, avatar_url FROM users WHERE username = ?').get(username) as
      | { id: string; username: string; password_hash: string; avatar_url: string | null }
      | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await verifyPassword(user.password_hash, password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = createSession(user.id);

    res.json({ user: { id: user.id, username: user.username, avatarUrl: user.avatar_url }, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/logout', sessionMiddleware, (req, res) => {
  if (req.sessionId) {
    deleteSession(req.sessionId);
  }
  res.json({ ok: true });
});

authRouter.get('/me', sessionMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Avatar upload setup
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `avatar-${nanoid()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

authRouter.patch('/profile', sessionMiddleware, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No avatar file provided' });
    return;
  }

  const db = getDb();
  const userId = req.user!.id;

  // Delete old avatar file if exists
  const oldUser = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId) as { avatar_url: string | null } | undefined;
  if (oldUser?.avatar_url) {
    const oldFilename = oldUser.avatar_url.replace('/api/files/', '');
    fs.unlink(path.join(UPLOADS_DIR, oldFilename), () => {});
  }

  const avatarUrl = `/api/files/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, userId);

  res.json({ user: { id: userId, username: req.user!.username, avatarUrl } });
});
