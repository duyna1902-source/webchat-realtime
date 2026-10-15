# Thiết kế Master-Detail Navigation và Dynamic Viewport cho Responsive Web

Để hỗ trợ người dùng truy cập trơn tru trên cả máy tính (Laptop/Desktop) và điện thoại di động (Mobile) mà không thay đổi cấu trúc backend hay thêm thư viện định tuyến phức tạp, chúng tôi quyết định áp dụng mô hình Master-Detail Navigation điều khiển bằng Tailwind CSS responsive classes và state nội bộ tại `Dashboard`.

## Status
accepted

## Context & Problem
Trước đây, giao diện được xây dựng dưới dạng 2 cột cố định song song (`Sidebar` 320px và `ChatArea` co giãn). Trên thiết bị di động (< 768px), chiều rộng màn hình hẹp khiến hai cột bị bóp nghẹt, khung chat bị co cụm và không thể sử dụng được. Ngoài ra, chiều cao `100vh` truyền thống bị thanh địa chỉ trình duyệt mobile và bàn phím ảo che khuất.

## Considered Options
- **Bổ sung React Router với các route riêng (`/chat/:id`, `/room/:id`)**: Bị từ chối vì làm phức tạp hóa vòng đời kết nối Socket.io, có nguy cơ gây ngắt kết nối/re-render không cần thiết và vi phạm nguyên tắc giữ nguyên cấu trúc cốt lõi hiện có.
- **Drawer trượt ngang (Slide-out drawer)**: Menu Sidebar trượt đè lên màn hình. Bị từ chối vì chiếm diện tích, gây cản trở thao tác vuốt cuộn tin nhắn và không tự nhiên bằng giao diện chat di động tiêu chuẩn.
- **Master-Detail Navigation bằng Tailwind CSS (Lựa chọn được chọn)**: Trên desktop (>= 768px), giữ nguyên Dual-Pane 2 cột song song. Trên mobile (< 768px), hiển thị luân phiên Sidebar (Master) khi duyệt danh sách và ChatArea (Detail) khi trò chuyện, kèm nút `Back` có class `md:hidden` để quay về.

## Consequences
- Giao diện trên điện thoại thoáng đãng, tối ưu diện tích đọc tin nhắn và gõ phím.
- Giữ nguyên 100% tính liên tục của kết nối Socket.io và state tin nhắn thời gian thực mà không bị unmount.
- Đổi đơn vị chiều cao sang `100dvh` giúp giao diện bám sát khung nhìn thực tế của màn hình di động khi bàn phím ảo xuất hiện.
