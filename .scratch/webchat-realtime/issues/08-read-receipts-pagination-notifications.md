# 08: Biên nhận Đã xem (Read Receipts), Phân trang Con trỏ & Thông báo Trình duyệt

**What to build:**
Các tính năng hoàn thiện trải nghiệm giao tiếp: hiển thị biên nhận đã xem tin nhắn (Read Receipts) theo thời gian thực để người gửi biết đối phương đã đọc tin đến đâu; phân trang con trỏ (`Cursor-based Pagination`) giúp tự động tải thêm 50 tin nhắn cũ hơn khi người dùng cuộn chuột lên trên cùng mà không làm đơ giao diện; và hệ thống thông báo đẩy trình duyệt (HTML5 Web Notification kèm âm thanh báo nhẹ) khi có tin nhắn mới gửi đến trong lúc người dùng đang mở tab hoặc cửa sổ khác.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** resolved

- [x] Cập nhật và lưu trữ trường `lastReadMessageId` trên bảng `DirectChatParticipant` và `RoomMember` khi người dùng mở hoặc cuộn xem tin nhắn mới.
- [x] Sự kiện Socket.io `direct:read` và `room:read` phát tín hiệu mốc tin nhắn đã đọc tới những người tham gia còn lại trong cuộc trò chuyện.
- [x] Giao diện tin nhắn 1-1 hiển thị biểu tượng trạng thái tin nhắn (Sent: 1 dấu tích, Delivered: 2 dấu tích xám, Read: 2 dấu tích xanh hoặc chữ "Đã xem").
- [x] Giao diện Room Chat hiển thị số lượng hoặc avatar thành viên đã đọc tin nhắn gần nhất.
- [x] API tải lịch sử tin nhắn hỗ trợ tham số con trỏ `?before=<oldestMessageId>&limit=50` trả về các tin nhắn cũ hơn.
- [x] Phía client cài đặt Intersection Observer hoặc sự kiện cuộn (scroll listener) ở đầu khung chat để tự động kích hoạt tải thêm 50 tin nhắn cũ và giữ nguyên vị trí cuộn của người dùng.
- [x] Tích hợp HTML5 Web Notification API với công tắc (toggle) xin quyền thân thiện trên giao diện; phát âm thanh ping nhẹ và hiển thị popup thông báo khi tab không có tiêu điểm (unfocused/background).
- [x] Kiểm thử tích hợp xác nhận cập nhật mốc `lastReadMessageId` và phản hồi sự kiện read receipt thành công.

## Answer

Ticket 08 has been successfully implemented, verified with 148 automated tests (104 server tests across 14 suites, 44 client tests across 7 suites), confirmed clean production build, and merged into `integration/webchat-realtime`.

### Key Deliverables & Implementation Details:

1. **Real-Time Read Receipts (Socket & Data Layer)**:
   - **Schema & Persistence**: Leveraged `DirectChatParticipant.lastReadMessageId` and `RoomMember.lastReadMessageId` in Prisma schema to persist per-user read progression.
   - **Direct Read Socket Event (`server/src/socket/direct.handler.ts`)**: Implemented `direct:read` handler that validates participant membership, updates `lastReadMessageId`, transitions prior messages to `READ` status in DB, and emits `direct:read` event with `{ directChatId, readerId, lastReadMessageId }` to recipient sockets.
   - **Room Read Socket Event (`server/src/socket/room.handler.ts`)**: Implemented `room:read` handler that validates room membership, updates `RoomMember.lastReadMessageId`, and broadcasts `room:read` event with `{ roomId, readerId, lastReadMessageId }` to all members in room.

2. **UI Read Receipts & Status Indicators**:
   - **Direct Chat (`client/src/components/chat/ChatArea.tsx`)**: Outgoing message bubbles show status indicators (Sent: 1 checkmark `✓`, Delivered: 2 gray checkmarks `✓✓`, Read: 2 blue checkmarks `✓✓` with timestamp/tooltip). Automatically emits `direct:read` when active chat messages are viewed.
   - **Room Chat (`client/src/components/room/RoomChatArea.tsx`)**: Displays avatar pills and read member counts next to messages reflecting the furthest message members have read. Emits `room:read` on viewing room messages.

3. **Cursor-Based Pagination & Smooth Scrolling**:
   - **REST APIs (`server/src/controllers/direct-chat.controller.ts`, `server/src/controllers/room.controller.ts`)**: Extended `GET /api/direct-chats/:id/messages` and `GET /api/rooms/:id/messages` to support `?before=<oldestMessageId>&limit=50`. Fetches strictly older messages in descending order and returns them sorted chronologically (`ASC`).
   - **Hooks (`client/src/hooks/useDirectMessages.ts`, `client/src/hooks/useRoomMessages.ts`)**: Provided `loadMore()` and `hasMore` state. Older batches are prepended without duplication.
   - **Scroll Position Preservation**: `ChatArea` and `RoomChatArea` detect scroll near top or top intersection, trigger `loadMore()`, and adjust `scrollTop` based on `scrollHeight` change so user reading position remains uninterrupted.

4. **HTML5 Web Notifications & Web Audio Chime**:
   - **Notification Utility (`client/src/utils/notifications.ts`)**: Built browser notification manager with Web Audio API chime synthesis (`playNotificationSound()`, synthesized sine tone ping without external audio files) and document focus detection (`isDocumentHidden()`).
   - **UI Toggle & Trigger (`client/src/components/dashboard/Dashboard.tsx`)**: Added notification permission toggle button with tooltips in header. Automatically plays chime and displays desktop notification for new incoming direct and room messages when the window/tab is in the background or unfocused.

5. **Automated Testing & Verification**:
   - `server/tests/read-receipts.test.ts` (4 integration tests): Direct chat and room chat read receipts socket events, DB state validation, and non-member rejection.
   - `server/tests/pagination.test.ts` (4 integration tests): Cursor pagination for direct chats and rooms with `before` and `limit` params.
   - `client/src/components/chat/ReadReceiptsPagination.test.tsx` (6 unit/integration tests): UI read status ticks, room read badges, load older messages button, and notification permission UI.
   - Monorepo full test suite (`npm test`): 148 passed tests (104 server + 44 client).
   - Monorepo production build (`npm run build`): All 3 workspaces (`@webchat/shared`, `@webchat/server`, `@webchat/client`) compiled cleanly with 0 errors.

6. **Merge**:
   - Merged branch `feature/08-read-receipts-pagination-notifications` into `integration/webchat-realtime`.
   - Merge commit: `8f3050ea1256fc847629dae247218ef08f46be40`.
   - Feature branch commit: `93225da`.
