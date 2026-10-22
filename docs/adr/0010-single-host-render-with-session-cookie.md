# Single-host trên Render với session cookie HttpOnly thay cho JWT trong localStorage

ADR 0002 mô tả frontend trên Vercel và backend trên Render, nhưng production thực tế chạy **single-host**: Render phục vụ cả SPA lẫn API tại `webchat-realtime.onrender.com`. Token JWT lại nằm trong localStorage, nên bất kỳ lỗ XSS nào cũng lấy được token đó, và token không thu hồi được (SEC-11). Chúng tôi quyết định:
- Chính thức hóa **single-host trên Render**, bỏ Vercel.
- **Bỏ JWT** và thay bằng **Session lưu trong DB**. Trình duyệt giữ Session bằng cookie `__Host-session` với các cờ `HttpOnly; Secure; SameSite=Strict`. Cookie chỉ chứa token ngẫu nhiên, còn DB chỉ lưu mã băm của token.
- Chống CSRF bằng `SameSite=Strict` cộng kiểm tra `Origin`, áp dụng cho mọi request thay đổi dữ liệu và cho handshake Socket.IO.

ADR này thay thế phần "React (Vite) triển khai trên Vercel" của ADR 0002.

## Status
accepted

## Considered Options
- **Vercel (SPA) + Render (API), giữ Bearer token trong localStorage:** giao diện tải nhanh qua CDN và không bị trắng trang khi Render cold start. Bị từ chối vì `vercel.app` và `onrender.com` khác site: cookie khi đó là cookie bên thứ ba và đang bị các trình duyệt chặn dần, nên token buộc phải nằm ở nơi JavaScript đọc được. Phương án này còn cần CORS allowlist, cấu hình CSP ở hai nơi, và phải dựng mới Vercel vì hiện không có bản deploy nào.
- **Domain riêng với hai subdomain cùng site:** có được cả cookie lẫn CDN. Bị từ chối vì dự án không có domain riêng.
- **JWT trong cookie HttpOnly:** vẫn không thu hồi được nếu không có bảng tra cứu. Khi đã phải tra DB mỗi request thì JWT không còn lợi ích gì, lại thêm một secret ký token phải quản lý (chính là nguồn gốc của SEC-01 và SEC-02).

## Consequences
- Render free ngủ sau 15 phút, nên lần mở đầu tiên **trắng trang 30–50 giây**. Đánh đổi này được chấp nhận. Một monitor ping `/health` là tùy chọn khắc phục, được ghi trong runbook.
- Không còn CORS. Dev phải đi qua proxy Vite để giữ cùng origin với production.
- Mỗi request REST tốn thêm một truy vấn tra Session.
- Thêm Vercel hoặc tách domain sau này sẽ đòi xem lại cả cơ chế cookie, nên phải viết ADR mới.
