# 04: Quản trị Phòng Chat & Nhắn tin Nhóm (Room Chat & Membership)

**What to build:**
Chức năng trò chuyện nhóm hoàn chỉnh theo phòng (Room Chat). Người dùng có thể tạo phòng chat mới và tự động nhận vai trò `OWNER`. Chủ phòng (`OWNER`) và quản trị viên (`ADMIN`) có quyền mời/thêm người dùng khác vào phòng. `OWNER` có quyền nâng/hạ quyền quản trị viên, xóa thành viên bất kỳ và giải tán phòng. `ADMIN` có thể xóa thành viên thường (`MEMBER`). `MEMBER` có thể xem danh sách thành viên và tự rời phòng. Mọi thành viên trong phòng có thể gửi tin nhắn nhóm `Room Message` (`room:send` / `room:receive`) và xem lịch sử phòng chat.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** resolved

- [x] API tạo Room Chat mới (`POST /api/rooms`) gán người tạo với vai trò `OWNER` trong bảng `RoomMember`.
- [x] API lấy danh sách các Room mà người dùng tham gia (`GET /api/rooms`).
- [x] API quản lý thành viên: Thêm thành viên (`POST /api/rooms/:id/members`), xóa thành viên (`DELETE /api/rooms/:id/members/:userId`), đổi quyền (`PATCH /api/rooms/:id/members/:userId/role`), và tự rời phòng (`POST /api/rooms/:id/leave`).
- [x] Logic phân quyền kiểm tra chặt chẽ quyền hạn của `OWNER`, `ADMIN`, `MEMBER` trước khi thực hiện thao tác quản trị.
- [x] Sự kiện Socket.io `room:join` và `room:leave` đưa socket vào room tương ứng (`socket.join(roomId)`).
- [x] Sự kiện Socket.io `room:send` lưu tin nhắn vào bảng `RoomMessage` và phát `room:receive` tới toàn bộ các socket đang tham gia phòng đó.
- [x] Sự kiện `room:member_change` thông báo cập nhật danh sách thành viên trong phòng theo thời gian thực.
- [x] Giao diện Modal tạo phòng, danh sách phòng chat, bảng xem thành viên với các nút chức năng quản trị tương ứng theo vai trò.
- [x] Kiểm thử tích hợp xác nhận đầy đủ các luồng: tạo phòng, thêm/xóa thành viên có phân quyền, và phát tán tin nhắn nhóm.

## Answer

Ticket 04 has been successfully implemented, fully verified with 87 automated tests (70 server, 17 client), clean production build, and merged into `integration/webchat-realtime`.

### Key Deliverables & Implementation Details:
1. **Room Management & Membership Governance REST API (`server/src/controllers/room.controller.ts`, `server/src/routes/room.routes.ts`)**:
   - `POST /api/rooms`: Creates a new Room and automatically assigns the creator as `OWNER` in `RoomMember`.
   - `GET /api/rooms`: Returns all rooms the authenticated user is currently a member of, along with member counts, user role, and latest message snippet.
   - `GET /api/rooms/:id`: Returns room metadata, members list with profile details and roles.
   - `POST /api/rooms/:id/members`: Adds a user to the room with strict role checks (restricted to `OWNER` and `ADMIN`).
   - `DELETE /api/rooms/:id/members/:userId`: Removes a member with granular permission enforcement:
     - `OWNER` can remove any `ADMIN` or `MEMBER`.
     - `ADMIN` can only remove `MEMBER`.
     - `OWNER` cannot be removed.
   - `PATCH /api/rooms/:id/members/:userId/role`: Promotes or demotes member roles (`ADMIN` <-> `MEMBER`), strictly restricted to `OWNER`.
   - `POST /api/rooms/:id/leave`: Allows `MEMBER` and `ADMIN` to leave the room. Prevents `OWNER` from leaving unless room ownership is transferred or room is deleted.
   - `DELETE /api/rooms/:id`: Allows the `OWNER` to dissolve/delete the room and cascade-delete messages and memberships.
   - `GET /api/rooms/:id/messages`: Fetches chronological message history (latest 50 messages) for verified room members.

2. **Real-time Socket.io Room Handler (`server/src/socket/room.handler.ts`)**:
   - `room:join`: Verifies room membership in the database and subscribes socket to `room:${roomId}`.
   - `room:leave`: Unsubscribes socket from `room:${roomId}`.
   - `room:send` (`RoomSendMessagePayload`): Verifies sender is an active room member, persists message to `RoomMessage` table, and broadcasts `room:receive` (`RoomReceiveMessagePayload`) to all sockets in `room:${roomId}`.
   - Emits `room:member_change` events upon member additions, role modifications, member removals, and leaves so clients update their member roster in real time.

3. **Client UI & Hooks (`client/src/`)**:
   - `useRooms`: Fetches and caches joined rooms, active room selection, and updates on room creation/membership changes.
   - `useRoomMessages`: Fetches historical room messages, listens to `room:receive` and `room:member_change`, manages auto-scroll, and emits `room:send`.
   - `Sidebar`: Tabbed navigation switching between "Direct Chats" and "Rooms", unread count indicators, and "New Room" creation button.
   - `CreateRoomModal`: Dialog for creating new rooms with name and optional description.
   - `RoomChatArea`: Group chat area displaying author names, role badges (`OWNER`, `ADMIN`, `MEMBER`), timestamps, message input with Enter-to-send, and header with room details and "Members" modal trigger.
   - `RoomMembersModal`: Roster of room members with their roles, add-member input with autocompletion/search, role update actions (promote/demote), member removal buttons according to user privileges, and "Leave Room" button.

4. **Comprehensive Automated Tests**:
   - `server/tests/room.test.ts`: 29 tests covering room creation, listing, member addition, role promotion/demotion, member deletion permissions, leaving, dissolution, message pagination, and security boundaries.
   - `server/tests/room-socket.test.ts`: 4 tests validating socket authorization on join, message broadcasting (`room:send` -> `room:receive`), unauthorized sender rejection, and leave cleanup.
   - `client/src/components/room/RoomChat.test.tsx`: 4 unit tests verifying room switching, message display with author badge, message sending, and members modal opening.
   - Total test suite: 87 passing tests (70 server, 17 client).

5. **Merge**:
   - Merged into `integration/webchat-realtime` in merge commit `f9ef0ba`.
   - Feature branch commit: `a16e089`.

