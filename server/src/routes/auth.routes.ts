import { Router } from 'express';
import { getAuthConfig, register, login, me, logout, logoutAll } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../lib/async-handler.js';
import { rateLimit } from '../middlewares/rate-limit.js';
import { requireTurnstile } from '../middlewares/turnstile.js';

const router = Router();

router.get('/config', asyncHandler(getAuthConfig));
// Rate limit first: a bot spraying bad tokens is capped before each one costs a call to Cloudflare.
router.post('/register', rateLimit('register'), requireTurnstile(), asyncHandler(register));
router.post('/login', rateLimit('loginFailures'), requireTurnstile(), asyncHandler(login));
router.get('/me', authMiddleware, asyncHandler(me));
router.post('/logout', asyncHandler(logout));
router.post('/logout-all', authMiddleware, asyncHandler(logoutAll));

export default router;
