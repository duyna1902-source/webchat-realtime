# Chiến lược lưu trữ tệp đính kèm và đồng bộ tin nhắn ngoại tuyến

Hệ thống yêu cầu xử lý tệp đính kèm (hình ảnh/tài liệu tối đa 10MB) và đảm bảo tự động kết nối lại khi mất mạng để đồng bộ dữ liệu mà không tốn chi phí hạ tầng. Chúng tôi quyết định sử dụng Cloudinary/Supabase Storage cho tệp đính kèm và mô hình đồng bộ hai lớp (Socket.io Connection State Recovery kết hợp REST Catch-up API).

## Status
accepted

## Considered Options
- **Lưu file trực tiếp trên ổ cứng máy chủ Render**: Bị từ chối vì ổ cứng của Render là ephemeral disk (tự động xóa sạch dữ liệu sau mỗi lần deploy hoặc restart).
- **Chỉ dựa vào Socket.io để khôi phục gói tin**: Bị từ chối vì nếu người dùng mất mạng lâu hơn vài phút hoặc refresh lại trang, bộ đệm của socket sẽ bị hủy và gây mất tin nhắn.
- **Giải pháp hỗn hợp (Được chọn)**: Lưu file trên cloud storage bên ngoài (Cloudinary/Supabase Storage); dùng Connection State Recovery cho ngắt kết nối ngắn và REST API (`?after=<lastMessageId>`) cho ngắt kết nối dài.

## Consequences
- Hệ thống đảm bảo 100% không mất tin nhắn dù người dùng mất mạng trong vài giây hay vài giờ.
- Tiết kiệm băng thông và tài nguyên cơ sở dữ liệu do tệp nhị phân không nằm trong cơ sở dữ liệu chính.
