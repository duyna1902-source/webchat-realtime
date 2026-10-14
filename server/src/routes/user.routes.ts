import { Router } from 'express';
import { getUsers } from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getUsers);

export default router;
