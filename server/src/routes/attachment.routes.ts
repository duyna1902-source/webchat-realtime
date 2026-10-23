import { Router } from 'express';
import { getAttachmentUrl } from '../controllers/attachment.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

router.use(authMiddleware);
router.get('/:id/url', asyncHandler(getAttachmentUrl));

export default router;
