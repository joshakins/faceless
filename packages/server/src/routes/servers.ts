import { Router, type IRouter } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import { createInviteCode, consumeInviteCode } from '../auth/invites.js';

export const serversRouter: IRouter = Router();

// Create a server
serversRouter.post('/', (req, res) => {
  const { name } = req.body;
  const userId = req.user!.id;

  if (!name || name.length < 1 || name.length > 64) {
    res.status(400).json({ error: 'Server name must be 1-64 characters' });
    return;
  }

  const db = getDb();
  const id = nanoid();

  db.transaction(() => {
    db.prepare('INSERT INTO servers (id, name, owner_id) VALUES (?, ?, ?)').run(id, name, userId);
    db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(id, userId);
    // Create default text channel
    db.prepare('INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)').run(nanoid(), id, 'general', 'text');
    // Create default voice channel
    db.prepare('INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)').run(nanoid(), id, 'Voice', 'voice');
  })();

  res.status(201).json({ id, name, ownerId: userId });
});

// List servers the user is a member of
serversRouter.get('/', (req, res) => {
  const db = getDb();
  const servers = db.prepare(`
    SELECT s.id, s.name, s.owner_id as ownerId, s.created_at as createdAt
    FROM servers s
    JOIN server_members sm ON sm.server_id = s.id
    WHERE sm.user_id = ?
    ORDER BY s.created_at ASC
  `).all(req.user!.id);

  res.json({ servers });
});

// Get server details
serversRouter.get('/:serverId', (req, res) => {
  const db = getDb();
  const server = db.prepare(`
    SELECT s.id, s.name, s.owner_id as ownerId, s.created_at as createdAt
    FROM servers s
    JOIN server_members sm ON sm.server_id = s.id
    WHERE s.id = ? AND sm.user_id = ?
  `).get(req.params.serverId, req.user!.id);

  if (!server) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }

  res.json({ server });
});

// Create invite code for a server
serversRouter.post('/:serverId/invites', (req, res) => {
  const db = getDb();
  const membership = db.prepare(
    'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(req.params.serverId, req.user!.id);

  if (!membership) {
    res.status(403).json({ error: 'Not a member of this server' });
    return;
  }

  const code = createInviteCode(req.params.serverId, req.user!.id);
  res.status(201).json({ code });
});

// Join a server via invite code
serversRouter.post('/join', (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: 'Invite code required' });
    return;
  }

  const result = consumeInviteCode(code);
  if (!result) {
    res.status(400).json({ error: 'Invalid or expired invite code' });
    return;
  }

  const db = getDb();
  const existing = db.prepare(
    'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(result.serverId, req.user!.id);

  if (existing) {
    res.json({ serverId: result.serverId, alreadyMember: true });
    return;
  }

  db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(result.serverId, req.user!.id);
  res.status(201).json({ serverId: result.serverId, alreadyMember: false });
});

// Delete a server (owner only)
serversRouter.delete('/:serverId', (req, res) => {
  const db = getDb();
  const server = db.prepare('SELECT owner_id FROM servers WHERE id = ?').get(req.params.serverId) as { owner_id: string } | undefined;

  if (!server) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }

  if (server.owner_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the server owner can delete a server' });
    return;
  }

  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.serverId);
  res.json({ ok: true });
});

// Get server members
serversRouter.get('/:serverId/members', (req, res) => {
  const db = getDb();
  const membership = db.prepare(
    'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(req.params.serverId, req.user!.id);

  if (!membership) {
    res.status(403).json({ error: 'Not a member of this server' });
    return;
  }

  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar_url as avatarUrl, sm.joined_at as joinedAt
    FROM users u
    JOIN server_members sm ON sm.user_id = u.id
    WHERE sm.server_id = ?
    ORDER BY sm.joined_at ASC
  `).all(req.params.serverId);

  res.json({ members });
});
