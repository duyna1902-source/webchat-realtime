import { Router } from 'express';
import { getTrendingGifs, searchGifsHandler } from '../controllers/gif.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

router.use(authMiddleware);
router.get('/trending', asyncHandler(getTrendingGifs));
router.get('/search', asyncHandler(searchGifsHandler));

export default router;
