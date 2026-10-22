# 07: Validation dùng chung, quy tắc tài khoản và room

**What to build:** Mọi body REST và payload socket đi qua schema zod đặt trong package `shared`. Client dùng schema này để hiện gợi ý validate, server dùng để bắt buộc tuân thủ. User đăng ký theo quy tắc rõ ràng cho username, mật khẩu và email. Login chỉ chấp nhận username hoặc email khớp chính xác. Room có giới hạn tên và mô tả. `avatarUrl` biến mất khỏi API và giao diện. Dữ liệu cũ vi phạm quy tắc được chuẩn hóa bằng lệnh nâng cấp dữ liệu. Đóng SEC-08, và phần kiểu dữ liệu của SEC-05.

Spec: [`../spec.md`](../spec.md), mục *Validation và xử lý lỗi* và *Thay đổi schema DB → Trình tự expand → dữ liệu → contract* (các bước 1, 2, 3, 7).

**Blocked by:** 02 (Lớp lỗi, `requestId` và logger nền), 03 (Prisma Migrate baseline, RLS và khung lệnh nâng cấp dữ liệu)

**Status:** ready-for-agent

- [ ] Schema zod trong `shared` cho register, login, tạo và sửa room, cùng mọi payload socket hiện có. Mọi controller và socket handler parse đầu vào trước khi chạm tới Prisma. Payload sai trả `400` (REST) hoặc callback `VALIDATION_ERROR` (socket), kèm danh sách field sai.
- [ ] Schema chỉ nhận đúng kiểu nguyên thủy. Gửi object vào field chuỗi bị từ chối (A07, A09, A10).
- [ ] `username` dài 3–32 ký tự, khớp `^[a-zA-Z0-9_.]+$`, unique không phân biệt hoa thường: đăng ký `Alice` khi đã có `alice` bị từ chối. `password` dài 8–72 byte. `email` đúng định dạng và được lưu chữ thường.
- [ ] Login trả `401` với cùng một thông báo, dù sai username hay sai mật khẩu.
- [ ] Room `name` dài 1–64 ký tự sau khi cắt khoảng trắng, `description` tối đa 500 ký tự, cả hai không chứa ký tự điều khiển.
- [ ] Bỏ `avatarUrl` khỏi input đăng ký, khỏi mọi DTO và khỏi client. Icon của browser Notification không dùng URL do User cung cấp.
- [ ] Thông báo validate ở màn đăng ký và đăng nhập hiển thị trong khung form cố định, tuân thủ Zero-Shift Auth Architecture.
- [ ] Có migration **expand**: thêm khóa username chuẩn hóa (nullable). Chưa xóa cột và chưa thêm ràng buộc unique, việc đó thuộc ticket 20. Ứng dụng tự kiểm tra trùng không phân biệt hoa thường cho tới khi ràng buộc có hiệu lực.
- [ ] Lệnh nâng cấp dữ liệu có thêm các bước:
  - Đổi tên username vi phạm thành `user_<6 ký tự đầu của id>`. Cặp trùng không phân biệt hoa thường thì giữ tài khoản tạo trước.
  - Chuyển email về chữ thường. Email trùng thì gắn `+dup<n>` vào tài khoản tạo sau.
  - Cắt và làm sạch tên, mô tả room. Tên rỗng thì thành `Room <6 ký tự đầu của id>`.
  - Đặt `avatarUrl` về null.
  - Điền khóa username chuẩn hóa.
  - Báo cáo liệt kê giá trị cũ → mới.
- [ ] Test hồi quy qua seam 1: A02, A03, A04, A05, A06, A07, A09, A10, room `name`/`description` quá dài hoặc sai kiểu.
- [ ] Test qua seam 3: dữ liệu rác có username CRLF, username 50.000 ký tự, cặp `alice`/`Alice`, cặp `Bob@X.io`/`bob@x.io`, room tên quá dài. Sau khi chạy lệnh thì mọi dòng đúng quy tắc, báo cáo đúng, và chạy lần hai không đổi gì.
- [ ] Test qua seam 4: form đăng ký hiện lỗi validate tại chỗ mà không làm xê dịch layout.
