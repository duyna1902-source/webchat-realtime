# 20: Migration contract

**What to build:** Sau khi dữ liệu production đã được chuẩn hóa, schema DB được "khóa" theo các quy tắc mới. Các cột cũ không còn dùng (`avatarUrl` và `attachmentUrl`/`attachmentName`/`attachmentSize` của Direct Message và Room Message) bị xóa. Các ràng buộc được đưa xuống tầng DB: username unique không phân biệt hoa thường, email unique, độ dài tên và mô tả room. Kể từ đây DB tự từ chối dữ liệu sai quy tắc, ngay cả khi ứng dụng bỏ sót.

Ticket này được tách riêng có chủ đích theo kiểu expand–contract. Render chạy mọi migration đang chờ mỗi lần deploy, nên ticket này chỉ được merge **sau khi** lệnh nâng cấp dữ liệu đã chạy trên production (xem ticket 21).

Spec: [`../spec.md`](../spec.md), mục *Thay đổi schema DB → Contract migration*.

**Blocked by:** 07 (Validation dùng chung, quy tắc tài khoản và room), 13 (Bản ghi Attachment và signed URL), 14 (Nâng cấp Attachment cũ)

**Status:** resolved

- [x] Migration contract:
  - Xóa `User.avatarUrl` và các cột `attachmentUrl`/`attachmentName`/`attachmentSize` của Direct Message và Room Message.
  - Đặt khóa username chuẩn hóa thành `NOT NULL UNIQUE`, đảm bảo `email` unique ở dạng chữ thường.
  - Thêm ràng buộc độ dài cho `Room.name` và `Room.description`.
- [x] Migration **báo lỗi rõ ràng** nếu dữ liệu chưa được chuẩn hóa (ví dụ còn khóa username null, hoặc còn tin có `attachmentUrl` chưa được xử lý), thay vì âm thầm làm mất dữ liệu.
- [x] Mã ứng dụng không còn tham chiếu tới các cột bị xóa. Bỏ phần kiểm tra trùng username ở tầng ứng dụng nếu ràng buộc DB đã đảm nhiệm, nhưng vẫn trả lỗi validate thân thiện khi trùng.
- [x] Schema PGlite sinh tự động được tái tạo theo schema mới.
- [x] Test qua seam 3: dựng baseline, nạp dữ liệu rác, áp các migration expand, chạy lệnh nâng cấp dữ liệu, áp migration contract. Kiểm tra:
  - Mọi ràng buộc có hiệu lực: chèn trực tiếp `Alice` khi đã có `alice` bị DB từ chối.
  - Mọi bảng vẫn bật RLS.
- [x] Test qua seam 3: áp migration contract khi **chưa** chạy lệnh dữ liệu thì báo lỗi.
- [x] Toàn bộ test server và client pass.
