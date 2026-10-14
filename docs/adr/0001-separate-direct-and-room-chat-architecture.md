# Tách biệt logic và mô hình dữ liệu giữa Direct Chat và Room Chat

Hệ thống cần phục vụ cả nhắn tin trực tiếp 1-1 và phòng chat nhóm. Thay vì gộp chung vào một thực thể `Conversation` duy nhất, chúng tôi quyết định tách biệt hoàn toàn bảng dữ liệu, socket event và service logic giữa `Direct Chat` và `Room Chat`. Quyết định này giúp đơn giản hóa việc phân quyền quản trị phòng (thêm/xóa thành viên, phân quyền admin) mà không làm phức tạp hóa luồng tin nhắn 1-1 vốn có tính chất riêng tư và cố định 2 người.

## Status
accepted

## Considered Options
- **Mô hình hợp nhất Conversation**: Gộp 1-1 và Group vào cùng một thực thể `Conversation` với cờ phân biệt (`type: DIRECT | GROUP`). Bị từ chối vì làm phức tạp hóa các ràng buộc dữ liệu (ví dụ: Direct Chat bắt buộc 2 người, không có admin, không thể rời phòng) và lẫn lộn logic socket event.
- **Tách riêng biệt (Lựa chọn được chọn)**: Xây dựng các thực thể `DirectChat` & `DirectMessage` riêng biệt với `RoomChat`, `RoomMember` & `RoomMessage`.

## Consequences
- Mỗi tính năng chung (như tin nhắn, đính kèm tệp, read receipt) sẽ được triển khai rõ ràng theo ngữ cảnh tương ứng mà không sinh ra logic rẽ nhánh `if (type === 'DIRECT')`.
- Các sự kiện Socket.io sẽ có namespace hoặc tiền tố riêng biệt (ví dụ: `direct:*` và `room:*`), giúp dễ debug và kiểm thử độc lập.
