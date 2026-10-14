# 03: Trạng thái Hoạt động (Presence Grace Period) & Chỉ báo Đang soạn thảo (Typing Indicator)

**What to build:**
Chức năng cập nhật trạng thái trực tuyến/ngoại tuyến (Online/Offline) và phản hồi chỉ báo đang gõ tin nhắn theo thời gian thực. Khi người dùng kết nối socket, họ được đánh dấu Online và phát tín hiệu cho các liên hệ; khi ngắt kết nối, hệ thống duy trì khoảng đệm 5 giây (`Presence Grace Period`) để tránh nhấp nháy trạng thái khi người dùng tải lại trang. Trong khung chat, khi một người đang nhập liệu, người bên kia lập tức nhìn thấy chỉ báo "Đang soạn thảo..." kèm hiệu ứng chuyển động mượt mà.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** resolved

- [x] Máy chủ theo dõi kết nối socket của từng `userId` và cập nhật trường `isOnline`, `lastSeenAt` trong cơ sở dữ liệu.
- [x] Sự kiện `presence:update` được phát tán theo thời gian thực khi trạng thái Online/Offline của người dùng thay đổi.
- [x] Cơ chế `Presence Grace Period` (5 giây) trì hoãn việc đánh dấu Offline và chỉ phát tán sự kiện ngoại tuyến nếu người dùng không tái kết nối trong 5 giây đó.
- [x] Sự kiện Socket.io `direct:typing` nhận tín hiệu `{ directChatId, isTyping: true/false }` và chuyển tiếp đến người tham gia còn lại trong cuộc trò chuyện.
- [x] Cơ chế debounce phía client tự động gửi `{ isTyping: false }` sau 2.5 giây người dùng ngừng gõ phím.
- [x] Giao diện hiển thị chấm xanh (Online) hoặc xám (Offline kèm mốc thời gian hoạt động cuối) bên cạnh tên người dùng.
- [x] Giao diện khung chat hiển thị thông báo "Người dùng đang soạn tin nhắn..." động khi nhận sự kiện typing.
- [x] Kiểm thử tích hợp xác nhận chuyển đổi trạng thái Presence có grace period và truyền nhận sự kiện typing chính xác.

## Answer

Ticket 03 has been successfully implemented, fully verified with 50 automated tests (37 server, 13 client), clean production build, and merged into `integration/webchat-realtime`.

### Key Deliverables & Implementation Details:
1. **Server Presence Manager (`server/src/socket/presence.handler.ts`, `server/src/socket/index.ts`)**:
   - Manages active user socket mapping (`activeUserSockets: Map<string, Set<string>>`).
   - When user connects first socket: updates `User.isOnline = true` in DB and broadcasts `presence:update` (`{ userId, isOnline: true, lastSeenAt }`) to all clients.
   - When socket disconnects: removes socket from user set. If no active sockets remain for user, starts a `Presence Grace Period` timer (5000ms by default, configurable via `setPresenceGracePeriodMs`).
   - If user reconnects before timer fires: cancels grace period timer, maintaining continuous online state without flicker.
   - If timer expires: marks `User.isOnline = false`, updates `User.lastSeenAt = new Date()`, and broadcasts `presence:update` (`{ userId, isOnline: false, lastSeenAt }`).

2. **Direct Chat Typing Indicator Handler (`server/src/socket/direct.handler.ts`)**:
   - Listens to `direct:typing` (`{ directChatId, isTyping }`).
   - Validates that direct chat exists and caller is an authorized participant.
   - Forwards `direct:typing` (`{ directChatId, userId, isTyping }`) to each other participant's targeted user room (`user:${recipientId}`).

3. **Client Presence & Typing UI (`client/src/`)**:
   - `usePresence` hook tracks incoming `presence:update` events.
   - `useDirectChats` synchronizes partner presence status in real time upon `presence:update`.
   - `useTyping` hook debounces keystrokes with 2.5s timer, automatically emitting `{ isTyping: false }` upon inactivity, and clears immediately on send.
   - Sidebar displays presence dots with online/offline tooltips and last seen timestamps.
   - ChatArea header displays online status / formatted last seen timestamp ("Last seen today at ...").
   - ChatArea displays animated typing bubble ("Username is typing...") with three bouncing dots.

4. **Comprehensive Automated Tests**:
   - `server/tests/presence.test.ts`: 4 tests verifying connect broadcast, grace period delay before offline broadcast, cancellation on reconnect within grace window, and multi-tab/device connection handling.
   - `server/tests/typing.test.ts`: 2 tests verifying typing event forwarding and authorization isolation (preventing non-participants from eavesdropping or emitting).
   - `client/src/components/chat/DirectChat.test.tsx`: 8 tests verifying online/offline rendering and typing indicator emit/display.
   - Total test suite: 50 passing tests (37 server, 13 client).

5. **Merge**:
   - Merged into `integration/webchat-realtime` in merge commit `79acf50`.
   - Feature branch commit: `29c3a43`.

