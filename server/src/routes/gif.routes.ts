import { Router } from 'express';
import { getTrendingGifs, searchGifsHandler } from '../controllers/gif.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/trending', getTrendingGifs);
router.get('/search', searchGifsHandler);

export default router;
