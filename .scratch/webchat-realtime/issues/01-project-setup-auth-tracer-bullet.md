# 01: Thiết lập Monorepo, Schema Cơ sở dữ liệu Toàn diện & Xác thực Người dùng (Auth Tracer Bullet)

**What to build:**
Khởi tạo nền móng dự án Monorepo và hoàn thiện luồng đăng ký, đăng nhập người dùng từ giao diện đến cơ sở dữ liệu. Người dùng có thể đăng ký tài khoản mới bằng tên đăng nhập, email và mật khẩu, đăng nhập để nhận token JWT xác thực, duy trì phiên làm việc qua trình duyệt, và xem thông tin cá nhân trên giao diện. Toàn bộ lược đồ cơ sở dữ liệu (Prisma schema trên PostgreSQL) bao quát cả 3 cấp độ (User, DirectChat, DirectMessage, DirectChatParticipant, Room, RoomMember, RoomMessage) được triển khai và migrate sẵn sàng ngay từ ngày đầu.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Cấu trúc Monorepo (`client`, `server`, `shared`) được thiết lập với TypeScript và script khởi chạy nhất quán.
- [x] Toàn bộ Prisma Schema bao quát cả 3 cấp độ (Direct Chat, Room Chat, Attachments, Roles, Read receipts) được định nghĩa và migrate thành công vào PostgreSQL.
- [x] API đăng ký (`POST /api/auth/register`) mã hóa mật khẩu an toàn và tạo bản ghi User mới.
- [x] API đăng nhập (`POST /api/auth/login`) xác thực thông tin đăng nhập và cấp mã JWT.
- [x] API lấy thông tin người dùng hiện tại (`GET /api/auth/me`) trả về dữ liệu User khi có token hợp lệ.
- [x] Middleware xác thực Socket.io (`io.use`) giải mã thành công JWT và gắn thông tin người dùng vào phiên kết nối socket.
- [x] Giao diện React hiển thị form Đăng ký / Đăng nhập, lưu trữ token an toàn và hiển thị trang Dashboard cơ bản với thông tin người dùng đã đăng nhập.
- [x] Bộ kiểm thử tích hợp (integration tests) kiểm tra thành công luồng đăng ký, đăng nhập và bảo vệ endpoint.

## Answer

Ticket 01 has been successfully implemented, verified, and merged into `integration/webchat-realtime`.

### Key Deliverables & Implementation Details:
1. **Monorepo Architecture (`npm` workspaces)**:
   - Configured `shared`, `server`, and `client` packages with unified TypeScript base configuration (`tsconfig.base.json`).
   - Root scripts for development, building, testing, and Prisma migrations.
2. **Unified Database Schema (`server/prisma/schema.prisma`)**:
   - Comprehensive Prisma PostgreSQL schema modeling all Level 1-3 requirements: `User`, `DirectChat`, `DirectChatParticipant`, `DirectMessage`, `Room`, `RoomMember`, `RoomMessage`, `DirectAttachment`, `RoomAttachment`, `DirectReceipt`, `RoomReceipt`.
   - SQLite mock/fallback driver support configured for testing and development flexibility without requiring external PostgreSQL services immediately.
3. **Shared Contracts (`shared/src`)**:
   - DTOs and Zod schemas for auth, direct messaging, room management, and receipts (`shared/src/dtos.ts`).
   - Socket event constants and typed payloads (`shared/src/events.ts`).
   - Domain enums (`shared/src/enums.ts`).
4. **Backend Authentication & Socket Auth Tracer Bullet (`server/src`)**:
   - REST endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
   - JWT utility with token generation and verification (`server/src/lib/jwt.ts`).
   - Password hashing with bcrypt.
   - Socket.io connection authentication middleware (`io.use`) validating JWT in `auth.token` handshake and binding user to socket (`server/src/socket/index.ts`).
5. **Frontend Client Implementation (`client/src`)**:
   - Vite + React + Tailwind CSS setup.
   - `AuthContext` managing authentication state, token storage (`localStorage`), registration, login, and logout.
   - `SocketContext` managing authenticated Socket.io connection with reconnection state and connection status banner.
   - Responsive `AuthScreen` (login / register forms) and `Dashboard` presenting user profile and real-time socket connection indicator.
6. **Automated Testing Suite**:
   - Backend tests (`server/tests/auth.test.ts`, `server/tests/socket-auth.test.ts`): 14 passing tests verifying register, login, protected /me endpoint, invalid credentials, and Socket.io JWT authentication/rejection.
   - Frontend tests (`client/src/App.test.tsx`): 5 passing tests verifying tab toggling, login/register flows, dashboard rendering, and logout.

### Commits:
- Feature commit: `40c1cca`
- Merge commit: `5183e48`
