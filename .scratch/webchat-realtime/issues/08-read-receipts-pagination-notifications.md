# 08: Biên nhận Đã xem (Read Receipts), Phân trang Con trỏ & Thông báo Trình duyệt

**What to build:**
Các tính năng hoàn thiện trải nghiệm giao tiếp: hiển thị biên nhận đã xem tin nhắn (Read Receipts) theo thời gian thực để người gửi biết đối phương đã đọc tin đến đâu; phân trang con trỏ (`Cursor-based Pagination`) giúp tự động tải thêm 50 tin nhắn cũ hơn khi người dùng cuộn chuột lên trên cùng mà không làm đơ giao diện; và hệ thống thông báo đẩy trình duyệt (HTML5 Web Notification kèm âm thanh báo nhẹ) khi có tin nhắn mới gửi đến trong lúc người dùng đang mở tab hoặc cửa sổ khác.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** closed

- [x] Cập nhật và lưu trữ trường `lastReadMessageId` trên bảng `DirectChatParticipant` và `RoomMember` khi người dùng mở hoặc cuộn xem tin nhắn mới.
- [x] Sự kiện Socket.io `direct:read` và `room:read` phát tín hiệu mốc tin nhắn đã đọc tới những người tham gia còn lại trong cuộc trò chuyện.
- [x] Giao diện tin nhắn 1-1 hiển thị biểu tượng trạng thái tin nhắn (Sent: 1 dấu tích, Delivered: 2 dấu tích xám, Read: 2 dấu tích xanh hoặc chữ "Đã xem").
- [x] Giao diện Room Chat hiển thị số lượng hoặc avatar thành viên đã đọc tin nhắn gần nhất.
- [x] API tải lịch sử tin nhắn hỗ trợ tham số con trỏ `?before=<oldestMessageId>&limit=50` trả về các tin nhắn cũ hơn.
- [x] Phía client cài đặt Intersection Observer hoặc sự kiện cuộn (scroll listener) ở đầu khung chat để tự động kích hoạt tải thêm 50 tin nhắn cũ và giữ nguyên vị trí cuộn của người dùng.
- [x] Tích hợp HTML5 Web Notification API với công tắc (toggle) xin quyền thân thiện trên giao diện; phát âm thanh ping nhẹ và hiển thị popup thông báo khi tab không có tiêu điểm (unfocused/background).
- [x] Kiểm thử tích hợp xác nhận cập nhật mốc `lastReadMessageId` và phản hồi sự kiện read receipt thành công.
