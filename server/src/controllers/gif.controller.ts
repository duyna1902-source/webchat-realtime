import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { fetchTrendingGifs, searchGifs } from '../services/gif.service.js';
import { getServerContext } from '../context.js';

export async function getTrendingGifs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const limitParam = parseInt(req.query.limit as string, 10);
  const limit = isNaN(limitParam) || limitParam <= 0 ? 20 : Math.min(limitParam, 50);
  const gifs = await fetchTrendingGifs(getServerContext(req).config.giphyApiKey, limit);
  res.status(200).json(gifs);
}

export async function searchGifsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const limitParam = parseInt(req.query.limit as string, 10);
  const limit = isNaN(limitParam) || limitParam <= 0 ? 20 : Math.min(limitParam, 50);
  const gifs = await searchGifs(getServerContext(req).config.giphyApiKey, query, limit);
  res.status(200).json(gifs);
}
