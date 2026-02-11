import { Router, type IRouter } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { getDb } from '../db/index.js';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'devsecretdevsecretdevsecret12345';
const LIVEKIT_PORT = process.env.LIVEKIT_PORT || '7880';
const LIVEKIT_URL = process.env.LIVEKIT_URL || ''; // If set, use as-is; otherwise derive from request host

export const voiceRouter: IRouter = Router();

// Get a LiveKit token to join a voice channel
voiceRouter.post('/token', async (req, res) => {
  const { channelId } = req.body;

  if (!channelId) {
    res.status(400).json({ error: 'channelId required' });
    return;
  }

  const db = getDb();

  // Verify channel is a voice channel and user has access
  const channel = db.prepare(`
    SELECT c.id, c.name, c.type, c.server_id FROM channels c
    JOIN server_members sm ON sm.server_id = c.server_id
    WHERE c.id = ? AND sm.user_id = ? AND c.type = 'voice'
  `).get(channelId, req.user!.id) as { id: string; name: string; type: string; server_id: string } | undefined;

  if (!channel) {
    res.status(403).json({ error: 'Voice channel not found or no access' });
    return;
  }

  // Room name = channel ID
  const roomName = channelId;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: req.user!.id,
    name: req.user!.username,
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await token.toJwt();

  // If LIVEKIT_URL is explicitly set, use it. Otherwise derive from the request
  // hostname so LAN clients get the right address automatically.
  let livekitUrl = LIVEKIT_URL;
  if (!livekitUrl) {
    const host = req.hostname; // e.g. '192.168.1.50' or 'localhost'
    livekitUrl = `ws://${host}:${LIVEKIT_PORT}`;
  }

  res.json({ token: jwt, url: livekitUrl });
});
