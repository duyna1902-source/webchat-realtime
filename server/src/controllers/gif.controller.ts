import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { fetchTrendingGifs, searchGifs } from '../services/gif.service.js';

export async function getTrendingGifs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 20 : Math.min(limitParam, 50);
    const gifs = await fetchTrendingGifs(limit);
    res.status(200).json(gifs);
  } catch (err: any) {
    console.error('Error in getTrendingGifs:', err);
    res.status(500).json({ message: 'Internal server error fetching trending GIFs' });
  }
}

export async function searchGifsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 20 : Math.min(limitParam, 50);
    const gifs = await searchGifs(query, limit);
    res.status(200).json(gifs);
  } catch (err: any) {
    console.error('Error in searchGifsHandler:', err);
    res.status(500).json({ message: 'Internal server error searching GIFs' });
  }
}
