import { Router } from 'express';
import { register, login, me, logout, logoutAll } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../lib/async-handler.js';
import { rateLimit } from '../middlewares/rate-limit.js';

const router = Router();

router.post('/register', rateLimit('register'), asyncHandler(register));
router.post('/login', rateLimit('loginFailures'), asyncHandler(login));
router.get('/me', authMiddleware, asyncHandler(me));
router.post('/logout', asyncHandler(logout));
router.post('/logout-all', authMiddleware, asyncHandler(logoutAll));

export default router;
