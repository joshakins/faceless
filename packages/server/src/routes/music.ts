import { Router, type IRouter } from 'express';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { validateSession } from '../auth/sessions.js';
import { getDb } from '../db/index.js';
import { queueController } from '../music/queue-controller.js';

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

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const upstream = await fetch(stream.streamUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      },
    });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({ error: `Upstream stream failed: HTTP ${upstream.status}` });
      return;
    }

    res.status(upstream.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-store');

    for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    if (!upstream.body) {
      res.status(502).json({ error: 'Upstream stream had no body' });
      return;
    }

    Readable.fromWeb(upstream.body as unknown as WebReadableStream<Uint8Array>).pipe(res);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    console.warn(`[Melody] Stream proxy failed: ${(err as Error).message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Could not proxy track stream' });
    }
  }
});
