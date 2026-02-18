import { Router, type IRouter } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';

export const conversationsRouter: IRouter = Router();

interface ParticipantRow {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface DmRow {
  id: string;
  conversationId: string;
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

function mapDmRows(rows: DmRow[]) {
  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
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

// List conversations for the authenticated user
conversationsRouter.get('/', (req, res) => {
  const db = getDb();
  const userId = req.user!.id;

  // Get all conversation IDs the user participates in
  const convRows = db.prepare(`
    SELECT c.id, c.created_at as createdAt
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE cp.user_id = ?
  `).all(userId) as { id: string; createdAt: number }[];

  const conversations = convRows.map((conv) => {
    // Get participants
    const participants = db.prepare(`
      SELECT u.id, u.username, u.avatar_url as avatarUrl
      FROM users u
      JOIN conversation_participants cp ON cp.user_id = u.id
      WHERE cp.conversation_id = ?
    `).all(conv.id) as ParticipantRow[];

    // Get last message
    const lastMsg = db.prepare(`
      SELECT id, conversation_id as conversationId, author_id as authorId,
             content, created_at as createdAt
      FROM direct_messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(conv.id) as { id: string; conversationId: string; authorId: string; content: string; createdAt: number } | undefined;

    return {
      id: conv.id,
      participants,
      lastMessage: lastMsg || null,
      createdAt: conv.createdAt,
    };
  });

  // Sort by last message time (most recent first), fallback to createdAt
  conversations.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.createdAt;
    const bTime = b.lastMessage?.createdAt ?? b.createdAt;
    return bTime - aTime;
  });

  res.json({ conversations });
});

// Create or find a conversation
conversationsRouter.post('/', (req, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const { participantIds } = req.body as { participantIds: string[] };

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ error: 'participantIds must be a non-empty array' });
    return;
  }

  // Build full participant set (always include the requesting user)
  const allIds = Array.from(new Set([userId, ...participantIds]));

  // Only support 1-on-1 DMs (2 participants) or Note to Self (1 participant)
  if (allIds.length > 2) {
    res.status(400).json({ error: 'Only 1-on-1 DMs are supported' });
    return;
  }

  // Verify the other user exists (if not Note to Self)
  if (allIds.length === 2) {
    const otherId = allIds.find((id) => id !== userId)!;
    const otherUser = db.prepare('SELECT 1 FROM users WHERE id = ?').get(otherId);
    if (!otherUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
  }

  // Check if conversation already exists with exactly these participants
  let existingConvId: string | undefined;

  if (allIds.length === 1) {
    // Note to Self: find conversation with exactly 1 participant = this user
    const row = db.prepare(`
      SELECT cp.conversation_id
      FROM conversation_participants cp
      WHERE cp.conversation_id IN (
        SELECT conversation_id FROM conversation_participants
        GROUP BY conversation_id HAVING COUNT(*) = 1
      )
      AND cp.user_id = ?
    `).get(userId) as { conversation_id: string } | undefined;
    existingConvId = row?.conversation_id;
  } else {
    // 1-on-1: find conversation with exactly these 2 participants
    const row = db.prepare(`
      SELECT cp.conversation_id
      FROM conversation_participants cp
      WHERE cp.user_id IN (?, ?)
      GROUP BY cp.conversation_id
      HAVING COUNT(*) = 2
        AND COUNT(*) = (
          SELECT COUNT(*) FROM conversation_participants cp2
          WHERE cp2.conversation_id = cp.conversation_id
        )
    `).get(allIds[0], allIds[1]) as { conversation_id: string } | undefined;
    existingConvId = row?.conversation_id;
  }

  if (existingConvId) {
    // Return existing conversation
    const participants = db.prepare(`
      SELECT u.id, u.username, u.avatar_url as avatarUrl
      FROM users u
      JOIN conversation_participants cp ON cp.user_id = u.id
      WHERE cp.conversation_id = ?
    `).all(existingConvId) as ParticipantRow[];

    const conv = db.prepare(
      'SELECT created_at as createdAt FROM conversations WHERE id = ?'
    ).get(existingConvId) as { createdAt: number };

    const lastMsg = db.prepare(`
      SELECT id, conversation_id as conversationId, author_id as authorId,
             content, created_at as createdAt
      FROM direct_messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(existingConvId) as { id: string; conversationId: string; authorId: string; content: string; createdAt: number } | undefined;

    res.json({
      conversation: {
        id: existingConvId,
        participants,
        lastMessage: lastMsg || null,
        createdAt: conv.createdAt,
      },
    });
    return;
  }

  // Create new conversation
  const convId = nanoid();
  db.transaction(() => {
    db.prepare('INSERT INTO conversations (id) VALUES (?)').run(convId);
    for (const uid of allIds) {
      db.prepare(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)'
      ).run(convId, uid);
    }
  })();

  const participants = db.prepare(`
    SELECT u.id, u.username, u.avatar_url as avatarUrl
    FROM users u
    JOIN conversation_participants cp ON cp.user_id = u.id
    WHERE cp.conversation_id = ?
  `).all(convId) as ParticipantRow[];

  const conv = db.prepare(
    'SELECT created_at as createdAt FROM conversations WHERE id = ?'
  ).get(convId) as { createdAt: number };

  res.status(201).json({
    conversation: {
      id: convId,
      participants,
      lastMessage: null,
      createdAt: conv.createdAt,
    },
  });
});

// Get messages for a conversation (paginated)
conversationsRouter.get('/:conversationId/messages', (req, res) => {
  const db = getDb();
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before as string | undefined;

  // Verify membership
  const membership = db.prepare(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
  ).get(conversationId, userId);

  if (!membership) {
    res.status(403).json({ error: 'No access to this conversation' });
    return;
  }

  let rows: DmRow[];
  if (before) {
    rows = db.prepare(`
      SELECT dm.id, dm.conversation_id as conversationId, dm.author_id as authorId,
             dm.content, dm.created_at as createdAt,
             u.username as authorUsername, u.avatar_url as authorAvatarUrl,
             a.id as attachmentId, a.filename as attachmentFilename,
             a.mime_type as attachmentMimeType, a.size as attachmentSize,
             a.storage_path as attachmentPath,
             dm.gif_url as gifUrl
      FROM direct_messages dm
      JOIN users u ON u.id = dm.author_id
      LEFT JOIN attachments a ON a.dm_id = dm.id
      WHERE dm.conversation_id = ? AND dm.created_at < ?
      ORDER BY dm.created_at DESC
      LIMIT ?
    `).all(conversationId, before, limit) as DmRow[];
  } else {
    rows = db.prepare(`
      SELECT dm.id, dm.conversation_id as conversationId, dm.author_id as authorId,
             dm.content, dm.created_at as createdAt,
             u.username as authorUsername, u.avatar_url as authorAvatarUrl,
             a.id as attachmentId, a.filename as attachmentFilename,
             a.mime_type as attachmentMimeType, a.size as attachmentSize,
             a.storage_path as attachmentPath,
             dm.gif_url as gifUrl
      FROM direct_messages dm
      JOIN users u ON u.id = dm.author_id
      LEFT JOIN attachments a ON a.dm_id = dm.id
      WHERE dm.conversation_id = ?
      ORDER BY dm.created_at DESC
      LIMIT ?
    `).all(conversationId, limit) as DmRow[];
  }

  res.json({ messages: mapDmRows(rows).reverse() });
});
