import { Router } from 'express';
import { createOrGetDirectChat, getDirectChats, getDirectChatMessages } from '../controllers/direct-chat.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

router.use(authMiddleware);
router.post('/', asyncHandler(createOrGetDirectChat));
router.get('/', asyncHandler(getDirectChats));
router.get('/:id/messages', asyncHandler(getDirectChatMessages));

export default router;
