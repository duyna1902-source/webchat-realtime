# 10: Đăng nhập bằng session cookie

**What to build:** User đăng nhập, đăng ký và giữ phiên bằng một Session lưu trong DB, mang theo bằng cookie `__Host-session` (`HttpOnly; Secure; SameSite=Strict`) mà JavaScript không đọc được. Khi mở app, client hỏi server "tôi là ai" (`/api/auth/me`), không còn lưu token hay thông tin User trong localStorage. Đăng xuất thu hồi Session thật trên server. Request thay đổi dữ liệu và kết nối socket đến từ site khác bị từ chối. JWT bị gỡ hẳn. Phần JWT của SEC-01 và SEC-02 biến mất tận gốc, và đây là phần chính của SEC-11 (ADR 0010).

Spec: [`../spec.md`](../spec.md), mục *Session và xác thực*.

**Blocked by:** 02 (Lớp lỗi, `requestId` và logger nền), 03 (Prisma Migrate baseline, RLS và khung lệnh nâng cấp dữ liệu)

**Status:** ready-for-agent

- [ ] Migration thêm bảng Session gồm `id`, `userId`, `tokenHash` (unique), `createdAt`, `lastActiveAt`, `expiresAt`, `ip`, `userAgent`.
- [ ] Session store:
  - Tạo token 32 byte từ CSPRNG. DB chỉ lưu SHA-256 của token.
  - Hết hạn khi không hoạt động 7 ngày hoặc đạt 30 ngày kể từ lúc tạo.
  - `lastActiveAt` được cập nhật có giới hạn tần suất.
- [ ] Register và login đặt cookie `__Host-session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000` và trả `{ user }`, không có `token`.
- [ ] `GET /api/auth/me` trả `200 { user }` hoặc `401`. `POST /api/auth/logout` trả `204`, thu hồi Session hiện tại và xóa cookie.
- [ ] Auth middleware REST đọc cookie, không đọc `Authorization`. Gỡ thư viện `jsonwebtoken`, biến `JWT_SECRET` (cả trong cấu hình lẫn blueprint) và mọi đường đọc Bearer.
- [ ] Mọi `POST`, `PATCH`, `PUT`, `DELETE` phải có `Origin` bằng `APP_ORIGIN`. Không có `Origin` thì phải có `Sec-Fetch-Site: same-origin`. Thiếu cả hai, hoặc sai, thì `403`. Áp dụng cho cả upload multipart và auth.
- [ ] Handshake Socket.IO kiểm tra `Origin` bằng `APP_ORIGIN`, xác thực bằng cookie (bỏ `handshake.auth.token`), và cho socket join `session:<sessionId>`. Connection State Recovery đặt `skipMiddlewares: false`.
- [ ] Client:
  - Khởi động gọi `/api/auth/me` và hiện trạng thái chờ khi server đang cold start.
  - Không ghi gì vào localStorage, bỏ mọi header `Authorization`. Dùng một helper gọi API chung, và mọi `401` đưa về màn đăng nhập.
  - Socket không truyền `auth`.
  - Nút "Đăng xuất" gọi endpoint logout.
- [ ] Mọi test server hiện có được chuyển từ token tự ký sang đăng nhập lấy cookie. Có helper test dựng User đã đăng nhập.
- [ ] Test qua seam 1:
  - Cookie có đúng cờ. `/me` trả đúng trạng thái trước và sau logout.
  - Cookie cũ bị từ chối sau logout, cả ở REST lẫn handshake socket.
  - Token tự ký bằng `JWT_SECRET` cũ không còn tác dụng (A12).
  - `POST` thiếu hoặc sai `Origin` bị `403`.
  - Handshake có `Origin` lạ bị từ chối.
  - Socket được khôi phục sau khi Session đã bị thu hồi thì bị từ chối.
- [ ] Test qua seam 4: `/me` trả `200` thì vào Dashboard, trả `401` thì vào AuthScreen. `401` giữa chừng đưa về màn đăng nhập. localStorage trống. Không request nào mang `Authorization`.
