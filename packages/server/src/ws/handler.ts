import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { getDb } from '../db/index.js';
import { nanoid } from 'nanoid';
import type { WsMessage, ClientEventName, ClientEvents } from '@faceless/shared';
import { presenceTracker } from './presence.js';
import { validateSession } from '../auth/sessions.js';

interface AuthenticatedSocket extends WebSocket {
  userId: string;
  username: string;
  sessionId: string;
  isAlive: boolean;
}

const clients = new Map<string, Set<AuthenticatedSocket>>();

export function getClientsForUser(userId: string): Set<AuthenticatedSocket> | undefined {
  return clients.get(userId);
}

export function broadcastToChannel(channelId: string, event: string, data: unknown, excludeUserId?: string): void {
  const db = getDb();
  // Get all members of the server this channel belongs to
  const members = db.prepare(`
    SELECT sm.user_id FROM server_members sm
    JOIN channels c ON c.server_id = sm.server_id
    WHERE c.id = ?
  `).all(channelId) as { user_id: string }[];

  for (const member of members) {
    if (member.user_id === excludeUserId) continue;
    const sockets = clients.get(member.user_id);
    if (sockets) {
      const message = JSON.stringify({ event, data });
      for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(message);
        }
      }
    }
  }
}

function getUserServerIds(userId: string): string[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT server_id FROM server_members WHERE user_id = ?'
  ).all(userId) as { server_id: string }[];
  return rows.map(r => r.server_id);
}

function broadcastToServer(serverId: string, event: string, data: unknown, excludeUserId?: string): void {
  const db = getDb();
  const members = db.prepare(
    'SELECT user_id FROM server_members WHERE server_id = ?'
  ).all(serverId) as { user_id: string }[];

  const message = JSON.stringify({ event, data });
  for (const member of members) {
    if (member.user_id === excludeUserId) continue;
    const sockets = clients.get(member.user_id);
    if (sockets) {
      for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(message);
        }
      }
    }
  }
}

export function createWsServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      const socket = ws as AuthenticatedSocket;
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  wss.on('connection', (ws: WebSocket, req) => {
    const socket = ws as AuthenticatedSocket;
    socket.isAlive = true;

    // Authenticate via token query parameter
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) {
      socket.close(4001, 'No auth token');
      return;
    }

    const session = validateSession(token);
    if (!session) {
      socket.close(4001, 'Invalid session');
      return;
    }

    socket.userId = session.userId;
    socket.username = session.username;
    socket.sessionId = session.sessionId;

    // Track connection
    if (!clients.has(socket.userId)) {
      clients.set(socket.userId, new Set());
    }
    clients.get(socket.userId)!.add(socket);
    presenceTracker.setOnline(socket.userId);

    // Broadcast online status to all server members (including self)
    const userServers = getUserServerIds(socket.userId);
    for (const serverId of userServers) {
      broadcastToServer(serverId, 'presence:update', {
        userId: socket.userId,
        status: 'online',
        voiceChannelId: null,
      });
    }

    // Send initial presence sync — tell this user who is already online
    const coMemberIds = new Set<string>();
    const db = getDb();
    for (const serverId of userServers) {
      const members = db.prepare(
        'SELECT user_id FROM server_members WHERE server_id = ?'
      ).all(serverId) as { user_id: string }[];
      for (const m of members) {
        if (m.user_id !== socket.userId) coMemberIds.add(m.user_id);
      }
    }
    for (const memberId of coMemberIds) {
      const presence = presenceTracker.getPresence(memberId);
      if (presence.status !== 'offline') {
        socket.send(JSON.stringify({
          event: 'presence:update',
          data: {
            userId: presence.userId,
            status: presence.status,
            voiceChannelId: presence.voiceChannelId,
          },
        }));
      }
    }

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());
        handleClientEvent(socket, msg.event as ClientEventName, msg.data as ClientEvents[ClientEventName]);
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      const userSockets = clients.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          clients.delete(socket.userId);
          presenceTracker.setOffline(socket.userId);

          // Broadcast offline status to all server members
          const offlineServers = getUserServerIds(socket.userId);
          for (const serverId of offlineServers) {
            broadcastToServer(serverId, 'presence:update', {
              userId: socket.userId,
              status: 'offline',
              voiceChannelId: null,
            });
          }
        }
      }
    });
  });

  return wss;
}

function handleClientEvent<E extends ClientEventName>(
  socket: AuthenticatedSocket,
  event: E,
  data: ClientEvents[E]
): void {
  const db = getDb();

  switch (event) {
    case 'message:send': {
      const { channelId, content, attachmentId, gifUrl } = data as ClientEvents['message:send'];
      if (!channelId) return;
      if (!content?.trim() && !attachmentId && !gifUrl) return;

      // Verify access
      const access = db.prepare(`
        SELECT 1 FROM channels c
        JOIN server_members sm ON sm.server_id = c.server_id
        WHERE c.id = ? AND sm.user_id = ?
      `).get(channelId, socket.userId);
      if (!access) return;

      const id = nanoid();
      const createdAt = Math.floor(Date.now() / 1000);
      db.prepare('INSERT INTO messages (id, channel_id, author_id, content, gif_url, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        id, channelId, socket.userId, content || '', gifUrl || null, createdAt
      );

      // Link attachment to message if provided
      let attachment = null;
      if (attachmentId) {
        const updated = db.prepare(
          'UPDATE attachments SET message_id = ? WHERE id = ? AND message_id IS NULL'
        ).run(id, attachmentId);

        if (updated.changes > 0) {
          const row = db.prepare(
            'SELECT id, message_id, filename, mime_type, size, storage_path FROM attachments WHERE id = ?'
          ).get(attachmentId) as { id: string; message_id: string; filename: string; mime_type: string; size: number; storage_path: string } | undefined;
          if (row) {
            attachment = {
              id: row.id,
              messageId: row.message_id,
              filename: row.filename,
              mimeType: row.mime_type,
              size: row.size,
              url: `/api/files/${row.storage_path}`,
            };
          }
        }
      }

      broadcastToChannel(channelId, 'message:new', {
        message: { id, channelId, authorId: socket.userId, content: content || '', createdAt, attachment, gifUrl: gifUrl || null },
        author: { id: socket.userId, username: socket.username, createdAt: 0 },
      });
      break;
    }

    case 'message:typing': {
      const { channelId } = data as ClientEvents['message:typing'];
      if (!channelId) return;
      broadcastToChannel(channelId, 'message:typing', {
        channelId,
        userId: socket.userId,
        username: socket.username,
      }, socket.userId);
      break;
    }

    default:
      break;
  }
}
