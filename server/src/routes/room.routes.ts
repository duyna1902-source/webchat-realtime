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

const router = Router();

router.use(authMiddleware);

router.post('/', createRoom);
router.get('/', getRooms);
router.get('/:id', getRoomById);
router.delete('/:id', deleteRoom);

router.post('/:id/members', addRoomMember);
router.delete('/:id/members/:userId', removeRoomMember);
router.patch('/:id/members/:userId/role', changeRoomMemberRole);
router.post('/:id/leave', leaveRoom);

router.get('/:id/messages', getRoomMessages);

export default router;
