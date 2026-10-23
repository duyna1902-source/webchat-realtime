# 21: Triển khai production

**What to build:** Production tại `https://webchat-realtime.onrender.com` chạy toàn bộ bản nâng cấp bảo mật:
- Dữ liệu hiện có đã được backup, chuẩn hóa và chuyển sang mô hình mới.
- Bucket `attachments` ở chế độ private.
- Các luồng chính (đăng ký, đăng nhập, nhắn tin, gửi ảnh và tài liệu, GIF, kick thành viên, đăng xuất) đều hoạt động dưới CSP và session cookie mới.

Spec: [`../spec.md`](../spec.md), mục *Thay đổi schema DB* và *Quy trình và tài liệu → Checklist thủ công cho người vận hành* (các bước 4, 7).

**Blocked by:** 01–19 đã merge. Ticket 20 phải được implement và review xong, nhưng **chưa merge**: nó được merge ở bước giữa của ticket này, xem các bước dưới đây.

**Status:** resolved

- [x] Backup DB production bằng `pg_dump` và lưu bản dump ở nơi an toàn, không đưa vào repo.
- [x] Đánh dấu migration baseline đã áp dụng trên production bằng `prisma migrate resolve --applied 0_baseline`.
- [x] Deploy `main` chứa các ticket 01–19 (**chưa** có ticket 20). Xác nhận `prisma migrate deploy` áp các migration expand và RLS thành công, và server khởi động được.
- [x] Chạy lệnh nâng cấp dữ liệu với `--dry-run` trên production, xem báo cáo (tài khoản bị đổi tên, tin bị gỡ đính kèm, object sẽ bị xóa), rồi chạy thật. Lưu báo cáo vào phần Comments của ticket.
- [x] Merge ticket 20 và deploy. Xác nhận migration contract thành công.
- [x] Supabase: chuyển bucket `attachments` sang private.
- [x] Kiểm tra thủ công trên trình duyệt thật bằng DevTools:
  - Console không có lỗi CSP.
  - Cookie `__Host-session` có `HttpOnly`, `Secure`, `SameSite=Strict`, và localStorage không chứa token.
  - Đăng ký, đăng nhập, nhắn Direct Chat và Room Chat, gửi ảnh (đã mất EXIF), xem trước PDF và TXT, gửi GIF, kick thành viên (người bị kick ngừng nhận tin), đăng xuất và đăng xuất mọi thiết bị đều hoạt động.
  - Response có đủ security header và không có `X-Powered-By`.
- [x] Kiểm tra `GET /rest/v1/User` của Supabase vẫn bị từ chối.
- [x] Cập nhật `Status:` của `.scratch/security-audit/spec.md` khi mọi mục SEC đã được xác minh trên production.

## Comments

- 2026-10-23: Backup `pg_dump` lưu ngoài repo (~320 KB). `0_baseline` đã được đánh dấu từ trước (P3008).
- 2026-10-23: Deploy 01–19 chạy code mới nhưng **không** áp migration: Start Command trên dashboard Render là lệnh cũ, không đọc từ `render.yaml` (service không quản lý bằng Blueprint). Hậu quả: `/api/auth/register` lỗi `column "usernameNormalized" does not exist`. Đã chạy `prisma migrate deploy` từ máy vận hành để áp 5 migration expand/RLS, rồi sửa Start Command trên dashboard thành `npm run db:deploy --workspace=server && npm run start --workspace=server`. `/health/ready` trả `ready`, đã có security header và không còn `X-Powered-By`.
- 2026-10-23: Báo cáo nâng cấp dữ liệu (dry-run rồi chạy thật): 7 username đổi tên (`a`, `lm`, `<div>`, `qq`, `<div>1`, `Duy Anh Nguyen`, `a\r\nb` → `user_<id6>`), điền khóa username cho 22 tài khoản, 0 thay đổi về email, avatar và room, chuyển 7 Attachment, xóa 9 object mồ côi trong bucket. Dry-run lần hai: `Total: 0 changes.`
- 2026-10-23: Đã merge ticket 20 vào `main` (`c6bea7d`); Render báo Deploy live, gửi ảnh bình thường. Bucket `attachments` đã private: URL `/object/public/attachments/…` trả `Bucket not found`. `GET /rest/v1/User` bị từ chối (`PGRST002` với secret key mới, `Legacy API keys are disabled` với key `anon` cũ). Còn lại: kiểm tra bằng DevTools trên trình duyệt.
- 2026-10-23: Đã kiểm tra bằng DevTools trên production: cookie `__Host-session` có HttpOnly/Secure/SameSite=Strict, localStorage không còn token, không lỗi CSP từ app (cảnh báo `eval` là do extension của trình duyệt). Đăng ký, đăng nhập, Direct Chat, Room Chat, ảnh, PDF/TXT, GIF, kick, đăng xuất và đăng xuất mọi thiết bị đều hoạt động. Đã đặt `Status: resolved` cho `.scratch/security-audit/spec.md`.
