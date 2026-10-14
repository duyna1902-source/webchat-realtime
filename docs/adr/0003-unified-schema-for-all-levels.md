# Thiết kế cơ sở dữ liệu toàn diện bao quát 3 cấp độ ngay từ đầu

Để thực hiện trọn vẹn cả 3 cấp độ yêu cầu mà không phải thực hiện database migration trong tương lai, chúng tôi quyết định định nghĩa schema cơ sở dữ liệu hoàn chỉnh ngay từ lần migration đầu tiên, tách biệt thực thể Direct Chat và Room Chat, đồng thời tích hợp sẵn các trường dữ liệu cho tệp đính kèm và biên nhận đã đọc.

## Status
accepted

## Considered Options
- **Phân kỳ migration theo từng cấp độ**: Chỉ tạo bảng User và Direct Chat ở giai đoạn 1, sau đó bổ sung Room và Attachment ở các giai đoạn sau. Bị từ chối vì làm phát sinh nguy cơ lỗi migration trên production và yêu cầu can thiệp schema nhiều lần.
- **Tạo trước schema hoàn chỉnh cho 3 cấp độ (Được chọn)**: Xây dựng sẵn các bảng `User`, `DirectChat`, `DirectMessage`, `DirectChatParticipant`, `Room`, `RoomMember`, và `RoomMessage` với đầy đủ các trường đính kèm và cờ trạng thái.

## Consequences
- Schema cơ sở dữ liệu ổn định tuyệt đối và sẵn sàng cho mọi tính năng nâng cao mà không cần can thiệp migration sau này.
- Các API và module nghiệp vụ có thể khai thác trực tiếp các quan hệ (foreign keys) đã được thiết lập chặt chẽ.
