# 21: Triển khai production

**What to build:** Production tại `https://webchat-realtime.onrender.com` chạy toàn bộ bản nâng cấp bảo mật:
- Dữ liệu hiện có đã được backup, chuẩn hóa và chuyển sang mô hình mới.
- Bucket `attachments` ở chế độ private.
- Các luồng chính (đăng ký, đăng nhập, nhắn tin, gửi ảnh và tài liệu, GIF, kick thành viên, đăng xuất) đều hoạt động dưới CSP và session cookie mới.

Spec: [`../spec.md`](../spec.md), mục *Thay đổi schema DB* và *Quy trình và tài liệu → Checklist thủ công cho người vận hành* (các bước 4, 7).

**Blocked by:** 01–19 đã merge. Ticket 20 phải được implement và review xong, nhưng **chưa merge**: nó được merge ở bước giữa của ticket này, xem các bước dưới đây.

**Status:** ready-for-human

- [ ] Backup DB production bằng `pg_dump` và lưu bản dump ở nơi an toàn, không đưa vào repo.
- [ ] Đánh dấu migration baseline đã áp dụng trên production bằng `prisma migrate resolve --applied 0_baseline`.
- [ ] Deploy `main` chứa các ticket 01–19 (**chưa** có ticket 20). Xác nhận `prisma migrate deploy` áp các migration expand và RLS thành công, và server khởi động được.
- [ ] Chạy lệnh nâng cấp dữ liệu với `--dry-run` trên production, xem báo cáo (tài khoản bị đổi tên, tin bị gỡ đính kèm, object sẽ bị xóa), rồi chạy thật. Lưu báo cáo vào phần Comments của ticket.
- [ ] Merge ticket 20 và deploy. Xác nhận migration contract thành công.
- [ ] Supabase: chuyển bucket `attachments` sang private.
- [ ] Kiểm tra thủ công trên trình duyệt thật bằng DevTools:
  - Console không có lỗi CSP.
  - Cookie `__Host-session` có `HttpOnly`, `Secure`, `SameSite=Strict`, và localStorage không chứa token.
  - Đăng ký, đăng nhập, nhắn Direct Chat và Room Chat, gửi ảnh (đã mất EXIF), xem trước PDF và TXT, gửi GIF, kick thành viên (người bị kick ngừng nhận tin), đăng xuất và đăng xuất mọi thiết bị đều hoạt động.
  - Response có đủ security header và không có `X-Powered-By`.
- [ ] Kiểm tra `GET /rest/v1/User` của Supabase vẫn bị từ chối.
- [ ] Cập nhật `Status:` của `.scratch/security-audit/spec.md` khi mọi mục SEC đã được xác minh trên production.
