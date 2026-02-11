import { Router, type IRouter } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createSession, deleteSession, sessionMiddleware } from '../auth/sessions.js';

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

    const sessionId = createSession(id);

    res.cookie('session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ user: { id, username } });
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
    const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as
      | { id: string; username: string; password_hash: string }
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

    const sessionId = createSession(user.id);

    res.cookie('session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/logout', sessionMiddleware, (req, res) => {
  if (req.sessionId) {
    deleteSession(req.sessionId);
  }
  res.clearCookie('session');
  res.json({ ok: true });
});

authRouter.get('/me', sessionMiddleware, (req, res) => {
  res.json({ user: req.user });
});
