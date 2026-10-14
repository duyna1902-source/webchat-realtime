# 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**What to build:**
Chức năng trò chuyện trực tiếp 1-1 theo thời gian thực giữa hai người dùng độc lập. Người dùng có thể tìm kiếm hoặc chọn một người dùng khác từ danh sách để bắt đầu Direct Chat, gửi tin nhắn văn bản tức thời qua kết nối Socket.io hai chiều (`direct:send` / `direct:receive`), và xem lịch sử tin nhắn được tải lại tự động từ cơ sở dữ liệu khi mở lại cuộc trò chuyện (mặc định tải 50 tin nhắn gần nhất).

**Blocked by:** 01: Thiết lập Monorepo, Schema Cơ sở dữ liệu Toàn diện & Xác thực Người dùng (Auth Tracer Bullet)

**Status:** claimed

- [ ] API danh sách người dùng (`GET /api/users`) cho phép tìm kiếm và xem danh sách người dùng khả dụng để nhắn tin.
- [ ] API tạo hoặc lấy Direct Chat giữa hai người dùng (`POST /api/direct-chats`) đảm bảo chỉ có duy nhất một phiên Direct Chat cho một cặp user (ràng buộc unique pair).
- [ ] API tải lịch sử tin nhắn của Direct Chat (`GET /api/direct-chats/:id/messages?limit=50`) trả về 50 tin nhắn mới nhất sắp xếp theo thời gian.
- [ ] Sự kiện Socket.io `direct:send` nhận tin nhắn từ người gửi, lưu bền vững vào bảng `DirectMessage`, và phát sự kiện `direct:receive` ngay lập tức đến socket của người nhận.
- [ ] Giao diện danh sách cuộc trò chuyện hiển thị các Direct Chat đang có và ô tìm kiếm người dùng mới.
- [ ] Giao diện khung chat 1-1 hiển thị lịch sử tin nhắn, ô nhập văn bản, nút gửi và cập nhật tin nhắn mới theo thời gian thực không cần tải lại trang.
- [ ] Kiểm thử tích hợp hai client Socket.io gửi và nhận tin nhắn 1-1 thành công, dữ liệu được ghi nhận chính xác trong database.
