# Thiết kế Desktop Dual-Pane Layout và Persistent Detail View

Để đảm bảo trải nghiệm người dùng tối ưu trên máy tính (Laptop/Desktop) song song với thiết kế di động Master-Detail, chúng tôi quyết định chuẩn hóa chiều rộng cố định cho Sidebar trên màn hình lớn và áp dụng cơ chế Persistent Detail View khi duyệt qua lại giữa các tab hội thoại.

## Status
accepted

## Context & Problem
Sau khi áp dụng cơ chế Master-Detail cho mobile (ADR 0006), trên màn hình máy tính (>= 768px), class `md:w-88` chưa được định nghĩa trong cấu hình Tailwind CSS dẫn đến trình duyệt bỏ qua thuộc tính này và áp dụng `w-full` khi chưa chọn cuộc trò chuyện, khiến Sidebar tràn 100% màn hình che khuất cột chi tiết. Ngoài ra, khi người dùng click qua lại giữa hai tab `Direct Chats` và `Rooms` ở Sidebar, cột chi tiết bên phải bị chuyển đổi tức thì về màn hình placeholder trống của tab đó, làm gián đoạn cuộc trò chuyện đang diễn ra.

## Considered Options
- **Tự động đặt lại trạng thái hội thoại khi chuyển tab (Reset on Tab Switch)**: Khi người dùng bấm tab `Rooms`, lập tức xóa `activeChatId` và chuyển sang `RoomChatArea` trống. Bị từ chối vì làm ngắt quãng công việc của người dùng khi chỉ muốn xem lướt danh sách phòng mà vẫn đang nhắn tin dở với một cá nhân.
- **Tách độc lập 2 bộ điều hướng bằng tab route lồng nhau**: Bị từ chối vì tăng độ phức tạp của component state và vi phạm nguyên tắc giữ đơn giản cấu trúc ứng dụng.
- **Dual-Pane Layout cố định 352px với Persistent Detail View (Lựa chọn được chọn)**:
  - Cấu hình kích thước mở rộng `88: '22rem'` (352px) vào Tailwind CSS để Sidebar luôn cố định 352px trên desktop, hiển thị 2 cột song song ngay từ khi vừa mở trang.
  - Khi chưa chọn cuộc trò chuyện nào, cột bên phải hiển thị placeholder tương ứng với tab đang mở ở Sidebar (`Direct Chat` placeholder hoặc `Room Chat` placeholder).
  - Khi đã có một cuộc trò chuyện hoặc phòng đang mở, việc chuyển tab ở Sidebar chỉ làm thay đổi danh sách ở cột trái; cột bên phải giữ nguyên cuộc trò chuyện hiện tại cho đến khi người dùng bấm chọn một hội thoại hoặc phòng mới.

## Consequences
- Màn hình Laptop khi vừa tải xong luôn hiển thị chuẩn xác 2 cột: Sidebar 352px bên trái và màn hình chào bên phải.
- Cột Sidebar đứng im tuyệt đối, không bị co giật hay thay đổi bề rộng khi chuyển tab.
- Người dùng có thể tự do xem danh sách phòng hoặc danh sách chat cá nhân mà không lo bị đóng mất cửa sổ chat đang soạn thảo.
- Giữ nguyên 100% trải nghiệm và tương tác của thiết bị di động đã được hoàn thiện trước đó.
