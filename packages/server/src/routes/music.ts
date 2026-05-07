import { Router, type IRouter } from 'express';
import { validateSession } from '../auth/sessions.js';
import { getDb } from '../db/index.js';
import { queueController } from '../music/queue-controller.js';
import { createBrowserAudioStream } from '../music/audio-pipeline.js';

export const musicRouter: IRouter = Router();

musicRouter.get('/stream/:trackId', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const session = token ? validateSession(token) : null;
  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const stream = queueController.getTrackStream(req.params.trackId);
  if (!stream) {
    res.status(404).json({ error: 'Track stream not found' });
    return;
  }

  const db = getDb();
  const member = db.prepare(
    'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?'
  ).get(stream.serverId, session.userId) as { 1: number } | undefined;
  if (!member) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const pipeline = createBrowserAudioStream(stream.streamUrl);
  let responseStarted = false;

  res.status(200);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'audio/mpeg');

  res.on('close', () => pipeline.cleanup());

  pipeline.ffmpegProcess.on('close', (code) => {
    if (!responseStarted && code !== 0 && !res.headersSent) {
      res.status(502).json({ error: 'Could not transcode track stream' });
    }
  });

  pipeline.pcmStream.once('data', (chunk: Buffer) => {
    responseStarted = true;
    res.write(chunk);
    pipeline.pcmStream.pipe(res);
  });
});
