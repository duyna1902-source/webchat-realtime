import { Router } from 'express';
import { getUsers } from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../lib/async-handler.js';
import { rateLimit } from '../middlewares/rate-limit.js';

const router = Router();

router.use(authMiddleware);
router.get('/', rateLimit('userSearch'), asyncHandler(getUsers));

export default router;
