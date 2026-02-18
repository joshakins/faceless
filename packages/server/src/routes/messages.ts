import { Router, type IRouter } from 'express';
import { getDb } from '../db/index.js';

export const messagesRouter: IRouter = Router();

interface MessageRow {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: number;
  authorUsername: string;
  authorAvatarUrl: string | null;
  attachmentId: string | null;
  attachmentFilename: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
  attachmentPath: string | null;
  gifUrl: string | null;
}

function mapRows(rows: MessageRow[]) {
  return rows.map((row) => ({
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    content: row.content,
    createdAt: row.createdAt,
    authorUsername: row.authorUsername,
    authorAvatarUrl: row.authorAvatarUrl,
    attachment: row.attachmentId
      ? {
          id: row.attachmentId,
          messageId: row.id,
          filename: row.attachmentFilename!,
          mimeType: row.attachmentMimeType!,
          size: row.attachmentSize!,
          url: `/api/files/${row.attachmentPath}`,
        }
      : null,
    gifUrl: row.gifUrl,
  }));
}

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

  let rows: MessageRow[];
  if (before) {
    rows = db.prepare(`
      SELECT m.id, m.channel_id as channelId, m.author_id as authorId,
             m.content, m.created_at as createdAt,
             u.username as authorUsername, u.avatar_url as authorAvatarUrl,
             a.id as attachmentId, a.filename as attachmentFilename,
             a.mime_type as attachmentMimeType, a.size as attachmentSize,
             a.storage_path as attachmentPath,
             m.gif_url as gifUrl
      FROM messages m
      JOIN users u ON u.id = m.author_id
      LEFT JOIN attachments a ON a.message_id = m.id
      WHERE m.channel_id = ? AND m.created_at < ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(req.params.channelId, before, limit) as MessageRow[];
  } else {
    rows = db.prepare(`
      SELECT m.id, m.channel_id as channelId, m.author_id as authorId,
             m.content, m.created_at as createdAt,
             u.username as authorUsername, u.avatar_url as authorAvatarUrl,
             a.id as attachmentId, a.filename as attachmentFilename,
             a.mime_type as attachmentMimeType, a.size as attachmentSize,
             a.storage_path as attachmentPath,
             m.gif_url as gifUrl
      FROM messages m
      JOIN users u ON u.id = m.author_id
      LEFT JOIN attachments a ON a.message_id = m.id
      WHERE m.channel_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(req.params.channelId, limit) as MessageRow[];
  }

  res.json({ messages: mapRows(rows).reverse() });
});
