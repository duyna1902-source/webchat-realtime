# 04: Quản trị Phòng Chat & Nhắn tin Nhóm (Room Chat & Membership)

**What to build:**
Chức năng trò chuyện nhóm hoàn chỉnh theo phòng (Room Chat). Người dùng có thể tạo phòng chat mới và tự động nhận vai trò `OWNER`. Chủ phòng (`OWNER`) và quản trị viên (`ADMIN`) có quyền mời/thêm người dùng khác vào phòng. `OWNER` có quyền nâng/hạ quyền quản trị viên, xóa thành viên bất kỳ và giải tán phòng. `ADMIN` có thể xóa thành viên thường (`MEMBER`). `MEMBER` có thể xem danh sách thành viên và tự rời phòng. Mọi thành viên trong phòng có thể gửi tin nhắn nhóm `Room Message` (`room:send` / `room:receive`) và xem lịch sử phòng chat.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** ready-for-agent

- [ ] API tạo Room Chat mới (`POST /api/rooms`) gán người tạo với vai trò `OWNER` trong bảng `RoomMember`.
- [ ] API lấy danh sách các Room mà người dùng tham gia (`GET /api/rooms`).
- [ ] API quản lý thành viên: Thêm thành viên (`POST /api/rooms/:id/members`), xóa thành viên (`DELETE /api/rooms/:id/members/:userId`), đổi quyền (`PATCH /api/rooms/:id/members/:userId/role`), và tự rời phòng (`POST /api/rooms/:id/leave`).
- [ ] Logic phân quyền kiểm tra chặt chẽ quyền hạn của `OWNER`, `ADMIN`, `MEMBER` trước khi thực hiện thao tác quản trị.
- [ ] Sự kiện Socket.io `room:join` và `room:leave` đưa socket vào room tương ứng (`socket.join(roomId)`).
- [ ] Sự kiện Socket.io `room:send` lưu tin nhắn vào bảng `RoomMessage` và phát `room:receive` tới toàn bộ các socket đang tham gia phòng đó.
- [ ] Sự kiện `room:member_change` thông báo cập nhật danh sách thành viên trong phòng theo thời gian thực.
- [ ] Giao diện Modal tạo phòng, danh sách phòng chat, bảng xem thành viên với các nút chức năng quản trị tương ứng theo vai trò.
- [ ] Kiểm thử tích hợp xác nhận đầy đủ các luồng: tạo phòng, thêm/xóa thành viên có phân quyền, và phát tán tin nhắn nhóm.
