# 06: Đính kèm Tệp, Xem trước Hình ảnh & Lưu trữ Đám mây

**What to build:**
Chức năng tải lên và gửi tệp đính kèm (hình ảnh và tài liệu) an toàn. Người dùng có thể chọn tệp từ máy tính, xem ngay ảnh thu nhỏ xem trước (preview thumbnail) trên client trước khi gửi nếu là hình ảnh, và nhận cảnh báo nếu dung lượng vượt quá giới hạn 10MB. Tệp được tải lên dịch vụ lưu trữ đám mây miễn phí (Cloudinary / Supabase Storage), và đường dẫn tệp kèm siêu dữ liệu (tên file, kích thước, loại file) được lưu vào cơ sở dữ liệu và hiển thị đầy đủ trên khung chat với nút xem/tải về.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** resolved

- [x] Cấu hình dịch vụ lưu trữ đám mây (Cloudinary hoặc Supabase Storage bucket) cho tệp tĩnh của dự án.
- [x] API tải tệp (`POST /api/upload`) kiểm tra nghiêm ngặt định dạng MIME và giới hạn dung lượng tệp (tối đa 10MB), tải lên cloud và trả về URL an toàn cùng siêu dữ liệu.
- [x] Phía client hiển thị khung xem trước ảnh (image preview thumbnail) bằng `URL.createObjectURL` ngay khi người dùng chọn file ảnh, cho phép hủy chọn hoặc xác nhận gửi.
- [x] Phía client kiểm tra dung lượng trước khi gửi và thông báo lỗi rõ ràng nếu file vượt quá 10MB.
- [x] Tin nhắn hỗ trợ lưu trữ các trường `attachmentUrl`, `attachmentName`, `attachmentSize` với `type: IMAGE` hoặc `type: DOCUMENT`.
- [x] Giao diện hiển thị tin nhắn đính kèm: hình ảnh có thể bấm để phóng to xem chi tiết; tài liệu hiển thị icon định dạng, tên file, dung lượng và nút tải về.
- [x] Kiểm thử tích hợp tải lên tệp hợp lệ thành công và từ chối tệp vượt quá 10MB.

## Answer

Ticket 06 has been successfully implemented, fully verified with 118 automated tests (87 server, 31 client), clean production build, and merged into `integration/webchat-realtime`.

### Key Deliverables & Implementation Details:

1. **Storage Provider & Upload Service (`server/src/lib/storage.ts`)**:
   - Modular storage abstraction supporting Cloudinary / Supabase cloud storage when credentials are provided.
   - Secure local disk storage fallback saving files to `server/uploads/` and exposing static files safely via Express static middleware at `/uploads`.

2. **Secure Upload Route & Middleware (`server/src/middlewares/upload.middleware.ts`, `server/src/controllers/upload.controller.ts`, `server/src/routes/upload.routes.ts`)**:
   - Strict Multer configuration enforcing the 10MB file size limit (`10 * 1024 * 1024` bytes) with clean 400 Bad Request error handling for oversized files.
   - Whitelist validation for MIME types: images (JPEG, PNG, GIF, WebP, SVG) and documents (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, ZIP, RAR).
   - `POST /api/upload` endpoint mounted under `/api/upload` with JWT authentication, returning `{ url, originalName, mimeType, size }`.

3. **Client-side File Attachment & Preview (`client/src/components/chat/AttachmentPreview.tsx`, `client/src/utils/format.ts`)**:
   - Paperclip attachment action button integrated in message input action bars for both Direct Chat and Room Chat.
   - Instant thumbnail preview using `URL.createObjectURL` upon selecting image files, displaying filename, formatted file size (`bytesToSize`), and a remove/cancel button.
   - Client-side pre-flight file validation rejecting files larger than 10MB with clear warning notifications prior to network transfer.

4. **Message Bubble Rendering & Lightbox Modal (`client/src/components/chat/MessageItemContent.tsx`, `client/src/components/chat/ImageLightboxModal.tsx`)**:
   - Custom rendering for `type: IMAGE`: responsive rounded thumbnail with zoom-in cursor.
   - Click-to-enlarge Image Lightbox modal featuring high-res display, filename header, download action, and backdrop/escape-key dismissal.
   - Custom rendering for `type: DOCUMENT`: styled card showing document icon, filename, human-readable file size, and direct download button opening the file in a new tab.

5. **Chat Hooks & Socket Integration (`client/src/hooks/useDirectMessages.ts`, `client/src/hooks/useRoomMessages.ts`, `client/src/components/chat/ChatArea.tsx`, `client/src/components/room/RoomChatArea.tsx`)**:
   - Enhanced `sendMessage` in direct and room chat hooks to accept `type` (`IMAGE` | `DOCUMENT`), `attachmentUrl`, `attachmentName`, and `attachmentSize`.
   - Coordinated flow: file uploads to `/api/upload`, receives attachment metadata, and broadcasts via real-time socket events `direct:send` and `room:send`.

6. **Automated Testing & Verification**:
   - `server/tests/upload.test.ts` (6 tests): Validates authentication, file upload processing, rejection of >10MB files, and MIME type enforcement.
   - `server/tests/attachment-message.test.ts` (4 tests): Integration tests verifying socket transmission and database persistence of IMAGE and DOCUMENT messages across direct and room conversations.
   - `client/src/components/chat/Attachment.test.tsx` (6 tests): Client unit/integration tests covering image preview, 10MB client-side validation guard, document attachment card, and lightbox popup behavior.
   - `client/src/components/room/RoomChat.test.tsx` (5 tests): Verification of room chat interactions and attachments.
   - All 118 monorepo tests pass (87 server tests + 31 client tests).
   - Monorepo production build (`npm run build`) succeeded with zero errors.

7. **Merge**:
   - Merged into `integration/webchat-realtime` in merge commit `9c776cc89b5314f32637f76fc8ca23a6c257850a`.
   - Feature branch commit: `52be868f2596f7a0d2a0150f905f57165f6bc554`.

