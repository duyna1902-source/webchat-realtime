import { Router } from 'express';
import { uploadFile } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadSingleFile } from '../middlewares/upload.middleware.js';
import { asyncHandler } from '../lib/async-handler.js';
import { rateLimit } from '../middlewares/rate-limit.js';

const router = Router();

router.use(authMiddleware);
// Rate limit before parsing the file, so rejected uploads cost nothing.
router.post('/', rateLimit('upload'), uploadSingleFile, asyncHandler(uploadFile));

export default router;
