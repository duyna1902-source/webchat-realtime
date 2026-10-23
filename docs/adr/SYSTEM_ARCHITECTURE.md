# TÀI LIỆU THIẾT KẾ KIẾN TRÚC HỆ THỐNG
# DỰ ÁN: WEB CHAT REAL-TIME

> **Phiên bản**: 1.2.0  
> **Ngày lập**: 19/10/2026 (cập nhật 23/10/2026 theo đợt nâng cấp bảo mật: [ADR 0009](./0009-private-attachments-via-records-and-signed-urls.md), [ADR 0010](./0010-single-host-render-with-session-cookie.md))  
> **Trạng thái**: Hoàn thiện & Đã nghiệm thu  
> **Mục đích**: Tài liệu tổng hợp toàn diện kiến trúc kỹ thuật, mô hình dữ liệu, giao thức thời gian thực, thiết kế giao diện đa thiết bị và chiến lược hạ tầng của dự án Web Chat Real-Time (GDG-HUST Realtime Chat).

---

## MỤC LỤC
1. [Tổng quan Dự án & Yêu cầu Nghiệp vụ](#1-tổng-quan-dự-án--yêu-cầu-nghiệp-vụ)
2. [Nguyên tắc Thiết kế & Kiến trúc Tổng thể](#2-nguyên-tắc-thiết-kế--kiến-trúc-tổng-thể)
3. [Cấu trúc Monorepo & Hợp đồng Dữ liệu](#3-cấu-trúc-monorepo--hợp-đồng-dữ-liệu)
4. [Mô hình Dữ liệu & Thiết kế Cơ sở Dữ liệu (Database Design)](#4-mô-hình-dữ-liệu--thiết-kế-cơ-sở-dữ-liệu-database-design)
5. [Kiến trúc Giao thức Thời gian thực (Real-time Socket.io Protocol)](#5-kiến-trúc-giao-thức-thời-gian-thực-real-time-socketio-protocol)
6. [Chiến lược Chống Gián đoạn & Đồng bộ Dữ liệu 2 Lớp (Dual-Layer Sync)](#6-chiến-lược-chống-gián-đoạn--đồng-bộ-dữ-liệu-2-lớp-dual-layer-sync)
7. [Kiến trúc Lưu trữ Tệp & Đa phương tiện (Attachment & Media Strategy)](#7-kiến-trúc-lưu-trữ-tệp--đa-phương-tiện-attachment--media-strategy)
8. [Kiến trúc Phía Client (Frontend SPA Architecture)](#8-kiến-trúc-phía-client-frontend-spa-architecture)
9. [Chiến lược Triển khai Hạ tầng Free-Tier & DevOps](#9-chiến-lược-triển-khai-hạ-tầng-free-tier--devops)
10. [Kiến trúc Kiểm thử & Đảm bảo Chất lượng (Testing & QA)](#10-kiến-trúc-kiểm-thử--đảm-bảo-chất-lượng-testing--qa)

---

## 1. TỔNG QUAN DỰ ÁN & YÊU CẦU NGHIỆP VỤ

### 1.1. Mục tiêu
Xây dựng và vận hành một nền tảng web nhắn tin hai chiều thời gian thực (**GDG-HUST Realtime Chat**) dành cho cộng đồng sinh viên công nghệ Google Developer Groups on Campus • Hanoi University of Science and Technology, cho phép người dùng giao tiếp trực tiếp (1-1) và theo nhóm (Room Chat), hoạt động ổn định trên cả máy tính và điện thoại di động với chi phí hạ tầng **0 đồng (Free-Tier)**.

### 1.2. Ba Cấp độ Yêu cầu Kỹ thuật
Hệ thống được thiết kế và đáp ứng trọn vẹn 3 cấp độ:
- **Cấp độ 1 (Điều kiện tiên quyết)**:
  - Kết nối Real-time hai chiều ổn định qua WebSocket / Socket.io.
  - Lưu trữ lịch sử tin nhắn bền vững trong Database, truy xuất tin nhắn cũ khi mở lại chat.
  - Xác thực người dùng bằng Session lưu trong DB, trình duyệt giữ Session qua cookie `HttpOnly` (`__Host-session`), dùng chung cho cả HTTP REST API và Socket Handshake.
- **Cấp độ 2 (Tiêu chuẩn khuyến khích)**:
  - Phòng trò chuyện nhóm (Room Chat) với phân cấp quản trị: Chủ phòng (`OWNER`), Quản trị viên (`ADMIN`), Thành viên (`MEMBER`).
  - Trạng thái hiện diện thời gian thực (Presence: Online / Offline / Last seen) có bộ đệm chống nhấp nháy.
  - Chỉ báo đang soạn thảo tin nhắn (Typing Indicator) thời gian thực.
  - Hỗ trợ nội dung phong phú: Bộ chọn Emoji tiêu chuẩn và tìm kiếm ảnh động (GIF) qua Giphy API.
- **Cấp độ 3 (Tiêu chuẩn nâng cao)**:
  - Tải lên và quản lý tệp đính kèm (hình ảnh có thumbnail preview + lightbox, tài liệu có xem trước trực tiếp Document Preview) tối đa 10MB, lưu trong bucket private và xem qua signed URL có hạn.
  - Khôi phục mạng tự động và đồng bộ tin nhắn bỏ lỡ 2 lớp (Connection State Recovery + REST Catch-up Sync).
  - Biên nhận chuyển phát & đã xem tin nhắn (`SENT` $\rightarrow$ `DELIVERED` $\rightarrow$ `READ` / `Seen [Mini-Avatar]`) theo thời gian thực và đếm số tin chưa đọc (`unreadCount`).
  - Tải lịch sử tin nhắn bằng con trỏ phân trang (Cursor-based Pagination) phục vụ cuộn vô tận mượt mà.
  - Thông báo đẩy trình duyệt (HTML5 Web Notifications) kèm chuông báo âm thanh khi ứng dụng ở chế độ nền.

### 1.3. Bảng Thuật ngữ Nghiệp vụ Chuẩn (Domain Glossary)
Định nghĩa đầy đủ theo [`GLOSSARY.md`](../../GLOSSARY.md):
- **User**: Tài khoản người dùng đã định danh và xác thực qua một Session còn hiệu lực.
- **Session**: Phiên đăng nhập của một User trên một thiết bị, lưu trong DB. Kết thúc khi đăng xuất, hết hạn (7 ngày không hoạt động, tối đa 30 ngày) hoặc bị thu hồi; "đăng xuất mọi thiết bị" thu hồi toàn bộ Session của User.
- **Direct Chat**: Không gian trò chuyện riêng tư giữa đúng 2 người dùng độc lập.
- **Direct Chat Participant**: Bản ghi liên kết giữa người dùng và một Direct Chat để quản lý vị trí đọc (`lastReadMessageId`) của từng người.
- **Direct Message**: Bản ghi tin nhắn thuộc một Direct Chat cụ thể.
- **Room Chat**: Không gian trò chuyện nhóm dành cho nhiều thành viên, có quản trị viên và quyền thêm/xóa thành viên.
- **Room Member & Room Role**: Thành viên trong Room Chat với vai trò phân cấp gồm `OWNER` (chủ phòng), `ADMIN` (quản trị viên), và `MEMBER` (thành viên).
- **Room Message**: Bản ghi tin nhắn thuộc một Room Chat cụ thể.
- **Presence & Presence Grace Period**: Trạng thái trực tuyến (`Online` / `Offline`) cùng thời điểm hoạt động cuối (`lastSeenAt`), kết hợp khoảng đệm 5 giây khi ngắt kết nối nhằm tránh nhấp nháy khi tải lại trang (F5).
- **Typing Indicator**: Tín hiệu thời gian thực báo người dùng đang soạn thảo nội dung.
- **Delivery Status**: Trạng thái chuyển phát của Direct Message qua 3 nấc: đã gửi lên hệ thống (`SENT`), đã chuyển tới người nhận đang trực tuyến (`DELIVERED`), và người nhận đã mở xem (`READ`).
- **Read Receipt & Unread Count Badge**: Dấu mốc ghi nhận người nhận đã xem tin nhắn thông qua `lastReadMessageId`, từ đó tính tổng lượng tin nhắn mới chưa xem (`unreadCount`).
- **Attachment & Document Preview**: Tệp đính kèm (hình ảnh, tài liệu) là một bản ghi do server quản lý, gắn với đúng một tin nhắn; tệp nằm trong bucket private và chỉ Direct Chat Participant hoặc Room Member hiện tại mới nhận được signed URL để xem. Document Preview là khả năng xem trực tiếp nội dung/thông tin tệp ngay trong ứng dụng trước khi tải về.
- **Connection State Recovery & Catch-up Sync**: Cơ chế của Socket.io tự khôi phục gói tin khi mất mạng ngắn (< 2 phút) kết hợp quy trình gọi REST API (`?after=...`) để kéo tin nhắn bị bỏ lỡ sau gián đoạn dài. Connection State Recovery chỉ khôi phục gói tin, không khôi phục quyền: Session và tư cách Room Member được kiểm tra lại khi kết nối được khôi phục.
- **Cursor-based Pagination**: Cơ chế phân trang tải lịch sử tin nhắn sử dụng mốc con trỏ ID tin nhắn (mặc định 50 tin nhắn mới nhất và tải thêm khi cuộn lên).
- **GDG Brand Identity & Google Palette Semantics**: Nhận diện chính thức của cộng đồng `GDG-HUST` kết hợp bảng màu chuẩn Google (`#4285F4` Blue, `#EA4335` Red, `#FBBC04` Yellow, `#34A853` Green, `#F1F3F4`/`#F8F9FA`/`#202124` Greys).
- **Deterministic 4-Color Avatar**: Cơ chế gán màu đại diện tự động dựa trên hàm băm (hash) tên đăng nhập/ID theo 4 gam màu chủ đạo của Google khi người dùng chưa có ảnh đại diện.
- **Zero-Shift Auth Architecture & Ultra-Compact Header**: Bố cục thẻ đăng nhập cố định chiều cao (`540px` card, `275px` form container) chống nhảy khung hình khi chuyển tab Đăng nhập/Đăng ký, và thanh tiêu đề gọn `42px` (`h-11`) tối ưu không gian chat.
- **Master-Detail Navigation & Dynamic Viewport Height**: Điều hướng hiển thị luân phiên giữa danh sách hội thoại (Master) và khung chat (Detail) trên màn hình di động (`< 768px`) sử dụng đơn vị chiều cao động `100dvh`.
- **Dual-Pane Desktop Layout & Persistent Detail View**: Bố cục 2 cột song song trên màn hình lớn (`>= 768px`) với Sidebar cố định `352px` (`md:w-88`) và cơ chế giữ nguyên cuộc trò chuyện đang mở ở cột phải khi duyệt chuyển tab danh mục ở cột trái.

---

## 2. NGUYÊN TẮC THIẾT KẾ & KIẾN TRÚC TỔNG THỂ

### 2.1. Các Quyết định Kiến trúc Cốt lõi (ADRs)
1. **[ADR 0001](./0001-separate-direct-and-room-chat-architecture.md) - Phân tách Tuyệt đối Direct Chat và Room Chat**:
   - *Quyết định*: Không gộp chung vào bảng `conversations` dùng cờ `type: DIRECT | GROUP`.
   - *Lý do*: Direct Chat luôn cố định 2 người, không có khái niệm admin, không rời phòng. Room Chat có phân quyền, thêm/xóa thành viên. Phân tách giúp loại bỏ code rẽ nhánh `if/else`, đơn giản hóa phân quyền và chia tách namespace sự kiện rõ ràng.
2. **[ADR 0002](./0002-tech-stack-and-free-tier-hosting.md) - Full-stack TypeScript & Free-Tier Hosting**:
   - Node.js + Express + Socket.io chạy trên **Render Web Service** (hỗ trợ Persistent WebSocket miễn phí).
   - React + Vite SPA. Phần "SPA triển khai trên Vercel" đã bị ADR 0010 thay thế: SPA nay do chính server trên Render phục vụ.
   - **PostgreSQL** trên Supabase kết hợp Prisma ORM.
3. **[ADR 0003](./0003-unified-schema-for-all-levels.md) - Schema Hợp nhất Toàn diện từ Ngày đầu**:
   - Định nghĩa toàn bộ thực thể và quan hệ cho cả 3 cấp độ trong một bản schema Prisma duy nhất, loại bỏ rủi ro migration cơ sở dữ liệu trên production trong tương lai.
4. **[ADR 0004](./0004-offline-sync-and-attachment-strategy.md) - Chiến lược Lưu trữ Cloud & Đồng bộ Ngoại tuyến 2 Lớp**:
   - Tệp nhị phân không lưu trên ổ cứng tạm (ephemeral disk) của máy chủ hay trong DB chính, mà lưu trên Supabase Storage. Phần "liên kết vào tin nhắn bằng URL public" đã bị ADR 0009 thay thế. Adapter Cloudinary đã bị gỡ.
   - Cơ chế đồng bộ 2 tầng: Socket Buffer (< 2 phút) và REST Catch-up (> 2 phút).
5. **[ADR 0005](./0005-monorepo-structure-and-shared-contracts.md) - Cấu trúc Monorepo & Hợp đồng Dữ liệu Dùng chung**:
   - Sử dụng package `shared` chứa toàn bộ Enums, DTOs và Socket Events, đảm bảo an toàn kiểu dữ liệu (Type-Safety) 100% giữa Client và Server.
6. **[ADR 0006](./0006-mobile-responsive-master-detail-layout.md) - Thiết kế Master-Detail Navigation và Dynamic Viewport cho Responsive Web**:
   - Điều khiển bố cục bằng Tailwind CSS responsive classes và state nội bộ tại `Dashboard` cùng chiều cao `100dvh`, hiển thị luân phiên danh sách và khung chat trên điện thoại (`< 768px`) mà không cần unmount hay ngắt kết nối Socket.io.
7. **[ADR 0007](./0007-desktop-dual-pane-layout-and-persistent-detail-view.md) - Thiết kế Desktop Dual-Pane Layout và Persistent Detail View**:
   - Cố định chiều rộng Sidebar `352px` (`md:w-88`) trên màn hình lớn (`>= 768px`) và duy trì cuộc trò chuyện đang mở ở cột chi tiết khi người dùng chuyển đổi qua lại giữa hai tab `Direct Chats` và `Rooms`.
8. **[ADR 0008](./0008-background-room-subscription-and-delivery-tracking.md) - Cơ chế Tự động Đăng ký Kênh Room Chat Nền và Đồng bộ Delivery Status**:
   - Tự động đưa socket của người dùng vào toàn bộ các kênh `room:<roomId>` mà họ là thành viên ngay khi kết nối, đồng thời tự động nâng trạng thái các `Direct Message` từ `SENT` sang `DELIVERED` (phát sự kiện `direct:delivered`) khi người nhận trực tuyến trở lại.
9. **[ADR 0009](./0009-private-attachments-via-records-and-signed-urls.md) - Attachment riêng tư qua bản ghi server, bucket private và signed URL**:
   - Mỗi lần upload tạo một bản ghi Attachment do server quản lý, gắn với đúng một tin nhắn. Client chỉ gửi `attachmentId`, không còn tự khai URL, tên, kích thước.
   - Tệp nằm trong bucket private. Server ký signed URL có hạn 1 giờ cho Direct Chat Participant và Room Member hiện tại, kèm endpoint làm mới URL có kiểm tra quyền.
10. **[ADR 0010](./0010-single-host-render-with-session-cookie.md) - Single-host trên Render với session cookie HttpOnly thay cho JWT trong localStorage**:
   - Render phục vụ cả SPA, REST API và Socket.IO trên cùng một origin. Không dùng Vercel, không có CORS.
   - Bỏ JWT, thay bằng Session lưu trong DB và cookie `__Host-session` (`HttpOnly; Secure; SameSite=Strict`). Chống CSRF bằng `SameSite=Strict` cộng kiểm tra `Origin`.

### 2.2. Sơ đồ Kiến trúc Phân tầng (Layered Architecture)

```mermaid
flowchart TB
    subgraph ClientApp ["Client Layer (React SPA)"]
        UI["UI Components (Tailwind CSS, Lucide Icons)"]
        Hooks["Custom Hooks (useDirectMessages, usePresence, useTyping, useRooms)"]
        Contexts["Global State (AuthContext, SocketContext)"]
        NotificationMgr["Notification Service (HTML5 Web Notifications + Sound)"]
        
        UI --> Hooks
        Hooks --> Contexts
        Hooks --> NotificationMgr
    end

    subgraph SharedPackage ["Shared Contracts Layer (@webchat/shared)"]
        DTO["Data Transfer Objects (DTOs)"]
        Enum["Enums (MessageType, MessageStatus, RoomRole)"]
        Events["SOCKET_EVENTS Constants & Payloads"]
    end

    subgraph ServerApp ["Backend Layer (Node.js & Express)"]
        HTTPRouter["Express REST Endpoints (/api/*)"]
        SocketServer["Socket.io Server Engine"]
        Middlewares["Security Headers, Origin Check, Session Auth, Rate Limit & Upload"]
        Sessions["Session Store (create / resolve / revoke)"]
        PresenceHandler["Presence Manager (Grace Period Timer Map)"]
        StorageEngine["Storage Adapter (Supabase / Local / In-memory)"]
        PrismaService["Prisma ORM Client (pg Pool / PGlite Adapter)"]

        HTTPRouter --> Middlewares
        Middlewares --> Sessions
        Sessions --> PrismaService
        Middlewares --> PrismaService
        SocketServer --> Sessions
        SocketServer --> PresenceHandler
        SocketServer --> PrismaService
        HTTPRouter --> StorageEngine
    end

    subgraph ExternalServices ["Data & Infrastructure Layer"]
        Postgres[("PostgreSQL (Supabase, RLS bật; PGlite khi test)")]
        CloudFiles[("Supabase Storage: bucket private 'attachments'")]
        Giphy["Giphy Search API"]
    end

    Contexts -- "REST API cùng origin + cookie __Host-session" --> HTTPRouter
    Contexts -- "WebSocket / Polling cùng origin + cookie" --> SocketServer
    UI -. "signed URL (1 giờ)" .-> CloudFiles
    ClientApp -. "Type Safety & zod schemas" .-> SharedPackage
    ServerApp -. "Type Safety & zod schemas" .-> SharedPackage
    PrismaService --> Postgres
    StorageEngine --> CloudFiles
    HTTPRouter --> Giphy
```

Server được dựng bằng một **server factory** duy nhất (`createServer` trong [`server/src/server.ts`](../../server/src/server.ts)), nhận *cấu hình đã validate* từ [`server/src/config.ts`](../../server/src/config.ts) và *storage adapter*. Entrypoint production chỉ nạp `.env`, gọi `loadConfig`, dựng storage adapter thật rồi listen. Không module nào khác đọc thẳng `process.env`, và server từ chối khởi động khi thiếu cấu hình bắt buộc (liệt kê mọi biến sai, không bao giờ dùng secret mặc định).

### 2.3. Luồng Xác thực bằng Session Cookie (ADR 0010)

```mermaid
sequenceDiagram
    autonumber
    actor Browser as Trình duyệt
    participant Server as Express + Socket.IO (cùng origin)
    participant Store as Session Store
    participant DB as PostgreSQL

    Browser->>Server: POST /api/auth/login { emailOrUsername, password } (Origin = APP_ORIGIN)
    Server->>Server: Kiểm tra Origin, rate limit, validate (zod), so khớp bcrypt
    Server->>Store: create(userId, { ip, userAgent })
    Store->>DB: INSERT Session (chỉ lưu SHA-256 của token)
    Server-->>Browser: 200 { user } + Set-Cookie: __Host-session=<token>; HttpOnly; Secure; SameSite=Strict
    Browser->>Server: GET /api/auth/me (cookie tự gửi kèm)
    Server->>Store: resolve(token)
    Store->>DB: Tra Session theo tokenHash, kiểm tra hạn idle 7 ngày / absolute 30 ngày
    Server-->>Browser: 200 { user } (hoặc 401 → về màn đăng nhập)
    Browser->>Server: Handshake Socket.IO (cookie + Origin)
    Server->>Store: resolve(token), join user:<userId> và session:<sessionId>
    Browser->>Server: POST /api/auth/logout-all
    Server->>Store: revokeAllForUser(userId)
    Store->>DB: DELETE mọi Session của User
    Server-->>Browser: session:ended rồi ngắt mọi socket của User, 204 + xóa cookie
```

- **Token và cookie:** token là 32 byte ngẫu nhiên, chỉ xuất hiện trong cookie `__Host-session`. JavaScript trên trang không đọc được cookie này, và DB chỉ lưu mã băm SHA-256 của token. `lastActiveAt` được cập nhật tối đa 5 phút một lần.
- **Chống CSRF:** mọi `POST`, `PATCH`, `PUT`, `DELETE` phải có `Origin` bằng đúng `APP_ORIGIN` (hoặc `Sec-Fetch-Site: same-origin` khi không có `Origin`), nếu không thì nhận `403`. Handshake Socket.IO cũng bị kiểm tra `Origin` để chống Cross-Site WebSocket Hijacking.
- **Thu hồi:** đăng xuất thu hồi Session hiện tại, "đăng xuất mọi thiết bị" thu hồi mọi Session của User, và người vận hành dùng lệnh `npm run sessions:revoke --workspace=server -- --user <username|id>` hoặc `-- --all` (xem [runbook xử lý sự cố](../incident-runbook.md#3-contain-revoke-sessions)). Thu hồi bên trong server ngắt socket ngay; thu hồi từ lệnh CLI được server phát hiện ở lần kiểm tra lại Session kế tiếp (mặc định 60 giây). Mỗi socket còn tự ngắt đúng lúc Session đạt hạn absolute.
- **Lớp phòng thủ đi kèm:** `helmet` gắn CSP chặt, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` cho mọi response; mọi body REST và payload socket được parse bằng schema zod dùng chung; login, đăng ký, upload, tìm kiếm, GIF, tạo room và gửi tin đều bị giới hạn tần suất; lỗi chỉ trả `{ message, code, requestId }`; các sự kiện bảo mật được ghi log JSON có cấu trúc (`pino`).

---

## 3. CẤU TRÚC MONOREPO & HỢP ĐỒNG DỮ LIỆU

Dự án được cấu trúc dạng Monorepo với công cụ quản lý package tiêu chuẩn của NPM Workspaces:

```
webchat-realtime/
├── package.json                 # Monorepo root config (workspaces: shared, server, client)
├── tsconfig.base.json           # Cấu hình TypeScript chuẩn dùng chung
├── render.yaml                  # Blueprint Render (single-host, không chứa giá trị secret nào)
├── SECURITY.md                  # Chính sách bảo mật: phạm vi, kênh báo lỗ hổng riêng tư, rủi ro đã chấp nhận
├── GLOSSARY.md                  # Danh mục thuật ngữ chuẩn hóa của hệ thống (GDG-HUST)
├── .githooks/pre-commit         # Hook gitleaks chặn commit có secret
├── image_gdg/                   # Bộ tài nguyên thương hiệu GDG-HUST (banner, logo)
├── docs/                        # Tài liệu hệ thống và các bản ADR
│   ├── adr/                     # Architecture Decision Records (0001 - 0010) & SYSTEM_ARCHITECTURE.md
│   ├── database-migrations.md   # Quy trình Prisma Migrate và lệnh nâng cấp dữ liệu
│   ├── incident-runbook.md      # Runbook xử lý sự cố bảo mật
│   └── agents/                  # Tài liệu hướng dẫn quy trình dành cho AI Agents
├── shared/                      # Package dùng chung giữa Client và Server (@webchat/shared)
│   └── src/
│       ├── dtos.ts              # DTOs: SelfUserDto, PublicUserDto, DirectChat, Room, Pagination
│       ├── enums.ts             # Enums: RoomRole, MessageType, MessageStatus
│       ├── errors.ts            # ERROR_CODES dùng chung cho lỗi REST và callback socket
│       ├── validation.ts        # Schema zod dùng chung (tài khoản, room, tin nhắn, tìm kiếm)
│       └── events.ts            # SOCKET_EVENTS, các interface payload, AttachmentDto
├── server/                      # Ứng dụng Backend API & WebSocket (@webchat/server)
│   ├── prisma/
│   │   ├── schema.prisma        # Định nghĩa cấu trúc cơ sở dữ liệu Prisma
│   │   ├── migrations/          # Migration có version (0_baseline, RLS, Session, expand...)
│   │   └── schema.sql           # DDL sinh tự động cho PGlite trong test (npm run db:schema-sql)
│   ├── src/
│   │   ├── config.ts            # Module cấu hình: nơi duy nhất đọc biến môi trường
│   │   ├── server.ts            # Server factory: dựng Express + Socket.IO trên một HTTP server
│   │   ├── app.ts               # Express: security header, Origin check, route API, /health, phục vụ SPA
│   │   ├── index.ts             # Entrypoint: nạp .env, loadConfig, dựng storage adapter, listen
│   │   ├── cli/                 # Lệnh vận hành: upgrade-data, revoke-sessions
│   │   ├── upgrade/             # Các bước của lệnh nâng cấp dữ liệu
│   │   ├── controllers/         # Xử lý logic REST API (Auth, User, Direct, Room, Upload, Attachment, Gif)
│   │   ├── routes/              # Khai báo đường dẫn API Express
│   │   ├── services/            # Dịch vụ tích hợp (gif.service.ts)
│   │   ├── middlewares/         # Session auth, Origin check, rate limit, security header, upload, error handler
│   │   ├── socket/              # Xử lý sự kiện Socket (direct, room, presence)
│   │   └── lib/                 # prisma, session store, storage adapter, logger, security events, rate limit
│   └── tests/                   # Bộ kiểm thử tích hợp Backend (Vitest + Supertest + socket.io-client)
└── client/                      # Ứng dụng Frontend React SPA (@webchat/client)
    └── src/
        ├── components/          # Giao diện người dùng (auth, chat, common, dashboard, media, room)
        ├── context/             # AuthContext, SocketContext
        ├── hooks/               # Custom hooks quản lý tin nhắn, typing, presence, rooms, signed URL
        ├── utils/               # apiFetch, safeUrl, avatarColor, format, HTML5 Web Notifications
        ├── test/                # Cấu hình môi trường kiểm thử JSDOM và fixtures
        └── *.test.tsx           # Bộ kiểm thử giao diện & hành vi phía Client (Vitest + RTL)
```

---

## 4. MÔ HÌNH DỮ LIỆU & THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN)

Cơ sở dữ liệu sử dụng **PostgreSQL** với **Prisma ORM**. Mô hình quan hệ được thiết kế chuẩn hóa, đảm bảo tính toàn vẹn dữ liệu và tối ưu hiệu năng truy vấn.

### 4.1. Sơ đồ Thực thể Quan hệ (Entity Relationship Diagram - ERD)

```mermaid
erDiagram
    User ||--o{ DirectChat : "as User1"
    User ||--o{ DirectChat : "as User2"
    User ||--o{ DirectChatParticipant : "participates"
    User ||--o{ DirectMessage : "sends"
    User ||--o{ Room : "owns"
    User ||--o{ RoomMember : "member of"
    User ||--o{ RoomMessage : "sends"
    User ||--o{ Session : "signs in"
    User ||--o{ Attachment : "uploads"

    DirectChat ||--|{ DirectChatParticipant : "has 2"
    DirectChat ||--o{ DirectMessage : "contains"

    Room ||--|{ RoomMember : "has members"
    Room ||--o{ RoomMessage : "contains"

    DirectMessage |o--o| Attachment : "has at most 1"
    RoomMessage |o--o| Attachment : "has at most 1"

    User {
        string id PK "UUID"
        string username UK "Tên đăng nhập duy nhất"
        string usernameNormalized "Username chữ thường (unique sau bước contract)"
        string email UK "Địa chỉ email duy nhất, chữ thường"
        string passwordHash "Bcrypt hash"
        string avatarUrl "Không còn dùng, xóa ở bước contract"
        boolean isOnline "Trạng thái trực tuyến"
        DateTime lastSeenAt "Thời điểm hoạt động cuối"
        DateTime createdAt
        DateTime updatedAt
    }

    Session {
        string id PK "UUID"
        string userId FK
        string tokenHash UK "SHA-256 của token, không lưu token gốc"
        DateTime createdAt
        DateTime lastActiveAt "Mốc hạn idle 7 ngày"
        DateTime expiresAt "Hạn absolute 30 ngày"
        string ip
        string userAgent
    }

    Attachment {
        string id PK "UUID"
        string uploaderId FK
        string storageKey UK "UUID ngẫu nhiên trong bucket private"
        AttachmentKind kind "IMAGE | DOCUMENT"
        string mimeType "Theo nội dung thật của tệp"
        int size "Kích thước sau xử lý (bytes)"
        string originalName "Tối đa 255 ký tự"
        string directMessageId FK "Nullable, unique"
        string roomMessageId FK "Nullable, unique"
        DateTime createdAt
    }

    DirectChat {
        string id PK "UUID"
        string user1Id FK "ID người dùng 1"
        string user2Id FK "ID người dùng 2"
        DateTime createdAt
        DateTime updatedAt "Đánh dấu thời điểm có tương tác mới nhất"
    }

    DirectChatParticipant {
        string id PK "UUID"
        string directChatId FK
        string userId FK
        string lastReadMessageId "Mốc tin nhắn đọc gần nhất"
        DateTime createdAt
        DateTime updatedAt
    }

    DirectMessage {
        string id PK "UUID"
        string directChatId FK
        string senderId FK
        string content "Nội dung văn bản"
        MessageType type "TEXT | IMAGE | DOCUMENT | EMOJI_GIF"
        MessageStatus status "SENT | DELIVERED | READ"
        boolean attachmentUnavailable "Attachment cũ đã bị gỡ"
        string attachmentUrl "Legacy, xóa ở bước contract"
        DateTime createdAt
        DateTime updatedAt
    }

    Room {
        string id PK "UUID"
        string name "Tên phòng chat"
        string description "Mô tả phòng"
        string ownerId FK "Chủ sở hữu phòng"
        DateTime createdAt
        DateTime updatedAt
    }

    RoomMember {
        string id PK "UUID"
        string roomId FK
        string userId FK
        RoomRole role "OWNER | ADMIN | MEMBER"
        string lastReadMessageId "Mốc tin nhắn đã đọc trong phòng"
        DateTime joinedAt
        DateTime updatedAt
    }

    RoomMessage {
        string id PK "UUID"
        string roomId FK
        string senderId FK
        string content "Nội dung tin nhắn"
        MessageType type "TEXT | IMAGE | DOCUMENT | EMOJI_GIF"
        boolean attachmentUnavailable "Attachment cũ đã bị gỡ"
        string attachmentUrl "Legacy, xóa ở bước contract"
        DateTime createdAt
        DateTime updatedAt
    }
```

### 4.2. Các Ràng buộc & Tối ưu Chỉ mục (Indexing Strategy)
1. **Định danh cặp Direct Chat duy nhất**:
   - Cặp `(user1Id, user2Id)` có ràng buộc `@@unique([user1Id, user2Id])`.
   - Hàm `normalizeDirectChatPair(u1, u2)` sắp xếp thứ tự bảng chữ cái đảm bảo không bao giờ sinh ra 2 cuộc trò chuyện đảo ngược giữa cùng 2 người.
2. **Theo dõi Đã đọc (Read Tracking) hiệu năng cao**:
   - `DirectChatParticipant` và `RoomMember` lưu `lastReadMessageId`.
   - Khi cần đếm tin nhắn chưa đọc (`unreadCount`), hệ thống chỉ cần đếm số tin nhắn có `createdAt > lastReadMessage.createdAt`, không cần bảng ghi trạng thái đọc riêng cho từng tin nhắn (tiết kiệm 90% dung lượng lưu trữ).
3. **Các Index trọng yếu**:
   - `User`: Index trên `username`, `isOnline`.
   - `DirectChat`: Index trên `user1Id`, `user2Id`, `updatedAt` (để sắp xếp hộp thư đến).
   - `DirectMessage`: Composite index `@@index([directChatId, createdAt])` phục vụ phân trang tức thì.
   - `RoomMessage`: Composite index `@@index([roomId, createdAt])`.

4. **Row Level Security**: mọi bảng (kể cả `_prisma_migrations`) bật RLS mà không có policy nào, nên Data API của Supabase không đọc được dữ liệu kể cả khi key bị lộ. Prisma kết nối bằng role sở hữu bảng nên không bị ảnh hưởng. Migration tạo bảng mới cũng phải bật RLS, và bộ test sẽ fail nếu thiếu.

### 4.3. Chiến lược Kết nối Cơ sở Dữ liệu Đa Chế độ (Prisma Driver Adapters & PGlite)
Tại [`server/src/lib/prisma.ts`](../../server/src/lib/prisma.ts), hệ thống tận dụng tính năng `driverAdapters` của Prisma v7 để thích ứng giữa hai môi trường:
- **Production và Development (PostgreSQL thật)**: `DATABASE_URL` là bắt buộc ở mọi môi trường. Prisma khởi tạo kết nối chuẩn qua `pg.Pool` và `@prisma/adapter-pg`. Với Supabase phải dùng kết nối direct hoặc session pooler, không dùng transaction pooler cổng `6543`.
- **In-Memory PostgreSQL (`@electric-sql/pglite`)**: chỉ dùng khi kiểm thử. Giá trị `DATABASE_URL=memory:` chỉ được chấp nhận khi `NODE_ENV=test`; khi đó hệ thống khởi tạo một engine PostgreSQL nhúng trên RAM qua `PGlite` và `pglite-prisma-adapter`, nạp cấu trúc bảng từ [`server/prisma/schema.sql`](../../server/prisma/schema.sql). File này được sinh tự động từ Prisma schema (`npm run db:schema-sql`), không sửa tay.

### 4.4. Quy trình Migration (Prisma Migrate)
Schema được quản lý bằng migration có version trong `server/prisma/migrations/`, chi tiết tại [`docs/database-migrations.md`](../database-migrations.md):
1. **Baseline**: migration `0_baseline` đúng bằng schema production lúc còn dùng `db push`. Production được đánh dấu đã áp dụng một lần bằng `prisma migrate resolve --applied 0_baseline`.
2. **`migrate deploy`**: lệnh start trên Render chạy `prisma migrate deploy` trước khi khởi động server, áp mọi migration còn thiếu.
3. **Expand → nâng cấp dữ liệu → contract**: migration expand chỉ thêm bảng và cột nullable; lệnh nâng cấp dữ liệu (`npm run db:upgrade-data --workspace=server -- --dry-run`, rồi chạy thật) chuẩn hóa username, email, room, chuyển Attachment cũ và dọn object mồ côi trong bucket; migration contract mới xóa cột cũ và thêm ràng buộc.

---

## 5. KIẾN TRÚC GIAO THỨC THỜI GIAN THỰC (REAL-TIME SOCKET.IO PROTOCOL)

### 5.1. Bắt tay, Xác thực & Khởi tạo Phiên Kết nối (Handshake & On-Connect Lifecycle)
- Client gọi `io()` không kèm URL hay `auth`: socket kết nối tới cùng origin, và trình duyệt tự gửi cookie `__Host-session` trong handshake.
- Middleware handshake trong [`server/src/socket/index.ts`](../../server/src/socket/index.ts) kiểm tra header `Origin` phải bằng `APP_ORIGIN` (chống Cross-Site WebSocket Hijacking), rồi đọc cookie và `resolve` Session. Origin lạ, thiếu Session hoặc Session hết hạn đều bị từ chối và ghi sự kiện `socket.handshake.rejected`. Socket hợp lệ join kênh `user:<userId>` và `session:<sessionId>`.
- Connection State Recovery đặt `skipMiddlewares: false`, nên socket được khôi phục vẫn bị kiểm tra lại Origin và Session, và các kênh `room:<roomId>` của nó được đối chiếu lại với bảng Room Member trước khi nhận thêm event.
- Khi Session bị thu hồi hoặc hết hạn, server gửi `session:ended { reason }` rồi ngắt socket.
- Ngay khi sự kiện `connection` được thiết lập thành công, máy chủ tự động thực thi chuỗi khởi tạo nền (theo [ADR 0008](./0008-background-room-subscription-and-delivery-tracking.md)):
  1. **`handleUserConnect`**: Ghi nhận trạng thái Online của người dùng và hủy bộ đếm Grace Period (nếu có).
  2. **`handleDirectMessagesDeliveryOnConnect`**: Truy vấn toàn bộ tin nhắn 1-1 gửi tới người dùng này trong lúc họ ngoại tuyến (đang ở trạng thái `SENT`), cập nhật hàng loạt sang `DELIVERED` và phát sự kiện `direct:delivered` về kênh `user:<senderId>` của người gửi.
  3. **`autoJoinUserRooms`**: Tự động đăng ký (`socket.join('room:<roomId>')`) vào tất cả các phòng chat mà người dùng đang là thành viên, đảm bảo người dùng luôn nhận được thông báo nền và cập nhật `Unread Count Badge` thời gian thực cho mọi phòng.

### 5.2. Danh mục Sự kiện (Socket Events Catalog)

| Kênh (Scope) | Tên Sự kiện | Chi tiết & Luồng dữ liệu |
| :--- | :--- | :--- |
| **Direct** | `direct:send` | Client phát tin nhắn trực tiếp: văn bản, văn bản kèm `attachmentId`, hoặc `gifUrl` của Giphy. Server validate payload, tự suy ra loại tin, ghi vào DB (`DELIVERED` nếu người nhận đang online, `SENT` nếu offline) và trả callback xác nhận. |
| **Direct** | `direct:receive` | Server phát tin nhắn đến room cá nhân `user:<userId>` của cả người gửi và người nhận. |
| **Direct** | `direct:delivered` | Server thông báo cho người gửi (`user:<senderId>`) khi các tin nhắn `SENT` đã được chuyển phát (`DELIVERED`) ngay lúc người nhận kết nối mạng trở lại. |
| **Direct** | `direct:typing` | Client phát tín hiệu đang soạn thảo. Server chuyển tiếp đến đối phương (`user:<partnerId>`). |
| **Direct** | `direct:read` | Client phát mốc `messageId` đã xem. Server cập nhật DB và báo cho đối phương biết tin nhắn đã chuyển trạng thái `READ`. |
| **Room** | `room:join` / `room:leave` | Socket tham gia hoặc rời khỏi room logic `room:<roomId>` (đồng thời được đồng bộ tự động qua `autoJoinUserRooms` và `syncUserSocketsRoomMembership`). |
| **Room** | `room:send` | Thành viên gửi tin nhắn vào nhóm. Server xác thực quyền thành viên, lưu DB và broadcast. |
| **Room** | `room:receive` | Server broadcast tin nhắn mới đến toàn bộ thành viên đang kết nối trong `room:<roomId>`. |
| **Room** | `room:typing` | Server broadcast tên thành viên đang gõ đến các thành viên khác trong phòng. |
| **Room** | `room:read` | Đồng bộ mốc đã xem (`lastReadMessageId`) của thành viên trong phòng. |
| **Room** | `room:member_change` | Thông báo thay đổi nhân sự trong phòng (`JOIN`, `LEAVE`, `KICK`, `ROLE_CHANGE`, `DELETE`) tới cả kênh phòng và kênh cá nhân. |
| **Presence**| `presence:update` | Broadcast trạng thái `{ userId, isOnline, lastSeenAt }` cho toàn bộ client khi có user thay đổi trạng thái. |
| **Session** | `session:ended` | Server báo Session đã bị thu hồi hoặc hết hạn (`reason: revoked \| expired`) ngay trước khi ngắt socket; client đưa người dùng về màn đăng nhập. |

Mọi payload socket được parse bằng schema zod dùng chung trước khi chạm tới DB. Callback lỗi chỉ có dạng `{ success: false, error: <code>, requestId }` (ví dụ `VALIDATION_ERROR`, `FORBIDDEN`, `ATTACHMENT_INVALID`, `RATE_LIMITED` kèm `retryAfterMs`). Gói tin lớn hơn 64KB (`maxHttpBufferSize`) làm kết nối bị ngắt trước khi được xử lý.

### 5.3. Cơ chế Quản lý Hiện diện (Presence) & Grace Period

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng (Client)
    participant Server as Socket.io Server
    participant Presence as Presence Handler
    participant DB as PostgreSQL DB
    participant Others as Người dùng khác

    Note over User, Others: Luồng Kết nối (Connect)
    User->>Server: Kết nối Socket (cookie __Host-session)
    Server->>Presence: handleUserConnect(userId, socketId)
    Presence->>DB: UPDATE User SET isOnline = true
    Presence->>Others: Broadcast presence:update (isOnline: true)

    Note over User, Others: Luồng Ngắt kết nối & Grace Period (F5 / Mạng gián đoạn)
    User--xServer: Socket ngắt kết nối (Disconnect)
    Server->>Presence: handleUserDisconnect(userId, socketId)
    Note over Presence: Bắt đầu đếm Grace Period 5 giây
    alt Người dùng kết nối lại trong 5 giây (F5 hoặc mạng hồi)
        User->>Server: Kết nối lại thành công
        Server->>Presence: Hủy Grace Period Timer
        Note over Presence, Others: Trạng thái Online được giữ nguyên (Không bị nhấp nháy)
    else Hết 5 giây không kết nối lại
        Presence->>DB: UPDATE User SET isOnline = false, lastSeenAt = now()
        Presence->>Others: Broadcast presence:update (isOnline: false)
    end
```

---

## 6. CHIẾN LƯỢC CHỐNG GIÁN ĐOẠN & ĐỒNG BỘ DỮ LIỆU 2 LỚP (DUAL-LAYER SYNC)

Nhằm đảm bảo trải nghiệm người dùng tuyệt đối không bị mất tin nhắn khi chuyển mạng, mất sóng hoặc gập máy tính, hệ thống triển khai kiến trúc **Đồng bộ 2 tầng**:

```mermaid
flowchart TD
    Start([Mất mạng / Gián đoạn kết nối]) --> WaitRecon[Đang thử kết nối lại...]
    WaitRecon --> Reconnected[Đã kết nối lại thành công]
    Reconnected --> CheckRecovery{Socket.io phục hồi trạng thái thành công?}
    
    CheckRecovery -- "Có (< 2 phút)" --> Tier1["Tầng 1: Connection State Recovery"]
    Tier1 --> RecoverPackets["Nhận lại các gói tin đệm từ Server Buffer"]
    RecoverPackets --> Complete([Hoàn tất - Tin nhắn liền mạch])
    
    CheckRecovery -- "Không (> 2 phút hoặc tải lại trang)" --> Tier2["Tầng 2: REST Catch-up Sync"]
    Tier2 --> FindLastMsg["Lấy ID tin nhắn mới nhất tại Local (latestMessageId)"]
    FindLastMsg --> CallCatchup["GET /api/.../messages?after=latestMessageId"]
    CallCatchup --> AppendNew["Ghép tin nhắn mới nhận vào State"]
    AppendNew --> Complete
```

### 6.1. Phân trang Con trỏ (Cursor-based Pagination)
Thay vì sử dụng phân trang theo `offset` và `page` (dễ bị lệch và trùng tin nhắn khi có tin nhắn mới đẩy vào), hệ thống sử dụng con trỏ:
- Tham số gọi API:
  - `limit=50`: Mặc định trả về 50 tin nhắn gần nhất.
  - `before=<messageId>`: Tải 50 tin nhắn cũ hơn tin nhắn có ID này (dùng khi cuộn ngược lên).
  - `after=<messageId>`: Tải toàn bộ tin nhắn mới hơn tin nhắn có ID này (dùng cho Catch-up Sync).
- Luồng cuộn: Khi người dùng cuộn lên đỉnh màn hình chat (`scrollTop === 0`), client tự động gọi API `?before=...` và chèn ngược danh sách tin nhắn cũ vào đầu danh sách hiển thị mà không gây giật thanh cuộn.

---

## 7. KIẾN TRÚC LƯU TRỮ TỆP & ĐA PHƯƠNG TIỆN (ATTACHMENT & MEDIA STRATEGY)

### 7.1. Thiết kế Adapter Pattern cho Lưu trữ
Để linh hoạt giữa môi trường phát triển, kiểm thử và production, hệ thống áp dụng mẫu thiết kế **Adapter Pattern** ([`server/src/lib/storage.ts`](../../server/src/lib/storage.ts)). Interface không bao giờ trả URL public:

```mermaid
classDiagram
    class StorageAdapter {
        <<interface>>
        +name: string
        +put(data, contentType) Promise~storageKey~
        +createSignedUrl(storageKey, ttlSeconds) Promise~url, expiresAt~
        +createSignedUrls(storageKeys, ttlSeconds) Promise~Map~
        +delete(storageKey) Promise~void~
        +list() Promise~StoredObjectInfo[]~
    }

    class SupabaseStorageAdapter {
        +name: "supabase"
    }

    class LocalStorageAdapter {
        +name: "local"
    }

    class InMemoryStorageAdapter {
        +name: "memory"
    }

    StorageAdapter <|.. SupabaseStorageAdapter : implements
    StorageAdapter <|.. LocalStorageAdapter : implements
    StorageAdapter <|.. InMemoryStorageAdapter : implements
```

- **Production**: bắt buộc `STORAGE_PROVIDER=supabase`. `SupabaseStorageAdapter` gửi secret key (`SUPABASE_SECRET_KEY`, dạng `sb_secret_...`) chỉ qua header `apikey`, lưu tệp vào bucket **private** `attachments` và dùng API signed URL của Supabase. Server từ chối khởi động nếu production cấu hình lưu trên đĩa local.
- **Development**: `LocalStorageAdapter` lưu tệp vào `server/uploads/`. Tệp được phục vụ qua `/uploads` (đi qua proxy Vite) kèm `Content-Disposition: attachment` và `nosniff`; signed URL là đường dẫn có chữ ký HMAC và hạn dùng.
- **Kiểm thử**: `InMemoryStorageAdapter` giữ tệp trong bộ nhớ.
- `storageKey` là UUID ngẫu nhiên, không chứa tên gốc của tệp. Adapter Cloudinary đã bị gỡ.

### 7.2. Luồng Attachment: Bản ghi, Bucket Private & Signed URL (ADR 0009)

```mermaid
sequenceDiagram
    autonumber
    actor Sender as Người gửi
    participant Server as Express + Socket.IO
    participant DB as PostgreSQL
    participant Bucket as Supabase Storage (private)
    actor Reader as Người nhận

    Sender->>Server: POST /api/upload (multipart, tối đa 10MB, Origin + cookie)
    Server->>Server: Nhận diện loại tệp theo magic bytes, xóa EXIF ảnh (sharp)
    Server->>Bucket: put(storageKey = UUID ngẫu nhiên)
    Server->>DB: INSERT Attachment (uploaderId, kind, mimeType, size, originalName ≤ 255)
    Server-->>Sender: 201 { attachment } kèm signed URL để xem trước
    Sender->>Server: direct:send / room:send { content, attachmentId }
    Server->>DB: Kiểm tra Attachment của chính người gửi và chưa gắn tin nào, rồi gắn vào tin nhắn
    Server->>Bucket: createSignedUrl(storageKey, 1 giờ)
    Server-->>Reader: direct:receive / room:receive với AttachmentDto { id, kind, mimeType, size, name, url, urlExpiresAt }
    Reader->>Bucket: Tải ảnh / tài liệu bằng signed URL
    Note over Reader, Server: URL hết hạn hoặc tải lỗi
    Reader->>Server: GET /api/attachments/:id/url
    Server->>DB: Kiểm tra Direct Chat Participant hoặc Room Member hiện tại
    Server-->>Reader: 200 { url, expiresAt } hoặc 404
```

- **Quyền xem đi theo quyền vào cuộc trò chuyện:** mỗi khi server trả lịch sử, Catch-up Sync hay broadcast, nó ký URL mới với TTL 1 giờ. Endpoint làm mới trả `404` cho người ngoài và cho thành viên đã bị kick, không phân biệt "không tồn tại" với "không có quyền". Người vừa bị kick vẫn dùng được URL đã nhận trong tối đa 1 giờ: đây là đánh đổi có chủ đích để không phải proxy tệp qua server.
- **Một Attachment, một tin nhắn:** liên kết tới Direct Message hoặc Room Message là unique, nên không thể dùng lại upload của người khác hay gắn một tệp vào hai cuộc trò chuyện.
- **Attachment cũ:** lệnh nâng cấp dữ liệu chuyển URL public cũ thuộc bucket thành bản ghi Attachment. Tin có URL không an toàn hoặc không thuộc bucket bị gỡ đính kèm nhưng giữ nội dung chữ, mang cờ `attachmentUnavailable` và hiển thị "Tệp đính kèm không còn khả dụng".

### 7.3. Kiểm soát An toàn Tệp Đính kèm & Xem trước Trực tiếp
- Giới hạn dung lượng tệp: **10MB** (vượt thì nhận `413`).
- Loại tệp được nhận diện theo **nội dung thật** (magic bytes); MIME do client khai và đuôi tệp bị bỏ qua. Allowlist: ảnh JPEG, PNG, WebP, GIF; tài liệu PDF, DOCX/XLSX/PPTX (kiểm tra cả cấu trúc OOXML bên trong, từ chối tệp có macro), DOC/XLS/PPT; văn bản TXT, CSV, MD, JSON (UTF-8 hợp lệ, luôn lưu dưới dạng `text/plain; charset=utf-8`). Mọi định dạng khác, kể cả SVG, HTML, XML, RTF, ZIP thuần và tệp thực thi, bị từ chối với `415`.
- Ảnh JPEG, PNG, WebP được re-encode qua `sharp`: xoay theo EXIF orientation rồi bỏ toàn bộ metadata (GPS, thiết bị). GIF giữ nguyên để không mất hiệu ứng động.
- **URL an toàn ở client:** mọi URL đưa vào `href`, `src`, iframe hay `window.open` đều đi qua helper [`safeUrl.ts`](../../client/src/utils/safeUrl.ts), chỉ chấp nhận `https:` và `blob:` (URL tương đối cùng origin chỉ ở dev). GIF chỉ hiển thị ảnh từ host của Giphy.
- **Client Image Preview**: Sử dụng Web API `URL.createObjectURL(file)` tại [`AttachmentPreview.tsx`](../../client/src/components/chat/AttachmentPreview.tsx) để tạo ảnh xem trước cục bộ tức thì trên thanh công cụ soạn thảo trước khi gửi.
- **Image Lightbox Modal**: Component [`ImageLightboxModal.tsx`](../../client/src/components/chat/ImageLightboxModal.tsx) cho phép click vào bất kỳ ảnh nào trong luồng chat để phóng to ở kích thước gốc với nền tối.
- **Document Preview Modal**: Component [`DocumentPreviewModal.tsx`](../../client/src/components/chat/DocumentPreviewModal.tsx) cho phép xem trực tiếp nội dung hoặc thông tin tóm tắt của tệp tài liệu đính kèm ngay trong không gian ứng dụng trước hoặc thay cho việc tải tệp về thiết bị.

### 7.4. Emoji & GIF Search
- Bộ chọn Emoji popover ([`EmojiPickerPopover.tsx`](../../client/src/components/media/EmojiPickerPopover.tsx)) hoàn chỉnh được tích hợp trực tiếp cạnh ô nhập tin nhắn.
- Hộp thoại tìm kiếm GIF ([`GifSearchModal.tsx`](../../client/src/components/media/GifSearchModal.tsx)) kết nối trực tiếp với Giphy API (`/api/gifs/search` và `/api/gifs/trending`, có bộ GIF dự phòng tích hợp sẵn nếu không cấu hình `GIPHY_API_KEY`), cho phép tìm kiếm theo từ khóa và gửi ngay ảnh động chỉ bằng một cú nhấp chuột.

---

## 8. KIẾN TRÚC PHÍA CLIENT (FRONTEND SPA ARCHITECTURE)

Client được xây dựng bằng **React 18** và **TypeScript**, phối hợp styling qua **Tailwind CSS**.

### 8.1. Mô hình Quản lý Trạng thái (State Management)
Toàn bộ trạng thái toàn cục được tinh gọn trong 2 React Context chính:
1. **`AuthContext`** ([`client/src/context/AuthContext.tsx`](../../client/src/context/AuthContext.tsx)):
   - Quản lý thông tin tài khoản hiện tại (`currentUser`) và trạng thái đăng nhập. Không lưu token hay cache người dùng nào trong `localStorage`.
   - Khi khởi động, gọi `GET /api/auth/me`: nhận `200` thì vào Dashboard, nhận `401` thì vào màn đăng nhập. Trong lúc chờ (kể cả khi Render đang cold start), hiển thị trạng thái "đang kết nối máy chủ".
   - Mọi lời gọi REST đi qua helper [`apiFetch.ts`](../../client/src/utils/apiFetch.ts) tới cùng origin (`/api/...`), không có header `Authorization`; mọi `401` giữa chừng đều đưa về màn đăng nhập. `logout()` gọi `POST /api/auth/logout`, `logoutEverywhere()` gọi `POST /api/auth/logout-all` (nút "Sign out of all devices").
2. **`SocketContext`** ([`client/src/context/SocketContext.tsx`](../../client/src/context/SocketContext.tsx)):
   - Quản lý vòng đời socket client singleton, kết nối bằng `io()` tới cùng origin (cookie tự đi kèm handshake).
   - Cung cấp các cờ trạng thái: `isConnected`, `isConnecting`, `isReconnecting`, `connectionError`.

### 8.2. Hệ thống Custom Hooks Chuyên biệt
Tách biệt triệt để logic xử lý dữ liệu và socket khỏi tầng giao diện hiển thị:
- `useDirectChats`: Lấy danh sách bạn chat, tính toán số tin nhắn chưa đọc của từng cuộc trò chuyện.
- `useDirectMessages`: Quản lý danh sách tin nhắn 1-1, xử lý gửi/nhận socket, đồng bộ trạng thái `DELIVERED`/`READ`, phân trang con trỏ và catch-up sync.
- `usePresence`: Lắng nghe sự kiện Online/Offline từ server và cập nhật danh bạ theo thời gian thực.
- `useTyping`: Điều khiển gửi tín hiệu đang gõ có áp dụng debounce (ngừng gõ sau 1.5 giây thì tự tắt chỉ báo).
- `useRooms`: Quản lý danh sách phòng, quyền sở hữu phòng và sự kiện tạo mới/rời phòng.
- `useRoomMessages`: Quản lý luồng tin nhắn nhóm và phân trang nhóm.
- `useRoomTyping`: Quản lý danh sách các thành viên đang gõ trong cùng một phòng chat.

### 8.3. Hệ thống Thông báo Trình duyệt (Web Notifications)
- Sử dụng **HTML5 Web Notification API** ([`client/src/utils/notifications.ts`](../../client/src/utils/notifications.ts)) kết hợp hiệu ứng âm thanh nhẹ (`notification chime`).
- Khi cửa sổ chat bị thu nhỏ hoặc ở tab trình duyệt nền, tin nhắn đến (từ cả Direct Chat và mọi Room Chat đã đăng ký nền) sẽ kích hoạt thông báo nổi trên desktop kèm tên người gửi và tóm tắt nội dung.

### 8.4. Ngôn ngữ Thiết kế GDG-HUST & Bố cục Responsive Đa Thiết bị
Ứng dụng tuân thủ chặt chẽ hệ thống nhận diện **GDG-HUST** và các quyết định kiến trúc giao diện ([ADR 0006](./0006-mobile-responsive-master-detail-layout.md), [ADR 0007](./0007-desktop-dual-pane-layout-and-persistent-detail-view.md), [ADR 0008](./0008-background-room-subscription-and-delivery-tracking.md)):
- **GDG Brand Identity & Google Palette Semantics**: Sử dụng bảng màu chuẩn Google (`#4285F4` Blue, `#EA4335` Red, `#FBBC04` Yellow, `#34A853` Green, `#F1F3F4`/`#F8F9FA`/`#202124` Greys) cùng hàm băm [`avatarColor.ts`](../../client/src/utils/avatarColor.ts) tạo **Deterministic 4-Color Avatar** nhất quán cho từng người dùng.
- **Zero-Shift Auth Architecture**: Màn hình [`AuthScreen.tsx`](../../client/src/components/auth/AuthScreen.tsx) cố định chiều cao thẻ đăng nhập (`540px`) và vùng form (`275px`), đảm bảo không bị giật/nhảy bố cục (`0px layout displacement`) khi chuyển đổi giữa Đăng nhập và Đăng ký.
- **Ultra-Compact Header**: Thanh tiêu đề tại [`Dashboard.tsx`](../../client/src/components/dashboard/Dashboard.tsx) có chiều cao siêu gọn `42px` (`h-11`), giúp tối đa hóa diện tích vùng trò chuyện (>85% chiều cao màn hình di động).
- **Master-Detail Navigation (Mobile `< 768px`) & Dual-Pane Persistent Detail View (Desktop `>= 768px`)**:
  - Trên điện thoại: Sử dụng đơn vị chiều cao động `100dvh`, hiển thị luân phiên giữa `Sidebar` (Master) và `ChatArea` / `RoomChatArea` (Detail) kèm nút [`MobileBackButton.tsx`](../../client/src/components/common/MobileBackButton.tsx) (`md:hidden`) mà không làm unmount kết nối thời gian thực.
  - Trên máy tính: Hiển thị song song 2 cột với `Sidebar` cố định `352px` (`md:w-88`) và khung chat bên phải. Khi người dùng chuyển tab `Direct Chats` / `Rooms` ở cột trái, cuộc trò chuyện đang mở ở cột phải vẫn được giữ nguyên (Persistent Detail View).
- **Hiển thị Delivery Status & Read Receipt Watermark**: Bên dưới bong bóng tin nhắn gửi đi hiển thị trạng thái tối giản (`Sent` $\rightarrow$ `Delivered` $\rightarrow$ `Seen [Mini-Avatar]`), trong đó nhãn `Seen` di chuyển động như một dấu mốc duy nhất dưới tin nhắn mới nhất mà đối phương đã đọc.

---

## 9. CHIẾN LƯỢC TRIỂN KHAI HẠ TẦNG FREE-TIER & DEVOPS

Hệ thống được thiết kế tối ưu hóa hoàn toàn để vận hành ổn định trên các nền tảng đám mây miễn phí với chi phí **0 đồng**:

```mermaid
flowchart LR
    subgraph UserSide ["Client Browser"]
        Browser["Người dùng Trình duyệt"]
    end

    subgraph Render ["Render.com (Free Web Service), https://webchat-realtime.onrender.com"]
        ServerHost["Node.js + Express + Socket.io Server"]
        SPA["client/dist (React Vite SPA)"]
        HealthEndpoint["/health & /health/ready"]
    end

    subgraph Supabase ["Supabase (Free Plan)"]
        PostgresDB[("PostgreSQL (RLS bật, Data API tắt)")]
        StorageBucket[("Storage: bucket private attachments")]
    end

    Browser -- "1. SPA, REST /api và WebSocket /socket.io (cùng origin, cookie __Host-session)" --> ServerHost
    ServerHost --- SPA
    ServerHost -- "2. Prisma ORM (kết nối direct / session pooler)" --> PostgresDB
    ServerHost -- "3. Storage API (secret key qua header apikey)" --> StorageBucket
    Browser -- "4. Tải tệp bằng signed URL (1 giờ)" --> StorageBucket
```

### 9.1. Khắc phục Vấn đề Cold Start của Render Free Tier
Máy chủ miễn phí trên Render sẽ chuyển sang trạng thái ngủ (Sleep) sau 15 phút không nhận được lưu lượng truy cập. Khi có người truy cập mới, máy chủ cần 30 đến 50 giây để khởi động lại. Vì SPA cũng do Render phục vụ, lần mở đầu tiên sau khi ngủ sẽ **trắng trang 30–50 giây**; đánh đổi này được chấp nhận trong [ADR 0010](./0010-single-host-render-with-session-cookie.md).
- **Giải pháp Frontend**: Tích hợp component `ConnectionStatusBanner`. Khi socket phát hiện trạng thái `isConnecting` hoặc `isReconnecting`, một thông báo trực quan màu hổ phách/xanh dương xuất hiện trên đầu màn hình: *"Đang kết nối tới máy chủ (có thể mất 30-50s nếu máy chủ đang khởi động lại)..."*, loại bỏ cảm giác ứng dụng bị treo.
- **Healthcheck tự động**: Endpoint `/health` (liveness) được cấu hình trong `render.yaml` giúp Render giám sát dịch vụ. Endpoint `/health/ready` kiểm tra thêm kết nối DB (`SELECT 1`) và trả `503` khi DB không phản hồi, ví dụ khi Supabase free tạm dừng project.
- **Tùy chọn**: một monitor miễn phí ping `/health` định kỳ để tránh cold start, mô tả trong [runbook xử lý sự cố](../incident-runbook.md#optional-uptime-monitor-against-cold-starts).

### 9.2. Triển khai Single-host trên Render (ADR 0010)
Production chỉ có **một** phương án triển khai: một Web Service trên Render phục vụ SPA, REST API và Socket.IO trên cùng origin. Không dùng Vercel và không có CORS.
1. **Build** (`render.yaml`): `npm install --include=dev && npm run build` đóng gói lần lượt `shared`, `server` và `client` (vào `client/dist`).
2. **Start**: `npm run db:deploy --workspace=server && npm run start --workspace=server`. Lệnh `prisma migrate deploy` áp các migration còn thiếu trước khi server khởi động. Ở production, server từ chối khởi động nếu thiếu bản build của client, thiếu cấu hình Supabase hoặc dùng lưu trữ local.
3. **Phục vụ SPA**: Express phục vụ tệp tĩnh trong `client/dist`. Fallback `index.html` chỉ áp cho request `GET` không thuộc `/api`, `/socket.io`, `/health` hay `/uploads`.
4. **Biến môi trường**: `NODE_ENV`, `PORT`, `APP_ORIGIN`, `STORAGE_PROVIDER`, `SUPABASE_STORAGE_BUCKET` là giá trị thường trong `render.yaml`. Các secret (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GIPHY_API_KEY`) khai báo `sync: false` và chỉ được đặt trên dashboard Render. Danh sách đầy đủ có trong [README](../../README.md#3-environment-configuration).
5. **Development** cũng chung origin: trình duyệt mở `http://localhost:5173`, và proxy Vite chuyển `/api`, `/socket.io`, `/uploads` sang server ở cổng `4000`.

### 9.3. Vận hành & Ứng phó Sự cố
- [`SECURITY.md`](../../SECURITY.md): phạm vi, kênh báo lỗ hổng riêng tư qua GitHub Private Vulnerability Reporting, thời gian phản hồi mục tiêu và các rủi ro đã chấp nhận.
- [Runbook xử lý sự cố](../incident-runbook.md): phát hiện qua log sự kiện bảo mật, xoay vòng key Supabase, thu hồi Session bằng lệnh CLI, đánh giá phạm vi, thông báo cho User, backup bằng `pg_dump`.
- Secret không bao giờ nằm trong repo: hook pre-commit `gitleaks` chặn commit có secret (xem [README](../../README.md#secret-scanning)).

---

## 10. KIẾN TRÚC KIỂM THỬ & ĐẢM BẢO CHẤT LƯỢNG (TESTING & QA)

Dự án áp dụng triệt để phương pháp kiểm thử hướng hành vi (Behavior-Driven / Integration Boundary Testing) trên cả Backend và Frontend.

### 10.1. Các Bộ Kiểm thử Tích hợp Backend (`server/tests/`):
Mỗi bộ dựng server qua server factory với cấu hình test, PGlite in-memory và storage adapter in-memory, rồi gọi REST bằng `supertest` (gửi `Origin` và cookie như trình duyệt) và socket bằng `socket.io-client`. Các bộ tiêu biểu:
1. [`auth.test.ts`](../../server/tests/auth.test.ts): Đăng ký tài khoản, mã hóa mật khẩu, kiểm tra trùng username/email, đăng nhập và đặt cookie Session.
2. [`socket-auth.test.ts`](../../server/tests/socket-auth.test.ts): Xác thực bắt tay Socket bằng cookie Session, từ chối socket không có Session hoặc có `Origin` lạ.
3. [`direct-chat.test.ts`](../../server/tests/direct-chat.test.ts): Khởi tạo cuộc trò chuyện 1-1 qua REST API, đảm bảo tính duy nhất của cặp người dùng (`normalizeDirectChatPair`) và truy xuất danh sách hội thoại.
4. [`direct-chat-socket.test.ts`](../../server/tests/direct-chat-socket.test.ts): Kết nối đồng thời nhiều `socket.io-client` thật, phát tán tin nhắn 1-1, kiểm tra trạng thái `SENT`, `DELIVERED` và sự kiện `direct:delivered` khi người nhận kết nối lại.
5. [`room.test.ts`](../../server/tests/room.test.ts): Quản lý vòng đời phòng chat qua REST API (tạo phòng, thêm/xóa thành viên, phân quyền `OWNER` / `ADMIN` / `MEMBER`).
6. [`room-socket.test.ts`](../../server/tests/room-socket.test.ts): Tự động tham gia kênh phòng nền (`autoJoinUserRooms`), phát tán tin nhắn nhóm, xác thực quyền hạn thành viên.
7. [`presence.test.ts`](../../server/tests/presence.test.ts): Kiểm tra cập nhật trạng thái Online/Offline và kiểm chứng cơ chế Grace Period 5 giây khi ngắt kết nối.
8. [`typing.test.ts`](../../server/tests/typing.test.ts): Phát và nhận tín hiệu Typing Indicator cho cả Direct Chat và Room Chat.
9. [`read-receipts.test.ts`](../../server/tests/read-receipts.test.ts): Phát sự kiện đã đọc, cập nhật `lastReadMessageId` và chuyển đổi trạng thái tin nhắn thành `READ`.
10. [`catchup-sync.test.ts`](../../server/tests/catchup-sync.test.ts): Kiểm tra tính đúng đắn của endpoint bù đắp tin nhắn sau ngắt kết nối dài (`?after=...`).
11. [`pagination.test.ts`](../../server/tests/pagination.test.ts): Kiểm tra phân trang con trỏ (`?before=...`) theo lô 50 tin nhắn.
12. [`upload.test.ts`](../../server/tests/upload.test.ts): Kiểm tra upload ảnh/tài liệu qua Storage Adapter và xác nhận chặn tệp vượt quá 10MB hoặc không thuộc allowlist.
13. [`attachment-message.test.ts`](../../server/tests/attachment-message.test.ts): Kiểm tra luồng gửi và nhận tin nhắn có đính kèm tệp (`IMAGE`, `DOCUMENT`) trong Direct Chat và Room Chat.
14. [`gif-message.test.ts`](../../server/tests/gif-message.test.ts): Kiểm tra tìm kiếm GIF (`/api/gifs`) và gửi tin nhắn loại `EMOJI_GIF`.
15. **Các bộ hồi quy bảo mật** (mỗi bộ tái hiện đúng bước tấn công trong audit, tên test ghi kèm mã bước như `A09`): [`config.test.ts`](../../server/tests/config.test.ts) (module cấu hình), [`session-auth.test.ts`](../../server/tests/session-auth.test.ts) và [`session-revocation.test.ts`](../../server/tests/session-revocation.test.ts) (Session, CSRF, thu hồi), [`security-headers.test.ts`](../../server/tests/security-headers.test.ts) (CSP, HSTS, không CORS), [`validation.test.ts`](../../server/tests/validation.test.ts) và [`socket-validation.test.ts`](../../server/tests/socket-validation.test.ts), [`error-layer.test.ts`](../../server/tests/error-layer.test.ts), [`upload-hardening.test.ts`](../../server/tests/upload-hardening.test.ts) và [`attachments.test.ts`](../../server/tests/attachments.test.ts) (Attachment riêng tư, signed URL), [`realtime-membership.test.ts`](../../server/tests/realtime-membership.test.ts) (rời room, bị kick, khôi phục kết nối), [`rate-limit.test.ts`](../../server/tests/rate-limit.test.ts), [`user-privacy.test.ts`](../../server/tests/user-privacy.test.ts), [`security-events.test.ts`](../../server/tests/security-events.test.ts) và [`health.test.ts`](../../server/tests/health.test.ts), [`migrations.test.ts`](../../server/tests/migrations.test.ts) (migration khớp schema, RLS bật trên mọi bảng), [`upgrade-data.test.ts`](../../server/tests/upgrade-data.test.ts) và [`upgrade-attachments.test.ts`](../../server/tests/upgrade-attachments.test.ts) (lệnh nâng cấp dữ liệu), [`docs.test.ts`](../../server/tests/docs.test.ts) (link nội bộ trong tài liệu mở được, `.env.example` khớp module cấu hình).

### 10.2. Các Bộ Kiểm thử Giao diện & Hành vi Frontend (`client/src/`):
Sử dụng `Vitest` kết hợp `@testing-library/react` và `jsdom`, với `fetch` được mock. Các bộ tiêu biểu:
1. [`App.test.tsx`](../../client/src/App.test.tsx): Kiểm tra luồng khởi chạy ứng dụng (`GET /api/auth/me`), điều hướng xác thực, không ghi gì vào localStorage và không gửi header `Authorization`.
2. [`BrandAssetsTokens.test.ts`](../../client/src/BrandAssetsTokens.test.ts): Kiểm chứng hệ thống token màu sắc Google Palette và tài nguyên nhận diện thương hiệu GDG-HUST.
3. [`AuthScreen.test.tsx`](../../client/src/components/auth/AuthScreen.test.tsx): Kiểm tra giao diện đăng nhập/đăng ký và kiến trúc Zero-Shift Auth.
4. [`DirectChat.test.tsx`](../../client/src/components/chat/DirectChat.test.tsx): Kiểm tra luồng hiển thị, gửi/nhận tin nhắn 1-1 và trạng thái chuyển phát.
5. [`RoomChat.test.tsx`](../../client/src/components/room/RoomChat.test.tsx): Kiểm tra giao diện phòng chat nhóm, quản lý thành viên và thông báo nền.
6. [`Attachment.test.tsx`](../../client/src/components/chat/Attachment.test.tsx): Kiểm tra đính kèm tệp, Image Lightbox và Document Preview Modal.
7. [`RichMedia.test.tsx`](../../client/src/components/chat/RichMedia.test.tsx): Kiểm tra bộ chọn Emoji và hộp thoại tìm kiếm GIF.
8. [`ReadReceiptsPagination.test.tsx`](../../client/src/components/chat/ReadReceiptsPagination.test.tsx): Kiểm tra hiển thị Read Receipt (`Seen [Mini-Avatar]`) và cuộn tải tin nhắn cũ.
9. [`ReconnectionSync.test.tsx`](../../client/src/components/common/ReconnectionSync.test.tsx): Kiểm tra `ConnectionStatusBanner` và tự động đồng bộ lại tin nhắn khi mạng phục hồi.
10. [`ResponsiveDashboard.test.tsx`](../../client/src/components/dashboard/ResponsiveDashboard.test.tsx): Kiểm tra bố cục Master-Detail trên mobile và Dual-Pane Persistent Detail View trên desktop.
11. [`ResponsiveMobileInput.test.tsx`](../../client/src/components/chat/ResponsiveMobileInput.test.tsx): Kiểm tra thanh công cụ nhập liệu trên màn hình di động.
12. [`GoogleChatExperience.test.tsx`](../../client/src/components/chat/GoogleChatExperience.test.tsx): Kiểm tra tổng thể trải nghiệm giao diện theo chuẩn Google Chat / GDG-HUST.
13. [`avatarColor.test.ts`](../../client/src/utils/avatarColor.test.ts): Kiểm tra tính tất định của thuật toán gán 4 màu đại diện Google (`Deterministic 4-Color Avatar`).
14. **Các bộ hồi quy bảo mật phía client**: [`safeUrl.test.ts`](../../client/src/utils/safeUrl.test.ts) (từ chối URL `javascript:`), [`AttachmentUrlRefresh.test.tsx`](../../client/src/components/chat/AttachmentUrlRefresh.test.tsx) (làm mới signed URL đúng một lần), [`UploadHardening.test.tsx`](../../client/src/components/chat/UploadHardening.test.tsx), [`RateLimit.test.tsx`](../../client/src/components/chat/RateLimit.test.tsx) và [`PublicProfile.test.tsx`](../../client/src/components/PublicProfile.test.tsx).

---

## TỔNG KẾT

Kiến trúc của dự án **Web Chat Real-Time (GDG-HUST Realtime Chat)** đạt được sự cân bằng tối ưu giữa:
- **Độ tin cậy & Tính mở rộng**: Tách bạch logic Direct và Room, schema toàn diện từ đầu, hợp đồng Monorepo chặt chẽ.
- **Trải nghiệm thời gian thực & Đa thiết bị mượt mà**: Tích hợp đầy đủ Presence Grace Period, Background Room Subscription, Delivery & Read Receipts (`Sent` $\rightarrow$ `Delivered` $\rightarrow$ `Seen`), Rich Media, Document Preview, cùng giao diện GDG-HUST chuẩn Responsive trên cả Desktop và Mobile.
- **Khả năng chịu lỗi cao**: Cơ chế phục hồi 2 tầng đảm bảo không mất tin nhắn dù mạng chập chờn, và không request nào làm sập process.
- **Bảo mật theo chiều sâu**: Session cookie thu hồi được, single-host chung origin với CSP chặt, Attachment riêng tư qua signed URL, validate mọi đầu vào, rate limit, log bảo mật có cấu trúc, cùng [`SECURITY.md`](../../SECURITY.md) và [runbook xử lý sự cố](../incident-runbook.md).
- **Tối ưu hóa chi phí & Kiểm thử toàn diện**: Vận hành 100% trên hạ tầng đám mây miễn phí và được bảo chứng bởi các bộ kiểm thử tự động phía Server và Client chạy độc lập với PGlite, gồm một test hồi quy cho mỗi lỗ hổng trong bản audit bảo mật.

