import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { parse as parseCookie } from 'cookie';
import { getDb } from '../db/index.js';
import { nanoid } from 'nanoid';
import type { WsMessage, ClientEventName, ClientEvents } from '@faceless/shared';
import { presenceTracker } from './presence.js';

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

    // Authenticate via cookie
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      socket.close(4001, 'No session cookie');
      return;
    }

    const cookies = parseCookie(cookieHeader);
    const sessionId = cookies.session;
    if (!sessionId) {
      socket.close(4001, 'No session cookie');
      return;
    }

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare(`
      SELECT s.id as session_id, u.id as user_id, u.username
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(sessionId, now) as { session_id: string; user_id: string; username: string } | undefined;

    if (!row) {
      socket.close(4001, 'Invalid session');
      return;
    }

    socket.userId = row.user_id;
    socket.username = row.username;
    socket.sessionId = row.session_id;

    // Track connection
    if (!clients.has(socket.userId)) {
      clients.set(socket.userId, new Set());
    }
    clients.get(socket.userId)!.add(socket);
    presenceTracker.setOnline(socket.userId);

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
      const { channelId, content } = data as ClientEvents['message:send'];
      if (!content || !channelId) return;

      // Verify access
      const access = db.prepare(`
        SELECT 1 FROM channels c
        JOIN server_members sm ON sm.server_id = c.server_id
        WHERE c.id = ? AND sm.user_id = ?
      `).get(channelId, socket.userId);
      if (!access) return;

      const id = nanoid();
      const createdAt = Math.floor(Date.now() / 1000);
      db.prepare('INSERT INTO messages (id, channel_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id, channelId, socket.userId, content, createdAt
      );

      broadcastToChannel(channelId, 'message:new', {
        message: { id, channelId, authorId: socket.userId, content, createdAt },
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
