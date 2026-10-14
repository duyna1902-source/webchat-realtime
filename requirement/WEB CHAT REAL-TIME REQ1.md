#### WEB CHAT REAL-TIME



##### I. THÔNG TIN CHUNG

* Tên dự án: Web chat real-time
* Mô tả mục tiêu: Xây dựng và triển khai nền tảng nhắn tin trực tiếp và theo phòng, đảm bảo duy trì kết nối hai chiều liên tục theo thời gian thực.

##### II. YÊU CẦU KỸ THUẬT VÀ TIÊU CHÍ NGHIỆM THU CHI TIẾT

* ###### Lưu lượng truy cập nhỏ: tầm 30 users tổng và tầm nhỏ hơn 10 user cùng truy cập nhưng vẫn phải có khả năng chịu tải lớn hơn con số đề ra và các con số đó không phải là giới hạn mà chỉ là ví dụ
* ###### Cần deploy lên browser chứ không chỉ chạy local host. Tuy nhiên hãy sử dụng service và database miễn phí 
* ###### Hệ thống được đánh giá và nghiệm thu theo 3 cấp độ kỹ thuật:
1\. Điều kiện tiên quyết

Các tính năng cần có: 

* Kết nối Real-time 1-1: Thiết lập kết nối hai chiều liên tục và hỗ trợ tính năng chat trực tiếp giữa hai người dùng thông qua giao thức WebSocket hoặc thư viện Socket.io.   
* Quản lý dữ liệu tin nhắn: Tích hợp cơ sở dữ liệu (Database) để lưu trữ bền vững và tải lại toàn bộ lịch sử tin nhắn khi truy cập.   
* Xác thực người dùng: Xây dựng quy trình đăng ký, đăng nhập và cơ chế xác thực người dùng cơ bản bằng JWT (JSON Web Token) hoặc Session.



2\. Tiêu chuẩn khuyến khích 

Các chức năng giúp mở rộng quy mô tương tác và tối ưu giao diện:

* Trò chuyện nhóm (Room chat): Cho phép tạo phòng chat nhóm riêng biệt, hỗ trợ quản lý thêm và xóa thành viên trong phòng.
* Chỉ báo trạng thái thời gian thực: Cập nhật trạng thái trực tuyến/ngoại tuyến (Online/Offline) và phản hồi chỉ báo đang soạn thảo tin nhắn ("Typing...").
* Hỗ trợ nội dung phong phú: Cho phép người dùng gửi và hiển thị các biểu tượng cảm xúc (emoji/icon) cùng hình ảnh động (GIF).



3\. Tiêu chuẩn nâng cao 

Các tính năng hoàn thiện chuyên sâu nhằm đáp ứng tiêu chuẩn sản phẩm thực tế:

* Xử lý tệp đính kèm: Cho phép tải lên hình ảnh và tài liệu có xem trước (preview), đồng thời kiểm soát giới hạn dung lượng tệp an toàn.
* Độ ổn định mạng \& Đồng bộ dữ liệu: Thiết lập cơ chế tự động kết nối lại khi mất mạng và tự động bù đắp/đồng bộ các tin nhắn bị bỏ lỡ trong thời gian ngắt kết nối.
* Thông báo \& Trạng thái đã đọc: Cập nhật biên nhận đã xem tin nhắn (Read receipts) và tích hợp hệ thống thông báo đẩy (Push notifications).





