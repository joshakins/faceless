import { nanoid } from 'nanoid';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

export function createSession(userId: string): string {
  const db = getDb();
  const sessionId = nanoid(32);
  const expiresAt = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);

  db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(sessionId, userId, expiresAt);

  return sessionId;
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteUserSessions(userId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.session;

  if (!sessionId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const row = db.prepare(`
    SELECT s.id as session_id, u.id as user_id, u.username
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, now) as { session_id: string; user_id: string; username: string } | undefined;

  if (!row) {
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  req.user = { id: row.user_id, username: row.username };
  req.sessionId = row.session_id;
  next();
}
