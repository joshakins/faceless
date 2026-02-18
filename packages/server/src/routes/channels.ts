import { Router, type IRouter } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import { broadcastToServer } from '../ws/handler.js';

export const channelsRouter: IRouter = Router();

// List channels for a server
channelsRouter.get('/:serverId', (req, res) => {
  const db = getDb();
  const membership = db.prepare(
    'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(req.params.serverId, req.user!.id);

  if (!membership) {
    res.status(403).json({ error: 'Not a member of this server' });
    return;
  }

  const channels = db.prepare(`
    SELECT id, server_id as serverId, name, type, created_at as createdAt
    FROM channels
    WHERE server_id = ?
    ORDER BY created_at ASC
  `).all(req.params.serverId);

  res.json({ channels });
});

// Create a channel
channelsRouter.post('/:serverId', (req, res) => {
  const { name, type } = req.body;

  if (!name || name.length < 1 || name.length > 64) {
    res.status(400).json({ error: 'Channel name must be 1-64 characters' });
    return;
  }

  if (type !== 'text' && type !== 'voice') {
    res.status(400).json({ error: 'Channel type must be text or voice' });
    return;
  }

  const db = getDb();
  const membership = db.prepare(
    'SELECT role FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(req.params.serverId, req.user!.id) as { role: string } | undefined;

  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const id = nanoid();
  const createdAt = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO channels (id, server_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)').run(id, req.params.serverId, name, type, createdAt);

  const channel = { id, serverId: req.params.serverId, name, type, createdAt };
  broadcastToServer(req.params.serverId, 'channel:created', { channel });
  res.status(201).json(channel);
});

// Delete a channel (admin only)
channelsRouter.delete('/:channelId', (req, res) => {
  const db = getDb();

  const channel = db.prepare(
    'SELECT id, server_id, name, type FROM channels WHERE id = ?'
  ).get(req.params.channelId) as { id: string; server_id: string; name: string; type: string } | undefined;

  if (!channel) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  const membership = db.prepare(
    'SELECT role FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(channel.server_id, req.user!.id) as { role: string } | undefined;

  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  // Protect the last text channel
  if (channel.type === 'text') {
    const textCount = db.prepare(
      "SELECT COUNT(*) as count FROM channels WHERE server_id = ? AND type = 'text'"
    ).get(channel.server_id) as { count: number };

    if (textCount.count <= 1) {
      res.status(400).json({ error: 'Cannot delete the last text channel' });
      return;
    }
  }

  db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.channelId);

  broadcastToServer(channel.server_id, 'channel:deleted', {
    channelId: req.params.channelId,
    serverId: channel.server_id,
  });

  res.json({ ok: true });
});
