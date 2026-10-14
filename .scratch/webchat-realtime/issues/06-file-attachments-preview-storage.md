# 06: Đính kèm Tệp, Xem trước Hình ảnh & Lưu trữ Đám mây

**What to build:**
Chức năng tải lên và gửi tệp đính kèm (hình ảnh và tài liệu) an toàn. Người dùng có thể chọn tệp từ máy tính, xem ngay ảnh thu nhỏ xem trước (preview thumbnail) trên client trước khi gửi nếu là hình ảnh, và nhận cảnh báo nếu dung lượng vượt quá giới hạn 10MB. Tệp được tải lên dịch vụ lưu trữ đám mây miễn phí (Cloudinary / Supabase Storage), và đường dẫn tệp kèm siêu dữ liệu (tên file, kích thước, loại file) được lưu vào cơ sở dữ liệu và hiển thị đầy đủ trên khung chat với nút xem/tải về.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** ready-for-agent

- [ ] Cấu hình dịch vụ lưu trữ đám mây (Cloudinary hoặc Supabase Storage bucket) cho tệp tĩnh của dự án.
- [ ] API tải tệp (`POST /api/upload`) kiểm tra nghiêm ngặt định dạng MIME và giới hạn dung lượng tệp (tối đa 10MB), tải lên cloud và trả về URL an toàn cùng siêu dữ liệu.
- [ ] Phía client hiển thị khung xem trước ảnh (image preview thumbnail) bằng `URL.createObjectURL` ngay khi người dùng chọn file ảnh, cho phép hủy chọn hoặc xác nhận gửi.
- [ ] Phía client kiểm tra dung lượng trước khi gửi và thông báo lỗi rõ ràng nếu file vượt quá 10MB.
- [ ] Tin nhắn hỗ trợ lưu trữ các trường `attachmentUrl`, `attachmentName`, `attachmentSize` với `type: IMAGE` hoặc `type: DOCUMENT`.
- [ ] Giao diện hiển thị tin nhắn đính kèm: hình ảnh có thể bấm để phóng to xem chi tiết; tài liệu hiển thị icon định dạng, tên file, dung lượng và nút tải về.
- [ ] Kiểm thử tích hợp tải lên tệp hợp lệ thành công và từ chối tệp vượt quá 10MB.
