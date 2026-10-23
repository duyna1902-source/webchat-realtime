# 13: Bản ghi Attachment và signed URL

**What to build:** Mỗi file upload trở thành một bản ghi Attachment do server quản lý. Khi gửi Direct Message hoặc Room Message, client chỉ gửi `attachmentId` (hoặc `gifUrl` cho GIF), còn server tự điền tên, kích thước và loại tin, nên client không thể giả mạo URL, metadata hay `type`. Chỉ Direct Chat Participant và Room Member hiện tại nhận được signed URL có hạn 1 giờ để xem Attachment. URL hết hạn thì client tự xin URL mới. Phần này đóng SEC-03 phía server và SEC-14, đồng thời hoàn tất phần quyền truy cập của SEC-15 (ADR 0009).

Spec: [`../spec.md`](../spec.md), mục *Attachment* (storage adapter, bản ghi, gửi tin, `AttachmentDto`, endpoint làm mới, client).

**Blocked by:** 03 (Prisma Migrate baseline, RLS và khung lệnh nâng cấp dữ liệu), 07 (Validation dùng chung, quy tắc tài khoản và room), 12 (Siết upload)

**Status:** resolved

- [x] Storage adapter interface gồm `put`, `createSignedUrl` (có biến thể ký nhiều key), `delete` và `list`.
  - Adapter Supabase dùng API signed URL.
  - Adapter `local` dùng đường dẫn có chữ ký HMAC kèm hạn dùng.
  - Adapter in-memory mô phỏng hạn dùng.
- [x] Migration **expand**:
  - Thêm bảng Attachment gồm `id`, `uploaderId`, `storageKey` (unique), `kind`, `mimeType`, `size`, `originalName` (≤255 ký tự), `createdAt`.
  - Thêm khóa ngoại nullable và unique tới Direct Message hoặc Room Message, xóa theo cascade khi tin nhắn bị xóa.
  - Các cột `attachmentUrl`/`Name`/`Size` cũ được giữ lại cho tới ticket 20.
- [x] Upload trả `201 { attachment: AttachmentDto }`, gồm signed URL để người upload xem trước.
- [x] Payload `direct:send` và `room:send` chỉ nhận một trong các dạng: văn bản; văn bản kèm `attachmentId`; hoặc `gifUrl` (`https`, host `media*.giphy.com` hoặc `i.giphy.com`). Các field `type`, `attachmentUrl`, `attachmentName` và `attachmentSize` từ client bị từ chối.
- [x] Gửi tin kèm Attachment không tồn tại, của người khác, hoặc đã gắn vào tin khác thì trả `ATTACHMENT_INVALID`. Server tự suy ra `MessageType`. Message Character Limit vẫn áp cho `content`.
- [x] Mọi tin nhắn trả qua lịch sử, Catch-up Sync và broadcast mang `attachment: { id, kind, mimeType, size, name, url, urlExpiresAt }` với TTL 1 giờ.
- [x] `GET /api/attachments/:id/url` trả `{ url, expiresAt }` cho Direct Chat Participant, Room Member hiện tại, hoặc người upload khi Attachment chưa gắn tin. Mọi trường hợp khác trả `404`.
- [x] Client:
  - Upload rồi gửi tin bằng `attachmentId`. GIF gửi bằng `gifUrl`.
  - Khi ảnh, iframe preview hoặc `fetch` preview thất bại, hoặc `urlExpiresAt` đã qua, client gọi endpoint làm mới đúng một lần rồi thử lại.
  - Mọi URL vẫn đi qua helper URL an toàn của ticket 06.
- [x] Test hồi quy qua seam 1:
  - A18: `attachmentUrl: "javascript:..."` cùng `attachmentSize: -5` bị từ chối.
  - A19: `attachmentName` 200.000 ký tự bị từ chối.
  - A20: GIF `javascript:` bị từ chối, GIF host lạ bị từ chối.
  - Dùng `attachmentId` của người khác bị từ chối, gắn một Attachment vào hai tin cũng bị từ chối.
  - Signed URL hết hạn sau TTL (TTL nhỏ qua cấu hình).
  - Endpoint làm mới trả `404` cho người ngoài và cho Room Member vừa bị kick.
- [x] Test qua seam 4: URL hết hạn thì client gọi endpoint làm mới đúng một lần, và ảnh hiển thị lại.
