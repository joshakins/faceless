import { Router, type IRouter } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';

export const messagesRouter: IRouter = Router();

// Get messages for a channel (paginated)
messagesRouter.get('/:channelId', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before as string | undefined;

  // Verify membership via channel -> server -> member
  const channel = db.prepare(`
    SELECT c.server_id FROM channels c
    JOIN server_members sm ON sm.server_id = c.server_id
    WHERE c.id = ? AND sm.user_id = ?
  `).get(req.params.channelId, req.user!.id) as { server_id: string } | undefined;

  if (!channel) {
    res.status(403).json({ error: 'No access to this channel' });
    return;
  }

  let messages;
  if (before) {
    messages = db.prepare(`
      SELECT m.id, m.channel_id as channelId, m.author_id as authorId,
             m.content, m.created_at as createdAt,
             u.username as authorUsername
      FROM messages m
      JOIN users u ON u.id = m.author_id
      WHERE m.channel_id = ? AND m.created_at < ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(req.params.channelId, before, limit);
  } else {
    messages = db.prepare(`
      SELECT m.id, m.channel_id as channelId, m.author_id as authorId,
             m.content, m.created_at as createdAt,
             u.username as authorUsername
      FROM messages m
      JOIN users u ON u.id = m.author_id
      WHERE m.channel_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(req.params.channelId, limit);
  }

  res.json({ messages: messages.reverse() });
});
