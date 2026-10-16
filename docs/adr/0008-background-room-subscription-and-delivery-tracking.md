# Cơ chế tự động đăng ký kênh Room Chat nền và đồng bộ Delivery Status

Để hỗ trợ cập nhật số lượng tin nhắn chưa đọc (`Unread Count Badge`), thông báo nền cho `Room Chat`, và cập nhật trạng thái chuyển phát (`Delivery Status`) từ `SENT` sang `DELIVERED` khi người nhận kết nối mạng trở lại, chúng tôi quyết định tự động đưa socket của người dùng vào tất cả các kênh `Room Chat` mà họ là thành viên ngay khi kết nối, đồng thời bổ sung sự kiện `direct:delivered` khi người dùng trực tuyến.

## Status
accepted

## Context & Problem
Ở thiết kế ban đầu, socket của người dùng chỉ tham gia vào kênh `room:${roomId}` khi họ bấm mở phòng đó trên giao diện (`room:join`) và rời kênh (`room:leave`) ngay khi chuyển sang cuộc trò chuyện khác. Điều này khiến người dùng không nhận được tin nhắn thời gian thực, cập nhật `Unread Count Badge` hay thông báo từ các `Room Chat` khác khi đang ở ngoài phòng. Bên cạnh đó, các `Direct Message` được gửi khi người nhận đang ngoại tuyến (`SENT`) chưa tự động chuyển sang `DELIVERED` khi người nhận kết nối lại mà phải đợi đến khi người nhận mở khung chat (`READ`).

## Considered Options
- **Chỉ join kênh phòng khi mở màn hình phòng (On-Demand Room Subscription)**: Tiết kiệm tài nguyên bộ nhớ kênh của Socket.io nhưng khiến Sidebar bị trễ dữ liệu, không thể hiển thị `Unread Count Badge` hay phát thông báo thời gian thực cho các phòng không mở.
- **Phát sự kiện Room qua từng kênh cá nhân (`user:${userId}`) cho mọi tin nhắn nhóm**: Buộc máy chủ phải truy vấn danh sách thành viên phòng và lặp phát sự kiện ở mỗi lần gửi tin nhắn, gây tốn tài nguyên truy vấn hơn so với cơ chế multicast sẵn có của Socket.io room.
- **Tự động đăng ký toàn bộ kênh `Room Chat` khi kết nối Socket & Đồng bộ `direct:delivered` khi kết nối (Lựa chọn được chọn)**:
  - Ngay khi xác thực kết nối Socket.io thành công, máy chủ truy vấn danh sách các `Room Chat` mà người dùng đang là `Room Member` và tự động `socket.join('room:${roomId}')` cho toàn bộ các phòng đó.
  - Khi thêm mới hoặc xóa thành viên (`JOIN`, `KICK`, `DELETE`), máy chủ đồng bộ trạng thái tham gia kênh socket và phát sự kiện tới cả phòng lẫn kênh định danh cá nhân `user:${targetUserId}`.
  - Khi người dùng kết nối socket (`handleUserConnect`), máy chủ tự động chuyển các `Direct Message` đang ở trạng thái `SENT` gửi tới người dùng đó sang `DELIVERED` và phát sự kiện `direct:delivered` về cho người gửi.

## Consequences
- `Unread Count Badge`, tin nhắn cuối (`lastMessage`) trên Sidebar và hệ thống thông báo hoạt động tức thì theo thời gian thực cho cả `Direct Chat` lẫn tất cả `Room Chat` mà người dùng tham gia.
- Người gửi `Direct Message` thấy trạng thái chuyển đổi trực quan bên dưới bong bóng tin nhắn theo phong cách tối giản tiếng Anh (`Sent` $\rightarrow$ `Delivered` $\rightarrow$ `Seen [Mini-Avatar]`, không sử dụng dấu tích). Nhãn `Seen [Mini-Avatar]` hoạt động như một dấu mốc đọc (`Read Receipt` watermark) duy nhất: khi người nhận xem tin nhắn mới hơn, nhãn `Seen` ở dưới tin nhắn cũ sẽ tự động biến mất và di chuyển xuống dưới tin nhắn mới nhất đã được xem.
- Vẫn giữ nguyên tính tương thích ngược của các sự kiện `room:join` và `room:leave` hiện có.
