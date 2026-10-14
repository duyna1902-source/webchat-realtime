import { Router } from 'express';
import { createOrGetDirectChat, getDirectChats, getDirectChatMessages } from '../controllers/direct-chat.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.post('/', createOrGetDirectChat);
router.get('/', getDirectChats);
router.get('/:id/messages', getDirectChatMessages);

export default router;
