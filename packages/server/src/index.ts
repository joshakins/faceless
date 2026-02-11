import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';
import { initDb } from './db/index.js';
import { createWsServer } from './ws/handler.js';
import { authRouter } from './routes/auth.js';
import { serversRouter } from './routes/servers.js';
import { channelsRouter } from './routes/channels.js';
import { messagesRouter } from './routes/messages.js';
import { voiceRouter } from './routes/voice.js';
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

// Protected routes
app.use('/api/servers', sessionMiddleware, serversRouter);
app.use('/api/channels', sessionMiddleware, channelsRouter);
app.use('/api/messages', sessionMiddleware, messagesRouter);
app.use('/api/voice', sessionMiddleware, voiceRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket
createWsServer(server);

server.listen(PORT, HOST, () => {
  console.log(`Faceless API server running on ${HOST}:${PORT}`);
});
