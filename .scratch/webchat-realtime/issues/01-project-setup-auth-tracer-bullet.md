# 01: Thiết lập Monorepo, Schema Cơ sở dữ liệu Toàn diện & Xác thực Người dùng (Auth Tracer Bullet)

**What to build:**
Khởi tạo nền móng dự án Monorepo và hoàn thiện luồng đăng ký, đăng nhập người dùng từ giao diện đến cơ sở dữ liệu. Người dùng có thể đăng ký tài khoản mới bằng tên đăng nhập, email và mật khẩu, đăng nhập để nhận token JWT xác thực, duy trì phiên làm việc qua trình duyệt, và xem thông tin cá nhân trên giao diện. Toàn bộ lược đồ cơ sở dữ liệu (Prisma schema trên PostgreSQL) bao quát cả 3 cấp độ (User, DirectChat, DirectMessage, DirectChatParticipant, Room, RoomMember, RoomMessage) được triển khai và migrate sẵn sàng ngay từ ngày đầu.

**Blocked by:** None (can start immediately)

**Status:** claimed

- [ ] Cấu trúc Monorepo (`client`, `server`, `shared`) được thiết lập với TypeScript và script khởi chạy nhất quán.
- [ ] Toàn bộ Prisma Schema bao quát cả 3 cấp độ (Direct Chat, Room Chat, Attachments, Roles, Read receipts) được định nghĩa và migrate thành công vào PostgreSQL.
- [ ] API đăng ký (`POST /api/auth/register`) mã hóa mật khẩu an toàn và tạo bản ghi User mới.
- [ ] API đăng nhập (`POST /api/auth/login`) xác thực thông tin đăng nhập và cấp mã JWT.
- [ ] API lấy thông tin người dùng hiện tại (`GET /api/auth/me`) trả về dữ liệu User khi có token hợp lệ.
- [ ] Middleware xác thực Socket.io (`io.use`) giải mã thành công JWT và gắn thông tin người dùng vào phiên kết nối socket.
- [ ] Giao diện React hiển thị form Đăng ký / Đăng nhập, lưu trữ token an toàn và hiển thị trang Dashboard cơ bản với thông tin người dùng đã đăng nhập.
- [ ] Bộ kiểm thử tích hợp (integration tests) kiểm tra thành công luồng đăng ký, đăng nhập và bảo vệ endpoint.
