# 15: Rate limiting

**What to build:** Login, đăng ký, upload, tìm User, tìm GIF, tạo room, gửi tin và Typing Indicator đều bị giới hạn tần suất. Đoán mật khẩu không giới hạn, spam tin nhắn hay tạo tài khoản hàng loạt đều bị chặn. User vượt ngưỡng nhận thông báo kèm thời gian phải chờ. Đóng SEC-07.

Spec: [`../spec.md`](../spec.md), mục *Rate limiting*.

**Blocked by:** 02 (Lớp lỗi, `requestId` và logger nền)

**Status:** resolved

- [x] Bộ đếm in-memory, có comment ghi rõ rằng khi scale ngang thì phải chuyển sang store dùng chung. REST dùng `express-rate-limit`. Socket dùng token bucket theo `userId`.
- [x] Ngưỡng mặc định, đi qua cấu hình để test ghi đè được:

  | Mục | Khóa | Ngưỡng |
  |---|---|---|
  | Login thất bại | IP + identifier (chữ thường) | 10 / 15 phút |
  | Register | IP | 5 / giờ |
  | Upload | userId | 20 / 10 phút |
  | `GET /api/users` | userId | 30 / phút |
  | `/api/gifs/*` | userId | 30 / phút |
  | `POST /api/rooms` | userId | 10 / giờ |
  | `direct:send` và `room:send` (gộp) | userId | 10 / 10 giây |
  | Typing | userId | 1 / giây (vượt thì bỏ qua lặng lẽ) |

- [x] `trust proxy` được bật để rate limit dùng IP thật sau proxy của Render.
- [x] REST vượt ngưỡng trả `429` kèm header `Retry-After`. Socket gửi tin vượt ngưỡng trả callback `{ success: false, error: 'RATE_LIMITED', retryAfterMs }`.
- [x] Client hiện thông báo kèm thời gian chờ cho cả `429` và `RATE_LIMITED`. Bản nháp tin nhắn không bị mất.
- [x] Test hồi quy qua seam 1:
  - A08: lần login sai thứ 11 bị `429` kèm `Retry-After`.
  - A22: gửi 300 `direct:send` song song thì chỉ phần trong ngưỡng được ghi, phần còn lại nhận `RATE_LIMITED`.
  - Mỗi endpoint còn lại có một test chạm ngưỡng.
  - Typing vượt ngưỡng không được phát tiếp.
- [x] Test qua seam 4: thông báo `RATE_LIMITED` hiển thị thời gian chờ.
