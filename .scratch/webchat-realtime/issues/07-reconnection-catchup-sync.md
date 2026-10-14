# 07: Tự động Kết nối lại & Đồng bộ Tin nhắn Bỏ lỡ (Catch-up Sync)

**What to build:**
Cơ chế đảm bảo độ ổn định mạng và chống mất dữ liệu khi kết nối bị gián đoạn. Khi người dùng gặp sự cố mạng ngắn (dưới 2 phút), Socket.io tự động kết nối lại và khôi phục các sự kiện bị đệm (Connection State Recovery). Đối với trường hợp mất mạng dài hơn hoặc khi người dùng mở lại tab trình duyệt, client tự động kích hoạt quy trình Catch-up Sync qua REST API để kéo về toàn bộ tin nhắn mới phát sinh trong thời gian ngoại tuyến dựa trên mốc `lastMessageId`, đảm bảo không bỏ sót bất kỳ tin nhắn nào.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** resolved

- [x] Cấu hình `connectionStateRecovery` trên máy chủ Socket.io với thời gian đệm `maxDisconnectionDuration: 2 * 60 * 1000`.
- [x] API Catch-up Sync cho Direct Chat (`GET /api/direct-chats/:id/messages?after=<lastMessageId>`) trả về toàn bộ tin nhắn mới hơn mốc tin nhắn chỉ định.
- [x] API Catch-up Sync cho Room Chat (`GET /api/rooms/:id/messages?after=<lastMessageId>`) trả về toàn bộ tin nhắn mới của phòng kể từ mốc chỉ định.
- [x] Client lắng nghe các sự kiện vòng đời socket (`connect`, `disconnect`, `connect_error`) và hiển thị banner trạng thái "Đang kết nối lại..." trên giao diện khi mất mạng.
- [x] Khi socket kết nối lại sau gián đoạn, client tự động kiểm tra trạng thái khôi phục (`socket.recovered`); nếu không được phục hồi tự động, client kích hoạt Catch-up Sync để đồng bộ tin nhắn còn thiếu.
- [x] Logic client tự động khử trùng lặp tin nhắn (deduplication) để đảm bảo không hiển thị hai lần một tin nhắn.
- [x] Kiểm thử tích hợp giả lập ngắt mạng client, gửi tin nhắn từ phía khác, kết nối lại client và xác minh toàn bộ tin nhắn bị bỏ lỡ được đồng bộ đầy đủ.

## Answer

Ticket 07 has been successfully implemented, verified with 134 automated tests (96 server, 38 client), confirmed clean production build, and merged into `integration/webchat-realtime`.

### Key Deliverables & Implementation Details:

1. **Socket.io Connection State Recovery (`server/src/socket/index.ts`)**:
   - Enabled `connectionStateRecovery` on the Socket.io server with `maxDisconnectionDuration: 2 * 60 * 1000` (2 minutes).
   - Enables fast automatic restoration of buffered events and room memberships for temporary network hiccups.

2. **Server Catch-up Sync APIs (`server/src/controllers/direct-chat.controller.ts`, `server/src/controllers/room.controller.ts`)**:
   - Enhanced `GET /api/direct-chats/:id/messages` and `GET /api/rooms/:id/messages` with `?after=<lastMessageId>` query parameter.
   - When `after` is supplied, server locates the reference message's `createdAt` timestamp and queries all messages where `createdAt > referenceMessage.createdAt` ordered chronologically (`createdAt ASC`).
   - If the reference message ID does not exist or belongs to another chat, it safely falls back to standard message pagination.

3. **Client Socket Context & Reconnection Lifecycle (`client/src/context/SocketContext.tsx`)**:
   - Tracks connection lifecycle events: `connect`, `disconnect`, `connect_error`, `reconnect_attempt`, `reconnect_failed`.
   - Exposes `isConnected`, `isReconnecting`, `reconnectAttempt`, and `lastConnectedAt` to the entire application.

4. **Connection Status Banner (`client/src/components/common/ConnectionStatusBanner.tsx`, `client/src/components/dashboard/Dashboard.tsx`)**:
   - Global banner displayed across dashboard when connection is interrupted or reconnecting.
   - Shows reconnecting spinner with retry count ("Đang kết nối lại... (Lần 1)") and manual "Thử kết nối lại" button.
   - Features animated transition and auto-dismisses upon successful reconnection.

5. **Client Catch-up Sync & Message Deduplication (`client/src/hooks/useDirectMessages.ts`, `client/src/hooks/useRoomMessages.ts`)**:
   - In both direct and room hooks, an event listener on socket `connect` checks whether `socket.recovered` is true.
   - If `!socket.recovered` and existing messages are present in memory, triggers an incremental catch-up sync calling `GET /api/.../messages?after=<lastMessage.id>`.
   - Incoming messages from sync are merged into the existing state using Map-based deduplication (`msg.id`), preventing duplicate messages.

6. **Automated Testing & Verification**:
   - `server/tests/catchup-sync.test.ts` (9 tests): Comprehensive server and socket tests verifying `after` filtering, 404/fallback behavior, multi-client offline sending, disconnect/reconnect catch-up sync, and cross-chat isolation.
   - `client/src/components/common/ReconnectionSync.test.tsx` (7 tests): Client unit and integration tests verifying connection banner states, manual reconnect trigger, automatic catch-up sync on reconnection, and deduplication logic.
   - All 134 monorepo tests pass (96 server tests + 38 client tests).
   - Monorepo production build (`npm run build`) succeeded with zero errors.

7. **Merge**:
   - Merged into `integration/webchat-realtime` in merge commit `cc9db2794d8dc03dc380a0bf1c4bb6177a3760da`.
   - Feature branch commit: `49ba65c7117172782bcf2673297a783685e13292`.

