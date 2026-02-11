import { Router, type IRouter } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';

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
  const server = db.prepare(
    'SELECT owner_id FROM servers WHERE id = ?'
  ).get(req.params.serverId) as { owner_id: string } | undefined;

  if (!server || server.owner_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the server owner can create channels' });
    return;
  }

  const id = nanoid();
  db.prepare('INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)').run(id, req.params.serverId, name, type);

  res.status(201).json({ id, serverId: req.params.serverId, name, type });
});
