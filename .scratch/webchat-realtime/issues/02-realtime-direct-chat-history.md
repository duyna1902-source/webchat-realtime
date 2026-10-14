# 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**What to build:**
Chức năng trò chuyện trực tiếp 1-1 theo thời gian thực giữa hai người dùng độc lập. Người dùng có thể tìm kiếm hoặc chọn một người dùng khác từ danh sách để bắt đầu Direct Chat, gửi tin nhắn văn bản tức thời qua kết nối Socket.io hai chiều (`direct:send` / `direct:receive`), và xem lịch sử tin nhắn được tải lại tự động từ cơ sở dữ liệu khi mở lại cuộc trò chuyện (mặc định tải 50 tin nhắn gần nhất).

**Blocked by:** 01: Thiết lập Monorepo, Schema Cơ sở dữ liệu Toàn diện & Xác thực Người dùng (Auth Tracer Bullet)

**Status:** resolved

- [x] API danh sách người dùng (`GET /api/users`) cho phép tìm kiếm và xem danh sách người dùng khả dụng để nhắn tin.
- [x] API tạo hoặc lấy Direct Chat giữa hai người dùng (`POST /api/direct-chats`) đảm bảo chỉ có duy nhất một phiên Direct Chat cho một cặp user (ràng buộc unique pair).
- [x] API tải lịch sử tin nhắn của Direct Chat (`GET /api/direct-chats/:id/messages?limit=50`) trả về 50 tin nhắn mới nhất sắp xếp theo thời gian.
- [x] Sự kiện Socket.io `direct:send` nhận tin nhắn từ người gửi, lưu bền vững vào bảng `DirectMessage`, và phát sự kiện `direct:receive` ngay lập tức đến socket của người nhận.
- [x] Giao diện danh sách cuộc trò chuyện hiển thị các Direct Chat đang có và ô tìm kiếm người dùng mới.
- [x] Giao diện khung chat 1-1 hiển thị lịch sử tin nhắn, ô nhập văn bản, nút gửi và cập nhật tin nhắn mới theo thời gian thực không cần tải lại trang.
- [x] Kiểm thử tích hợp hai client Socket.io gửi và nhận tin nhắn 1-1 thành công, dữ liệu được ghi nhận chính xác trong database.

## Answer

Ticket 02 has been successfully implemented following TDD, fully verified with 40 integration and client tests, and built across all workspaces.

### Key Deliverables & Implementation Details:
1. **User Directory API (`server/src/controllers/user.controller.ts`, `server/src/routes/user.routes.ts`)**:
   - `GET /api/users`: Authenticated user search and discovery, excluding requesting user, supporting `?q=` and `?search=` filters with case-insensitive matching across username and email.
2. **Direct Chat Management (`server/src/controllers/direct-chat.controller.ts`, `server/src/routes/direct-chat.routes.ts`)**:
   - `POST /api/direct-chats`: Creates or retrieves existing direct chat between current user and target user with canonical pair normalization (`user1Id < user2Id`), auto-creating `DirectChatParticipant` entries for both users.
   - `GET /api/direct-chats`: Lists current user's active direct chats ordered by `updatedAt DESC` with partner profile information and last message snippet.
   - `GET /api/direct-chats/:id/messages`: Loads up to 50 latest messages ordered chronologically (`createdAt ASC`), with participant security checks (403 for unauthorized users).
3. **Real-time Socket.io Direct Chat Handler (`server/src/socket/direct.handler.ts`)**:
   - Automatically registers users into `user:${userId}` rooms upon authenticated connection.
   - Handles `direct:send` (`DirectSendMessagePayload`): validates chat participant membership, persists `DirectMessage` to database with status `SENT`, updates `DirectChat.updatedAt`, and broadcasts `direct:receive` (`DirectReceiveMessagePayload`) to all participant rooms.
4. **Client Direct Chat UI & Hooks (`client/src`)**:
   - `useDirectChats`: Manages direct chat list, user chat initiation, and real-time re-ordering on incoming messages.
   - `useDirectMessages`: Loads 50-message history on chat selection, appends real-time incoming messages via `direct:receive`, and sends `direct:send` payloads over Socket.io.
   - `Sidebar`: User search modal, active chat list with last message snippet, relative timestamps, and unread indicators.
   - `ChatArea`: Header with partner identity and status, message thread with sender vs receiver bubble styling, timestamps, and input bar with Enter-to-send support.
5. **Comprehensive Automated Tests**:
   - `server/tests/direct-chat.test.ts`: 15 integration tests covering user directory filtering, direct chat creation/idempotency, message history retrieval chronologically, and participant security checks.
   - `server/tests/direct-chat-socket.test.ts`: 2 real socket.io-client integration tests verifying real-time delivery (`direct:send` -> `direct:receive`) and database persistence between Alice and Bob, and rejection of non-participant eavesdropping.
   - `client/src/components/chat/DirectChat.test.tsx`: 4 unit tests verifying sidebar selection, chat bubble rendering, send button, Enter key submission, and empty placeholder state.
   - Total test suite: 40 passing tests (31 server, 9 client).
6. **Merge**:
   - Merged into `integration/webchat-realtime` in merge commit `a6a3475`.
