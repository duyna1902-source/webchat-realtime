import { Router } from 'express';
import { uploadFile } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadSingleFile } from '../middlewares/upload.middleware.js';

const router = Router();

router.use(authMiddleware);
router.post('/', uploadSingleFile, uploadFile);

export default router;
