import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/index.js';
import { deleteUserSessions } from '../auth/sessions.js';
import { sendToUser, broadcastToServer, broadcastToChannel } from '../ws/handler.js';
import { UPLOADS_DIR } from './uploads.js';

export const adminRouter: IRouter = Router();

/** Verify the requesting user is an admin in the given server. */
function requireServerAdmin(req: Request, res: Response, next: NextFunction): void {
  const serverId = req.params.serverId;
  if (!serverId) {
    res.status(400).json({ error: 'Server ID required' });
    return;
  }

  const db = getDb();
  const membership = db.prepare(
    "SELECT role FROM server_members WHERE server_id = ? AND user_id = ?"
  ).get(serverId, req.user!.id) as { role: string } | undefined;

  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

// ── Ban a user from a server ──
adminRouter.post('/servers/:serverId/ban/:userId', requireServerAdmin, (req, res) => {
  const { serverId, userId } = req.params;
  const db = getDb();

  if (userId === req.user!.id) {
    res.status(400).json({ error: 'Cannot ban yourself' });
    return;
  }

  // Check target is a member
  const target = db.prepare(
    'SELECT role FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(serverId, userId) as { role: string } | undefined;

  if (!target) {
    res.status(404).json({ error: 'User is not a member of this server' });
    return;
  }

  if (target.role === 'admin') {
    res.status(400).json({ error: 'Cannot ban an admin. Demote them first.' });
    return;
  }

  db.transaction(() => {
    // Add to bans
    db.prepare(
      'INSERT OR IGNORE INTO server_bans (server_id, user_id) VALUES (?, ?)'
    ).run(serverId, userId);
    // Remove from members
    db.prepare(
      'DELETE FROM server_members WHERE server_id = ? AND user_id = ?'
    ).run(serverId, userId);
  })();

  // Notify the banned user
  sendToUser(userId, 'member:kicked', { serverId, reason: 'banned' });
  // Broadcast to remaining server members
  broadcastToServer(serverId, 'member:banned', { serverId, userId });

  res.json({ ok: true });
});

// ── Timeout a user for 5 minutes ──
adminRouter.post('/servers/:serverId/timeout/:userId', requireServerAdmin, (req, res) => {
  const { serverId, userId } = req.params;
  const db = getDb();

  if (userId === req.user!.id) {
    res.status(400).json({ error: 'Cannot timeout yourself' });
    return;
  }

  const target = db.prepare(
    'SELECT role FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(serverId, userId) as { role: string } | undefined;

  if (!target) {
    res.status(404).json({ error: 'User is not a member of this server' });
    return;
  }

  if (target.role === 'admin') {
    res.status(400).json({ error: 'Cannot timeout an admin' });
    return;
  }

  const timeoutUntil = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  db.prepare(
    'UPDATE server_members SET timeout_until = ? WHERE server_id = ? AND user_id = ?'
  ).run(timeoutUntil, serverId, userId);

  broadcastToServer(serverId, 'member:timeout', { serverId, userId, timeoutUntil });

  res.json({ ok: true });
});

// ── Promote a user to admin ──
adminRouter.post('/servers/:serverId/promote/:userId', requireServerAdmin, (req, res) => {
  const { serverId, userId } = req.params;
  const db = getDb();

  const target = db.prepare(
    'SELECT role FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(serverId, userId) as { role: string } | undefined;

  if (!target) {
    res.status(404).json({ error: 'User is not a member of this server' });
    return;
  }

  if (target.role === 'admin') {
    res.status(400).json({ error: 'User is already an admin' });
    return;
  }

  db.prepare(
    "UPDATE server_members SET role = 'admin' WHERE server_id = ? AND user_id = ?"
  ).run(serverId, userId);

  broadcastToServer(serverId, 'member:role-changed', { serverId, userId, role: 'admin' });

  res.json({ ok: true });
});

// ── Demote an admin to user ──
adminRouter.post('/servers/:serverId/demote/:userId', requireServerAdmin, (req, res) => {
  const { serverId, userId } = req.params;
  const db = getDb();

  if (userId === req.user!.id) {
    res.status(400).json({ error: 'Cannot demote yourself' });
    return;
  }

  const target = db.prepare(
    'SELECT role FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(serverId, userId) as { role: string } | undefined;

  if (!target) {
    res.status(404).json({ error: 'User is not a member of this server' });
    return;
  }

  if (target.role !== 'admin') {
    res.status(400).json({ error: 'User is not an admin' });
    return;
  }

  db.prepare(
    "UPDATE server_members SET role = 'user' WHERE server_id = ? AND user_id = ?"
  ).run(serverId, userId);

  broadcastToServer(serverId, 'member:role-changed', { serverId, userId, role: 'user' });

  res.json({ ok: true });
});

// ── Delete a channel message ──
adminRouter.delete('/messages/:messageId', (req, res) => {
  const { messageId } = req.params;
  const db = getDb();

  // Look up message to find its channel and server
  const message = db.prepare(`
    SELECT m.id, m.channel_id, c.server_id
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    WHERE m.id = ?
  `).get(messageId) as { id: string; channel_id: string; server_id: string } | undefined;

  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  // Verify admin in that server
  const membership = db.prepare(
    "SELECT role FROM server_members WHERE server_id = ? AND user_id = ?"
  ).get(message.server_id, req.user!.id) as { role: string } | undefined;

  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);

  broadcastToChannel(message.channel_id, 'message:deleted', {
    messageId,
    channelId: message.channel_id,
  });

  res.json({ ok: true });
});

// ── Update purge settings for a server ──
adminRouter.patch('/servers/:serverId/purge-settings', requireServerAdmin, (req, res) => {
  const { purgeAfterDays } = req.body;

  if (typeof purgeAfterDays !== 'number' || purgeAfterDays < 0 || purgeAfterDays > 365 || !Number.isInteger(purgeAfterDays)) {
    res.status(400).json({ error: 'purgeAfterDays must be an integer between 0 and 365' });
    return;
  }

  const db = getDb();
  db.prepare('UPDATE servers SET purge_after_days = ? WHERE id = ?').run(purgeAfterDays, req.params.serverId);

  res.json({ ok: true, purgeAfterDays });
});

// ── Purge all messages from text channels in a server now ──
adminRouter.post('/servers/:serverId/purge-now', requireServerAdmin, (req, res) => {
  const db = getDb();
  const serverId = req.params.serverId;

  // Find attachment files to clean up (skip locked messages)
  const attachments = db.prepare(`
    SELECT a.id, a.storage_path FROM attachments a
    JOIN messages m ON m.id = a.message_id
    JOIN channels c ON c.id = m.channel_id
    WHERE c.server_id = ? AND c.type = 'text' AND m.locked = 0
  `).all(serverId) as { id: string; storage_path: string }[];

  // Delete files from disk
  for (const att of attachments) {
    fs.unlink(path.join(UPLOADS_DIR, att.storage_path), () => {});
  }

  // Delete all unlocked messages in text channels for this server
  db.prepare(`
    DELETE FROM messages WHERE channel_id IN (
      SELECT id FROM channels WHERE server_id = ? AND type = 'text'
    ) AND locked = 0
  `).run(serverId);

  res.json({ ok: true });
});

// ── Toggle message lock (protect from purges) ──
adminRouter.post('/messages/:messageId/lock', (req, res) => {
  const { messageId } = req.params;
  const db = getDb();

  const message = db.prepare(`
    SELECT m.id, m.channel_id, m.locked, c.server_id
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    WHERE m.id = ?
  `).get(messageId) as { id: string; channel_id: string; locked: number; server_id: string } | undefined;

  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  const membership = db.prepare(
    "SELECT role FROM server_members WHERE server_id = ? AND user_id = ?"
  ).get(message.server_id, req.user!.id) as { role: string } | undefined;

  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const newLocked = message.locked ? 0 : 1;
  db.prepare('UPDATE messages SET locked = ? WHERE id = ?').run(newLocked, messageId);

  broadcastToChannel(message.channel_id, 'message:locked', {
    messageId,
    channelId: message.channel_id,
    locked: !!newLocked,
  });

  res.json({ ok: true, locked: !!newLocked });
});
