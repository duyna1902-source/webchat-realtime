# 05: Hỗ trợ Nội dung Phong phú: Bộ chọn Emoji & Tìm kiếm GIF

**What to build:**
Tính năng hỗ trợ biểu tượng cảm xúc (emoji/icon) và hình ảnh động (GIF) trong quá trình soạn thảo và gửi tin nhắn. Người dùng có thể nhấn nút Emoji để mở bảng chọn biểu tượng và chèn trực tiếp vào nội dung văn bản. Người dùng có thể nhấn nút GIF để mở thanh tìm kiếm ảnh động từ API Tenor/Giphy miễn phí, xem trước các kết quả động, và chọn để gửi ngay một tin nhắn dạng `EMOJI_GIF` hiển thị sống động trong khung trò chuyện của cả Direct Chat và Room Chat.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** ready-for-agent

- [ ] Tích hợp component Emoji Picker nhẹ dạng Popover cạnh thanh nhập tin nhắn để chèn ký tự Unicode emoji vào vị trí con trỏ nhập liệu.
- [ ] Tích hợp API tìm kiếm ảnh động (Tenor hoặc Giphy API miễn phí) qua endpoint backend trung gian bảo mật API key hoặc client gọi an toàn.
- [ ] Giao diện Modal tìm kiếm GIF hiển thị danh sách ảnh động trending và kết quả tìm kiếm theo từ khóa có hiệu ứng cuộn mượt mà.
- [ ] Hỗ trợ gửi tin nhắn với `type: EMOJI_GIF` chứa đường dẫn ảnh động trực tiếp tới cơ sở dữ liệu (`DirectMessage` và `RoomMessage`).
- [ ] Giao diện tin nhắn tự động nhận diện và hiển thị ảnh GIF với kích thước tối ưu, hỗ trợ lazy-loading để giữ hiệu năng mượt mà.
- [ ] Đảm bảo các emoji hiển thị chuẩn xác trên mọi trình duyệt và hệ điều hành.
- [ ] Kiểm thử tích hợp gửi và nhận tin nhắn loại `EMOJI_GIF` trong cả Direct Chat và Room Chat.
