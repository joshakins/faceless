import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { initDb, getDb } from './db/index.js';
import { createWsServer } from './ws/handler.js';
import { authRouter } from './routes/auth.js';
import { serversRouter } from './routes/servers.js';
import { channelsRouter } from './routes/channels.js';
import { messagesRouter } from './routes/messages.js';
import { voiceRouter } from './routes/voice.js';
import { uploadsRouter, UPLOADS_DIR } from './routes/uploads.js';
import { gifsRouter } from './routes/gifs.js';
import { conversationsRouter } from './routes/conversations.js';
import { adminRouter } from './routes/admin.js';
import { sessionMiddleware } from './auth/sessions.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = createServer(app);

// Init database
initDb();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);

// Static file serving for uploads (capability URLs — no auth needed)
app.use('/api/files', express.static(UPLOADS_DIR));

// Protected routes
app.use('/api/servers', sessionMiddleware, serversRouter);
app.use('/api/channels', sessionMiddleware, channelsRouter);
app.use('/api/messages', sessionMiddleware, messagesRouter);
app.use('/api/voice', sessionMiddleware, voiceRouter);
app.use('/api/uploads', sessionMiddleware, uploadsRouter);
app.use('/api/gifs', sessionMiddleware, gifsRouter);
app.use('/api/conversations', sessionMiddleware, conversationsRouter);
app.use('/api/admin', sessionMiddleware, adminRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket
createWsServer(server);

// Cleanup orphaned uploads every hour
setInterval(() => {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - 3600;
  const orphans = db.prepare(
    'SELECT id, storage_path FROM attachments WHERE message_id IS NULL AND dm_id IS NULL AND created_at < ?'
  ).all(cutoff) as { id: string; storage_path: string }[];

  for (const orphan of orphans) {
    fs.unlink(path.join(UPLOADS_DIR, orphan.storage_path), () => {});
    db.prepare('DELETE FROM attachments WHERE id = ?').run(orphan.id);
  }
}, 60 * 60 * 1000);

server.listen(PORT, HOST, () => {
  console.log(`Faceless API server running on ${HOST}:${PORT}`);
});
