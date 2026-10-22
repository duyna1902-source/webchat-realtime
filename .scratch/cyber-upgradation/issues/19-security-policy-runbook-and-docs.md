# 19: `SECURITY.md`, runbook và tài liệu

**What to build:**
- Người phát hiện lỗ hổng có kênh báo cáo riêng tư và biết phạm vi cùng thời gian phản hồi.
- Người vận hành có runbook từng bước cho sự cố: xoay vòng key, thu hồi Session, đánh giá phạm vi, thông báo User.
- Tài liệu dự án (README, `.env.example`, kiến trúc hệ thống) phản ánh đúng kiến trúc mới: single-host, session cookie, Attachment riêng tư, Prisma Migrate.

Phần này đóng SEC-18.

Spec: [`../spec.md`](../spec.md), mục *Quy trình và tài liệu*.

**Blocked by:** 05 (Xoay vòng key và khóa Supabase, GitHub), 11 (Thu hồi Session và đăng xuất mọi thiết bị), 16 (Security header, CSP và gỡ CORS)

**Status:** ready-for-agent

- [ ] `SECURITY.md` ở gốc repo gồm:
  - Phạm vi.
  - Kênh báo cáo qua GitHub Private Vulnerability Reporting.
  - Thời gian phản hồi mục tiêu.
  - Danh sách rủi ro đã chấp nhận: Tailwind v3 (lấy từ ticket 18), rate limit in-memory, cold start của Render free, signed URL còn hiệu lực tới 1 giờ sau khi bị kick (ADR 0009), dữ liệu cũ có thể đã bị đọc hoặc bị chèn khi key bị lộ.
- [ ] Runbook xử lý sự cố trong `docs/` gồm:
  - Phát hiện qua log.
  - Xoay vòng key Supabase.
  - Thu hồi Session bằng lệnh CLI (một User hoặc toàn bộ).
  - Đánh giá phạm vi qua log ứng dụng và log Supabase.
  - Thông báo cho User.
  - Backup bằng `pg_dump` trước mọi thao tác dữ liệu.
  - Lưu ý Supabase free tạm dừng project khi không có hoạt động.
  - Monitor ping `/health` như một tùy chọn chống cold start.
  - Một ví dụ áp dụng đúng vào sự cố SEC-01.
- [ ] README cập nhật cách deploy single-host trên Render, các biến môi trường mới, quy trình migration (baseline, `migrate deploy`, lệnh nâng cấp dữ liệu) và cách cài hook `gitleaks`.
- [ ] `.env.example` có đủ biến mới, không còn `JWT_SECRET`, biến Cloudinary hay `VITE_API_URL`.
- [ ] Tài liệu kiến trúc hệ thống được cập nhật theo ADR 0009 và ADR 0010: luồng xác thực, luồng Attachment và topology deploy.
- [ ] Mọi link nội bộ trong các tài liệu trên đều mở được.
