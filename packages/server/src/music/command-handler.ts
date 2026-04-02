import { getDb } from '../db/index.js';
import { sendToUser } from '../ws/handler.js';
import { queueController } from './queue-controller.js';

interface SocketInfo {
  userId: string;
  username: string;
}

/**
 * Handle incoming music WebSocket commands.
 * Validates channel access and permissions before delegating to the queue controller.
 */
export function handleMusicCommand(
  socket: SocketInfo,
  event: string,
  data: Record<string, unknown>,
): void {
  const channelId = data.channelId as string | undefined;
  if (!channelId) return;

  const db = getDb();

  // Verify voice channel access and get server membership info
  const membership = db.prepare(`
    SELECT c.server_id, sm.role FROM channels c
    JOIN server_members sm ON sm.server_id = c.server_id
    WHERE c.id = ? AND sm.user_id = ? AND c.type = 'voice'
  `).get(channelId, socket.userId) as { server_id: string; role: string } | undefined;

  if (!membership) {
    sendToUser(socket.userId, 'music:error', {
      channelId,
      message: 'Voice channel not found or no access',
    });
    return;
  }

  const isAdmin = membership.role === 'admin';

  switch (event) {
    case 'music:play': {
      const url = data.url as string | undefined;
      if (!url?.trim()) {
        sendToUser(socket.userId, 'music:error', {
          channelId,
          message: 'URL or search query is required',
        });
        return;
      }
      // Any member can add tracks to the queue
      queueController.play(channelId, membership.server_id, url.trim(), socket.userId, socket.username);
      break;
    }

    case 'music:skip':
    case 'music:stop':
    case 'music:pause':
    case 'music:resume': {
      // Only admin or the person who requested the current track
      const requester = queueController.getCurrentTrackRequester(channelId);
      if (!isAdmin && requester !== socket.userId) {
        sendToUser(socket.userId, 'music:error', {
          channelId,
          message: 'Only admins or the track requester can control playback',
        });
        return;
      }

      if (event === 'music:skip') queueController.skip(channelId);
      else if (event === 'music:stop') queueController.stop(channelId);
      else if (event === 'music:pause') {
        if (!queueController.pause(channelId)) {
          sendToUser(socket.userId, 'music:error', { channelId, message: 'Nothing is playing' });
        }
      } else if (event === 'music:resume') {
        if (!queueController.resume(channelId)) {
          sendToUser(socket.userId, 'music:error', { channelId, message: 'Nothing is paused' });
        }
      }
      break;
    }
  }
}
