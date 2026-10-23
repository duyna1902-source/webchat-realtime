# 17: Log sự kiện bảo mật và `/health/ready`

**What to build:** Người vận hành phát hiện và điều tra được lạm dụng qua log: mọi sự kiện bảo mật quan trọng được ghi thành log JSON có cấu trúc, kèm `requestId`, `userId` và IP, và không bao giờ chứa mật khẩu, token hay cookie. Có thêm endpoint kiểm tra server sẵn sàng (kết nối DB). Phần này hoàn tất SEC-17.

Spec: [`../spec.md`](../spec.md), mục *Logging và giám sát*.

**Blocked by:** 11 (Thu hồi Session và đăng xuất mọi thiết bị), 12 (Siết upload), 15 (Rate limiting)

**Status:** resolved

- [x] Ghi đủ các sự kiện: `auth.login.success`, `auth.login.failure` (kèm identifier đã chuẩn hóa), `auth.register`, `auth.logout`, `auth.logout_all`, `session.revoked`, `ratelimit.hit`, `upload.accepted`, `upload.rejected` (kèm lý do), `room.member.kicked`, `room.member.role_changed`, `room.deleted`, `room.left`, `http.401`, `http.403` và `socket.handshake.rejected`.
- [x] Không log nào chứa mật khẩu, token Session, cookie hay secret key, kể cả khi lỗi xảy ra trong lúc xử lý request có body nhạy cảm.
- [x] `GET /health/ready` trả `200` khi truy vấn DB thành công, ngược lại trả `503`. `/health` giữ nguyên.
- [x] Test qua seam 1, dùng sink log test:
  - A08 sinh đúng các `auth.login.failure`, sau đó là `ratelimit.hit`.
  - Kick sinh `room.member.kicked`.
  - Upload SVG sinh `upload.rejected`.
  - Không dòng log nào chứa chuỗi mật khẩu hay giá trị cookie đã dùng trong test.
- [x] Test `/health/ready` cho cả hai trạng thái.
