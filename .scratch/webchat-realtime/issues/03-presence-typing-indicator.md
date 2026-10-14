# 03: Trạng thái Hoạt động (Presence Grace Period) & Chỉ báo Đang soạn thảo (Typing Indicator)

**What to build:**
Chức năng cập nhật trạng thái trực tuyến/ngoại tuyến (Online/Offline) và phản hồi chỉ báo đang gõ tin nhắn theo thời gian thực. Khi người dùng kết nối socket, họ được đánh dấu Online và phát tín hiệu cho các liên hệ; khi ngắt kết nối, hệ thống duy trì khoảng đệm 5 giây (`Presence Grace Period`) để tránh nhấp nháy trạng thái khi người dùng tải lại trang. Trong khung chat, khi một người đang nhập liệu, người bên kia lập tức nhìn thấy chỉ báo "Đang soạn thảo..." kèm hiệu ứng chuyển động mượt mà.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** ready-for-agent

- [ ] Máy chủ theo dõi kết nối socket của từng `userId` và cập nhật trường `isOnline`, `lastSeenAt` trong cơ sở dữ liệu.
- [ ] Sự kiện `presence:update` được phát tán theo thời gian thực khi trạng thái Online/Offline của người dùng thay đổi.
- [ ] Cơ chế `Presence Grace Period` (5 giây) trì hoãn việc đánh dấu Offline và chỉ phát tán sự kiện ngoại tuyến nếu người dùng không tái kết nối trong 5 giây đó.
- [ ] Sự kiện Socket.io `direct:typing` nhận tín hiệu `{ directChatId, isTyping: true/false }` và chuyển tiếp đến người tham gia còn lại trong cuộc trò chuyện.
- [ ] Cơ chế debounce phía client tự động gửi `{ isTyping: false }` sau 2.5 giây người dùng ngừng gõ phím.
- [ ] Giao diện hiển thị chấm xanh (Online) hoặc xám (Offline kèm mốc thời gian hoạt động cuối) bên cạnh tên người dùng.
- [ ] Giao diện khung chat hiển thị thông báo "Người dùng đang soạn tin nhắn..." động khi nhận sự kiện typing.
- [ ] Kiểm thử tích hợp xác nhận chuyển đổi trạng thái Presence có grace period và truyền nhận sự kiện typing chính xác.
