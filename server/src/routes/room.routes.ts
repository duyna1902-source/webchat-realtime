import { Router } from 'express';
import {
  createRoom,
  getRooms,
  getRoomById,
  deleteRoom,
  addRoomMember,
  removeRoomMember,
  changeRoomMemberRole,
  leaveRoom,
  getRoomMessages,
} from '../controllers/room.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router();

router.use(authMiddleware);

router.post('/', asyncHandler(createRoom));
router.get('/', asyncHandler(getRooms));
router.get('/:id', asyncHandler(getRoomById));
router.delete('/:id', asyncHandler(deleteRoom));

router.post('/:id/members', asyncHandler(addRoomMember));
router.delete('/:id/members/:userId', asyncHandler(removeRoomMember));
router.patch('/:id/members/:userId/role', asyncHandler(changeRoomMemberRole));
router.post('/:id/leave', asyncHandler(leaveRoom));

router.get('/:id/messages', asyncHandler(getRoomMessages));

export default router;
