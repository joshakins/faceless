import { Router, type IRouter } from 'express';

const KLIPY_API_KEY = process.env.KLIPY_API_KEY || '';
const KLIPY_BASE_URL = 'https://api.klipy.com/api/v1';

export const gifsRouter: IRouter = Router();

// GET /api/gifs/trending
gifsRouter.get('/trending', async (req, res) => {
  if (!KLIPY_API_KEY) {
    res.status(503).json({ error: 'GIF service not configured' });
    return;
  }

  const perPage = parseInt(req.query.per_page as string) || 24;
  const customerId = req.user!.id;

  try {
    const url = `${KLIPY_BASE_URL}/${KLIPY_API_KEY}/gifs/trending?per_page=${perPage}&customer_id=${encodeURIComponent(customerId)}`;
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: 'GIF service error' });
      return;
    }
    const body = await response.json();
    res.json(body);
  } catch {
    res.status(502).json({ error: 'Failed to fetch GIFs' });
  }
});

// GET /api/gifs/search?q=funny
gifsRouter.get('/search', async (req, res) => {
  if (!KLIPY_API_KEY) {
    res.status(503).json({ error: 'GIF service not configured' });
    return;
  }

  const query = req.query.q as string;
  if (!query?.trim()) {
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  const perPage = parseInt(req.query.per_page as string) || 24;
  const customerId = req.user!.id;

  try {
    const url = `${KLIPY_BASE_URL}/${KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(query)}&per_page=${perPage}&customer_id=${encodeURIComponent(customerId)}`;
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: 'GIF service error' });
      return;
    }
    const body = await response.json();
    res.json(body);
  } catch {
    res.status(502).json({ error: 'Failed to fetch GIFs' });
  }
});
