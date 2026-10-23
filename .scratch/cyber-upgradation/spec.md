# Spec: Cyber Upgradation: khắc phục các lỗ hổng từ Security Audit

Status: resolved

Nguồn:
- Danh sách lỗi: [`../security-audit/spec.md`](../security-audit/spec.md) (SEC-01 → SEC-18) và [`../security-audit/checklist.md`](../security-audit/checklist.md).
- Nhật ký quyết định của buổi grill: [`decisions.md`](./decisions.md) (Q1 → Q49). Spec này tổng hợp lại nhật ký đó.
- ADR liên quan:
  - [ADR 0009](../../docs/adr/0009-private-attachments-via-records-and-signed-urls.md): Attachment riêng tư.
  - [ADR 0010](../../docs/adr/0010-single-host-render-with-session-cookie.md): single-host trên Render với session cookie.

## Problem Statement

GDG-HUST Realtime Chat sắp có người dùng thật. Bản audit bảo mật ngày 2026-10-22 lại cho thấy hệ thống **không bảo vệ được User**:

- **Bất kỳ ai cũng giả mạo được bất kỳ User nào.** Secret ký token nằm công khai trên GitHub. Trên các môi trường dùng `.env`, server còn lặng lẽ dùng một secret mặc định có sẵn trong mã nguồn.
- **Project Supabase (gồm cả DB production) đang mở toang.** Key `service_role` và key `anon` bị commit lên repo public. Các bảng dữ liệu lại được expose qua Data API mà không bật RLS, nên ai có key là đọc, ghi được toàn bộ tin nhắn, `passwordHash` và mọi Attachment.
- **Mở một tin nhắn là có thể mất tài khoản.** Kẻ tấn công gửi Attachment có URL `javascript:`, hoặc upload file HTML/SVG được phục vụ cùng origin với app. Khi nạn nhân click, script chạy trong phiên của họ và đọc được token trong localStorage. Token này sống 7 ngày và không thu hồi được, kể cả khi bấm đăng xuất.
- **Một request là sập cả hệ thống.** Một User bất kỳ gửi dữ liệu sai kiểu là process Node thoát, mọi người cùng mất kết nối.
- **Kick khỏi room không có tác dụng.** Room Member đã rời hoặc bị kick vẫn tiếp tục nhận Room Message theo thời gian thực.
- **Không có giới hạn nào.** Có thể đoán mật khẩu không giới hạn số lần, spam hàng trăm tin trong một giây, và vượt qua Message Character Limit bằng metadata của Attachment.
- **Dữ liệu cá nhân bị lộ.** Email của toàn bộ User lấy được chỉ bằng một request. Attachment trong cuộc trò chuyện riêng thì ai có link cũng xem được, và ảnh còn giữ nguyên EXIF (vị trí GPS).
- **Không có lớp phòng thủ nào.** Không có security header, không có log bảo mật, không có kênh báo lỗ hổng, và không có quy trình xử lý sự cố.

Người vận hành dự án cũng không có công cụ nào để phản ứng khi xảy ra sự cố: không thu hồi được Session, không có log để điều tra, và không có runbook để làm theo.

## Solution

Nâng cấp bảo mật toàn diện, gom thành các nhóm sau. Mã SEC trong ngoặc là lỗi tương ứng trong audit.

1. **Dọn sạch secret đã lộ và khóa hạ tầng** (SEC-01, SEC-02):
   - Vô hiệu hóa mọi key Supabase đã lộ. Server chỉ dùng secret key loại mới của Supabase.
   - Secret không còn nằm trong repo. Repo có cơ chế tự chặn secret bị commit.
   - Data API của Supabase bị tắt và mọi bảng bật RLS.
   - Server từ chối khởi động khi thiếu cấu hình bắt buộc, và không bao giờ dùng giá trị mặc định cho secret.
2. **Session thật, thu hồi được** (SEC-11, SEC-02): bỏ hẳn JWT. Đăng nhập tạo một Session lưu trong DB, và trình duyệt giữ Session bằng cookie `HttpOnly` mà JavaScript không đọc được. User có thể đăng xuất thật sự, cũng như đăng xuất mọi thiết bị. Session bị thu hồi thì socket đang mở cũng bị ngắt ngay.
3. **Single-host chung origin, có đủ security header** (SEC-10, SEC-12): app và API cùng chạy trên Render và cùng một origin, nên không cần CORS. Mọi response đều có CSP chặt, HSTS, chống clickjacking, `nosniff`… Request thay đổi dữ liệu và kết nối socket từ site khác đều bị từ chối.
4. **Validate mọi đầu vào và không bao giờ sập** (SEC-05, SEC-08, SEC-09, SEC-14):
   - Mọi body REST và payload socket đi qua một schema dùng chung giữa client và server.
   - Có quy tắc rõ ràng cho username, mật khẩu, email, tên và mô tả room.
   - Lỗi bất ngờ không làm chết process và không để lộ chi tiết nội bộ: User chỉ nhận thông báo chung kèm mã tra cứu.
5. **Attachment riêng tư và an toàn** (SEC-03, SEC-04, SEC-14, SEC-15):
   - Mỗi file upload trở thành một bản ghi Attachment do server quản lý, nên client không còn tự khai URL, tên, kích thước hay loại tin.
   - File được kiểm tra loại theo nội dung thật, ảnh bị xóa EXIF, và file nằm trong bucket private.
   - Chỉ Direct Chat Participant hoặc Room Member hiện tại mới nhận được signed URL có hạn để xem.
   - Client từ chối render mọi URL không an toàn.
6. **Quyền realtime khớp với quyền thật** (SEC-06): rời room, bị kick, hay kết nối lại sau khi mất mạng đều được đối chiếu lại với danh sách Room Member trong DB.
7. **Giới hạn tần suất** (SEC-07): login, đăng ký, upload, tìm kiếm, GIF, tạo room và mọi event gửi tin hay typing đều bị giới hạn. Vượt ngưỡng thì nhận lỗi rõ ràng kèm thời gian phải chờ.
8. **Bảo vệ dữ liệu cá nhân** (SEC-13): email chỉ hiển thị cho chính chủ, và tìm kiếm User chỉ theo username.
9. **Nâng cấp dữ liệu hiện có**: chuyển sang Prisma Migrate. Dữ liệu production hiện tại được giữ lại, nhưng được chuẩn hóa theo các quy tắc mới, và bucket được dọn các file không ai tham chiếu.
10. **Vận hành** (SEC-16, SEC-17, SEC-18): cập nhật dependency có lỗ hổng, ghi log bảo mật có cấu trúc, thêm `SECURITY.md` và runbook xử lý sự cố.

## User Stories

### Tài khoản và đăng nhập

1. As a User, I want my account to be impossible to impersonate even if someone reads the public repository, so that nobody can read my messages or act on my behalf.
2. As a User, I want to stay signed in across page reloads and across tabs in the same browser, so that I do not have to log in repeatedly.
3. As a User, I want my login credential to be stored where page scripts cannot read it, so that a malicious script in a message cannot steal my session.
4. As a User, I want to click "Đăng xuất" and have my Session truly ended on the server, so that anyone who copied my session cannot keep using it.
5. As a User, I want a "Đăng xuất mọi thiết bị" action, so that I can cut off every other browser where I am signed in if I suspect my account was compromised.
6. As a User, I want an idle Session to expire after 7 days of inactivity and any Session to expire after at most 30 days, so that a forgotten login on a shared computer does not stay valid forever.
7. As a User, I want to be returned to the login screen with a clear message whenever my Session is no longer valid, so that I understand why I need to sign in again.
8. As a User, I want my open real-time connection to close as soon as my Session is revoked or expires, so that a revoked Session cannot keep receiving messages.
9. As a User registering an account, I want clear validation messages for username, email and password, so that I know exactly what to fix.
10. As a User registering an account, I want my username to be 3–32 characters long and made only of letters, digits, `_` and `.`, so that names display cleanly everywhere in the app.
11. As a User, I want usernames to be unique regardless of letter case, so that nobody can impersonate `alice` by registering `Alice`.
12. As a User, I want my password to be at least 8 characters (and at most 72 bytes), so that my account is not trivially guessable.
13. As a User, I want my email to be validated for format and stored in lowercase, so that the same email cannot be registered twice with different casing.
14. As a User, I want login to require an exact username or email, so that attackers cannot log in by matching account names against a pattern.
15. As a User, I want repeated failed login attempts against my account to be throttled, so that my password cannot be brute-forced.
16. As a User, I want my avatar to always be the Deterministic 4-Color Avatar, so that nobody can make my browser load images from an attacker's server through someone's avatar.

### Tin nhắn và Attachment

17. As a Direct Chat Participant, I want Attachments in our conversation to be viewable only by the two of us, so that private photos and documents cannot be opened by anyone holding a link.
18. As a Room Member, I want Room Attachments to be viewable only by current Room Members, so that people who left or were kicked lose access to shared files.
19. As a User, I want Attachment links to keep working while I am using the app even though they expire, so that images and Document Previews do not break during normal use.
20. As a User, I want an expired Attachment link to refresh automatically when I view it, so that I never see a broken image just because time passed.
21. As a User, I want the name, size and type of an Attachment to come from the real uploaded file, so that a sender cannot disguise a file as something else.
22. As a User, I want an Attachment to be attached to exactly one message, so that someone cannot reuse another person's upload in a different conversation.
23. As a User, I want links in messages, Attachments and GIFs to never execute code when I click them, so that opening a message cannot hijack my account.
24. As a User, I want GIF messages to only display images from Giphy, so that GIFs cannot be used to track me or run scripts.
25. As a User uploading a photo, I want location and device metadata (EXIF) to be removed automatically, so that I do not accidentally reveal where I live.
26. As a User uploading a photo, I want the photo to keep its correct orientation after metadata is removed, so that it does not appear rotated.
27. As a User, I want animated GIF uploads to stay animated, so that metadata removal does not break them.
28. As a User, I want to upload common images (JPEG, PNG, GIF, WebP) and documents (PDF, Word, Excel, PowerPoint in both modern and legacy formats, TXT, CSV, Markdown, JSON), so that I can share what I normally need.
29. As a User, I want the file picker to only offer allowed file types, so that I am not surprised by a rejection after choosing a file.
30. As a User, I want a clear error when I upload a disallowed or disguised file (HTML, SVG, executable, ZIP…), so that I understand why it was rejected.
31. As a User, I want text-based documents to always be shown as plain text, so that a `.csv` or `.md` file cannot run scripts in Document Preview.
32. As a User, I want messages whose old Attachment was unsafe or unavailable to show "Tệp đính kèm không còn khả dụng" while keeping the text, so that history stays readable.
33. As a User, I want Attachment names to be capped at 255 characters, so that file names cannot be used to flood the chat past the Message Character Limit.
34. As a User, I want the Message Character Limit to be impossible to bypass through any field of a message, so that spam protection actually works.

### Room Chat và quyền realtime

35. As a Room OWNER or ADMIN, I want a kicked member to stop receiving Room Messages, Typing Indicators and Read Receipts immediately, so that moderation actually removes them.
36. As a Room OWNER or ADMIN, I want a member who was kicked while briefly offline to not regain access upon reconnecting, so that kicks cannot be dodged by dropping the network.
37. As a Room Member, I want to stop receiving a room's real-time events as soon as I leave it, so that leaving is respected by the system.
38. As a Room Member, I want Connection State Recovery to restore missed messages without restoring access I no longer have, so that reconnecting is seamless but safe.
39. As a Room creator, I want room names to be 1–64 characters and descriptions at most 500 characters, so that rooms display cleanly and cannot be used for spam.
40. As a User, I want room creation to be rate-limited, so that the room list cannot be flooded.

### Độ ổn định và chống lạm dụng

41. As a User, I want the server to stay up no matter what any other user sends, so that one malicious request cannot disconnect everyone.
42. As a User, I want unexpected errors to show a generic message with a reference code, so that I can report the problem without the app exposing internal details.
43. As a User sending an oversized request, I want a clear "too large" error, so that I know to shorten it.
44. As a User, I want message sending and typing events to be rate-limited per account, so that nobody can flood a conversation.
45. As a User who hits a rate limit, I want to be told how long to wait, so that I can retry at the right time.
46. As a User, I want upload volume to be limited per account, so that storage cannot be exhausted by abuse.
47. As a User, I want user search and GIF search to be rate-limited, so that the directory cannot be scraped and the shared Giphy quota is not exhausted.
48. As a User, I want new account registration to be rate-limited per IP, so that bots cannot mass-create accounts.

### Quyền riêng tư

49. As a User, I want my email address to be visible only to me, so that other users cannot harvest it for spam or phishing.
50. As a User, I want user search to match only usernames, so that nobody can probe the directory for email addresses.
51. As a User, I want user search to require a query and return a limited number of results, so that the full user list cannot be dumped in one request.
52. As a Direct Chat Participant or Room Member, I want member lists and chat partners to show only public profile information, so that joining a room does not expose my email.

### Bảo vệ ở tầng trình duyệt

53. As a User, I want the app to refuse to load scripts from anywhere but itself, so that even an injected script tag cannot run.
54. As a User, I want the app to refuse to be embedded in another site's frame, so that I cannot be tricked into clicking "Kick" or "Delete room" through clickjacking.
55. As a User, I want the browser to always use HTTPS for the app, so that my traffic cannot be downgraded.
56. As a User, I want the browser to never guess file types, so that uploaded content cannot be reinterpreted as a web page.
57. As a User, I want links I follow out of the app not to reveal full internal URLs, so that my activity is not leaked to external sites.
58. As a User, I want actions from other websites (forms, scripts, WebSocket connections) to be rejected even though my browser holds my Session cookie, so that cross-site request forgery is impossible.

### Người vận hành dự án

59. As the project maintainer, I want all leaked keys to be deactivated and replaced, so that the public copies in git history are useless.
60. As the project maintainer, I want the deploy blueprint to contain no secret values, so that deploy configuration is safe to keep in a public repository.
61. As the project maintainer, I want GitHub secret scanning, push protection and a local pre-commit secret scanner, so that a secret is blocked before it ever reaches the public repo.
62. As the project maintainer, I want Supabase's Data API disabled and Row Level Security enabled on every table, so that even a leaked key cannot read the database through Supabase's REST endpoints.
63. As the project maintainer, I want the server to refuse to start when a required setting is missing or when production is configured with local disk storage, so that misconfiguration is caught at deploy time instead of silently weakening security.
64. As the project maintainer, I want production to refuse to start if the built client is missing, so that the single-host deployment is never half-deployed.
65. As the project maintainer, I want database changes to be versioned migrations, so that schema changes are repeatable and reviewable.
66. As the project maintainer, I want existing production data to be normalized to the new rules (usernames, emails, room names, Attachments), with a report of every renamed account, so that I can keep the data and review what changed.
67. As the project maintainer, I want orphaned objects in the storage bucket deleted and the bucket made private, so that files planted with the leaked key are removed.
68. As the project maintainer, I want structured security logs for logins (success and failure, with IP), registrations, logouts, Session revocations, rate-limit hits, uploads, admin actions (kick, role change, delete room) and rejected 401/403 requests, so that I can detect and investigate abuse.
69. As the project maintainer, I want every error log to carry the same reference code shown to the user, so that I can match a user's report to the server log.
70. As the project maintainer, I want logs to never contain passwords, Session tokens, cookies or secret keys, so that logs do not become a new leak.
71. As the project maintainer, I want a command to revoke every Session of one User or of all Users, so that I can force a global sign-out during an incident.
72. As the project maintainer, I want an incident runbook covering key rotation, Session revocation, data impact assessment and user notification, so that I know exactly what to do when the next incident happens.
73. As the project maintainer, I want vulnerable dependencies upgraded where a patch exists, and accepted risks documented, so that the dependency audit reflects deliberate decisions.
74. As a security researcher, I want a `SECURITY.md` with a private reporting channel, so that I can report a vulnerability without disclosing it publicly.
75. As a developer, I want the client and server to share one set of validation schemas, so that client-side hints and server-side enforcement never drift apart.
76. As a developer, I want local development to work with the same cookie and same-origin model as production, so that I am not testing a different security setup than what ships.
77. As a developer, I want every audit finding to have a regression test that reproduces the original attack, so that the vulnerability cannot silently return.

## Implementation Decisions

### Tổng quan kiến trúc

- **Topology** (ADR 0010, thay một phần ADR 0002): production là **single-host trên Render** tại `https://webchat-realtime.onrender.com`. Express phục vụ SPA, REST API và Socket.IO trên cùng một origin. Không dùng Vercel. Xóa cấu hình Vercel và các biến `VITE_API_URL`, `VITE_SOCKET_URL`, vì client luôn gọi cùng origin. Dev dùng proxy Vite sẵn có (`/api`, `/socket.io`), nên cũng chung origin.
- **Server factory (seam test chính):** thay `app` được tạo ngay lúc import bằng một hàm dựng server. Hàm nhận *cấu hình đã validate* và *storage adapter*, rồi trả về server HTTP đã gắn Express và Socket.IO. Entrypoint production chỉ làm ba việc: nạp cấu hình, dựng storage adapter thật, gọi factory rồi listen. Mọi module không còn đọc thẳng `process.env`.
- **Module cấu hình:** `.env` được nạp trước mọi import khác. Module có một hàm nhận object biến môi trường và trả về cấu hình có kiểu, hoặc ném lỗi liệt kê *mọi* biến sai. Quy tắc:
  - Bắt buộc ở mọi môi trường: `DATABASE_URL` (riêng test được dùng `memory:`) và `APP_ORIGIN`, là origin mà trình duyệt nhìn thấy, ví dụ `https://webchat-realtime.onrender.com` ở production hoặc `http://localhost:5173` ở dev.
  - Bắt buộc ở production: `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, và thư mục build của client phải tồn tại.
  - Tùy chọn: `PORT`, `GIPHY_API_KEY`, `LOG_LEVEL`. Các ngưỡng rate limit và TTL có giá trị mặc định theo spec, test có thể ghi đè.
  - Không có giá trị fallback hardcode cho bất kỳ secret nào. `STORAGE_PROVIDER=local` hoặc để trống ở `NODE_ENV=production` thì báo lỗi.
  - Bỏ các biến `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PUBLIC_URL` và toàn bộ biến Cloudinary.
- **Blueprint Render:** mọi secret (`DATABASE_URL`, `SUPABASE_SECRET_KEY`, `GIPHY_API_KEY`) chuyển sang `sync: false`. Xóa `JWT_SECRET` cùng các key Supabase cũ. Thêm `APP_ORIGIN` dưới dạng giá trị thường, vì nó không phải secret. Lệnh khởi động chạy `prisma migrate deploy` trước khi start server.

### Session và xác thực (SEC-11, SEC-02, SEC-01 phần JWT)

- **Gỡ hẳn JWT:** gỡ thư viện `jsonwebtoken` và mọi đường đọc header `Authorization: Bearer` lẫn `handshake.auth.token`.
- **Module Session store:** interface ở mức hành vi gồm:
  - `create(userId, { ip, userAgent })`: trả về token gốc, đây là lần duy nhất token gốc xuất hiện.
  - `resolve(rawToken)`: trả về `{ session, user }`, hoặc rỗng nếu session không tồn tại, đã hết hạn hoặc đã bị thu hồi.
  - `revoke(sessionId)`, `revokeAllForUser(userId)`, `revokeAll()`.
  - Module tự phát sự kiện "session bị thu hồi" để tầng socket ngắt kết nối.
- **Token:** 32 byte ngẫu nhiên từ CSPRNG. DB chỉ lưu SHA-256 của token, không bao giờ lưu token gốc.
- **Hết hạn:** 7 ngày không hoạt động (idle), tối đa 30 ngày kể từ lúc tạo (absolute). `lastActiveAt` được cập nhật khi có request, nhưng tối đa một lần mỗi vài phút để tránh ghi DB liên tục.
- **Cookie:** `__Host-session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`. Trình duyệt chấp nhận cookie `Secure` trên `localhost`, nên dev dùng cùng cấu hình.
- **Hợp đồng API auth:**
  - `POST /api/auth/register`: trả `201`, đặt cookie, body `{ user }` (DTO của chính chủ, có email).
  - `POST /api/auth/login`: body `{ emailOrUsername, password }`, trả `200`, đặt cookie, body `{ user }`. Sai thông tin thì luôn trả `401` với cùng một thông báo, không phân biệt sai username hay sai mật khẩu.
  - `POST /api/auth/logout`: trả `204`, thu hồi Session hiện tại và xóa cookie.
  - `POST /api/auth/logout-all`: trả `204`, thu hồi mọi Session của User, kể cả Session hiện tại, và xóa cookie.
  - `GET /api/auth/me`: trả `200 { user }` hoặc `401`.
  - Response không còn trường `token`.
- **Auth middleware (REST):** đọc cookie và gọi `resolve`. Thất bại thì trả `401`. Kết quả gắn `user` và `session` vào request.
- **Chống CSRF:** với mọi `POST`, `PATCH`, `PUT`, `DELETE`:
  - Có header `Origin` thì phải bằng đúng `APP_ORIGIN`.
  - Không có `Origin` thì phải có `Sec-Fetch-Site: same-origin`.
  - Thiếu cả hai, hoặc sai, thì trả `403`.
  - Áp dụng cả cho `/api/upload` (multipart) và các endpoint auth. Không dùng CSRF token.
- **Xác thực socket:**
  - Middleware handshake kiểm tra `Origin` bằng `APP_ORIGIN` (chống Cross-Site WebSocket Hijacking), rồi đọc cookie và `resolve`.
  - Socket hợp lệ join room nội bộ `user:<userId>` (đã có) và `session:<sessionId>`.
  - Khi Session bị thu hồi, tầng socket ngắt mọi socket trong `session:<sessionId>`. Khi `revokeAllForUser`, ngắt mọi socket trong `user:<userId>`.
  - Mỗi socket hẹn giờ tự ngắt đúng lúc Session đạt hạn absolute.
  - `connectionStateRecovery` đặt `skipMiddlewares: false`, nên socket được khôi phục vẫn bị kiểm tra lại Origin và Session.
- **Client:**
  - `AuthContext` không còn lưu gì trong localStorage, xóa cả `webchat_token` lẫn user cache. Khi khởi động, client gọi `GET /api/auth/me`. Trong lúc chờ, client hiện trạng thái "đang kết nối máy chủ" (dùng lại UI hiện có cho cold start).
  - Mọi lời gọi `fetch` bỏ header `Authorization`. Client dùng một helper gọi API chung, và mọi `401` đều đưa về màn đăng nhập.
  - Kết nối socket không truyền `auth`.
  - Thêm nút "Đăng xuất mọi thiết bị" cạnh nút đăng xuất hiện có.
- **Lệnh vận hành:** một lệnh CLI phía server để thu hồi Session theo User (username hoặc id) hoặc thu hồi toàn bộ. Runbook dùng lệnh này.

### Single-host, CORS và security header (SEC-10, SEC-12)

- Gỡ middleware `cors` trên REST và bỏ `cors: { origin: '*' }` trên Socket.IO. Không có biến `CORS_ORIGINS`.
- Dùng `helmet` cho mọi response, cả SPA, API lẫn file tĩnh:
  - **CSP:** `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: <SUPABASE_ORIGIN> https://*.giphy.com; connect-src 'self' <SUPABASE_ORIGIN>; frame-src <SUPABASE_ORIGIN>; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`.
  - `<SUPABASE_ORIGIN>` lấy từ `SUPABASE_URL` khi khởi động.
  - Nếu bản build có `<style>` inline thì chỉ nới `style-src` bằng `'unsafe-inline'`, và ghi lý do vào phần comment cấu hình. Nếu WebSocket bị CSP chặn trên trình duyệt thực tế thì thêm `wss://` của `APP_ORIGIN` vào `connect-src`.
  - Bật chặn thật ngay, không qua giai đoạn report-only.
  - Kèm theo: `Strict-Transport-Security` (`max-age` một năm, `includeSubDomains`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` tắt camera, microphone và geolocation, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`. Tắt `X-Powered-By`.
- Phục vụ SPA:
  - Production bắt buộc phục vụ SPA, thiếu build thì không khởi động.
  - Fallback `index.html` chỉ áp cho request `GET` không thuộc `/api`, `/socket.io`, `/health` hay `/uploads`. Khi dùng adapter `local`, `/uploads` vẫn là đường riêng.
- `app.set('trust proxy', 1)` để lấy đúng IP client sau proxy của Render, phục vụ rate limit và log.

### Validation và xử lý lỗi (SEC-05, SEC-08, SEC-09, SEC-14)

- **Schema dùng chung (zod):** đặt trong package `shared`. Client dùng để hiện gợi ý validate, server dùng để bắt buộc tuân thủ. Mọi body REST, mọi query và param có ý nghĩa, và mọi payload socket đều được parse trước khi chạm tới Prisma. Payload sai trả `400` (REST) hoặc callback lỗi `VALIDATION_ERROR` (socket), kèm danh sách field sai.
  - Schema chỉ nhận đúng kiểu nguyên thủy mong đợi. Gửi object vào field chuỗi (như A09 `{"contains":"b"}`) sẽ bị từ chối ngay ở tầng schema.
- **Quy tắc trường:**
  - `username`: 3–32 ký tự, khớp `^[a-zA-Z0-9_.]+$`, unique không phân biệt hoa thường. Hiển thị theo cách User nhập, so sánh theo chữ thường.
  - `password`: 8–72 byte UTF-8.
  - `email`: đúng định dạng, chuẩn hóa về chữ thường, unique. Không xác minh email.
  - Room `name`: 1–64 ký tự sau khi cắt khoảng trắng hai đầu. Room `description`: tối đa 500 ký tự. Cả hai không được chứa ký tự điều khiển.
  - Tin nhắn: `content` vẫn theo Message Character Limit hiện có (4000 cho Direct Chat và cho OWNER/ADMIN trong Room Chat, 2000 cho MEMBER).
  - Payload gửi tin chỉ nhận một trong các dạng: văn bản; văn bản kèm `attachmentId`; hoặc GIF (`gifUrl` là `https` có host `media*.giphy.com` hoặc `i.giphy.com`).
  - Client không còn gửi `type`, `attachmentUrl`, `attachmentName`, `attachmentSize`. Server suy ra `MessageType`: `TEXT`, `IMAGE` hay `DOCUMENT` theo loại của Attachment, hoặc `EMOJI_GIF`.
- **Bỏ `avatarUrl`:** xóa khỏi input đăng ký, khỏi DTO và khỏi schema DB. Client luôn dùng Deterministic 4-Color Avatar, kể cả icon của browser Notification.
- **Xử lý lỗi:**
  - Giữ Express 4. Mọi route handler async được bọc qua một `asyncHandler`, và mọi socket handler được bọc qua một wrapper tương đương. Lỗi được chuyển về error handler tập trung, hoặc về callback lỗi của socket.
  - Mỗi request và mỗi event socket có `requestId`, trả về cho client trong header `X-Request-Id`.
  - Error handler toàn cục chỉ trả `{ message, code, requestId }` với thông báo chung. Không bao giờ trả `err.message` gốc, lỗi Prisma hay lỗi của dịch vụ lưu trữ.
  - Body JSON quá lớn trả `413`, JSON sai cú pháp trả `400`.
  - Callback socket chỉ trả `{ success: false, error: <code>, requestId }`.
  - `unhandledRejection` và `uncaughtException` được log với mức fatal. Riêng `unhandledRejection` không làm process thoát. Mục tiêu là không lỗi nào có thể chạm tới tầng đó; tầng này chỉ là lưới an toàn cuối.
- `maxHttpBufferSize` của Socket.IO giảm xuống 64KB.

### Attachment (SEC-03, SEC-04, SEC-14, SEC-15; ADR 0009)

- **Storage adapter interface:**
  - `put(buffer, { contentType })`: trả về `storageKey`.
  - `createSignedUrl(storageKey, ttlSeconds)`: trả về `{ url, expiresAt }`. Có thêm biến thể ký nhiều key cùng lúc.
  - `delete(storageKey)` và `list()`. `list()` dùng cho việc dọn bucket.
  - Có ba bản cài đặt:
    - **Supabase**: gửi secret key chỉ qua header `apikey`, dùng API signed URL của Supabase, bucket private.
    - **Local**: chỉ dev và test. Phục vụ file kèm `Content-Disposition: attachment` và `nosniff`, signed URL là đường dẫn có chữ ký HMAC và hạn dùng.
    - **In-memory** cho test.
  - Xóa adapter Cloudinary.
- **`storageKey`:** UUID ngẫu nhiên, không chứa tên gốc của file.
- **Upload:**
  - Giới hạn 10MB như hiện tại.
  - Loại file được phát hiện bằng magic bytes. MIME do client khai và đuôi file bị bỏ qua.
  - Allowlist:

    | Nhóm | Định dạng | Cách nhận diện | `Content-Type` khi lưu |
    |---|---|---|---|
    | Ảnh | JPEG, PNG, WebP | magic bytes | theo loại thật |
    | Ảnh | GIF | magic bytes | `image/gif` |
    | Tài liệu | PDF | magic bytes | `application/pdf` |
    | Tài liệu | DOCX, XLSX, PPTX | chữ ký ZIP **và** cấu trúc OOXML bên trong | MIME OOXML tương ứng |
    | Tài liệu | DOC, XLS, PPT | chữ ký OLE/CFB | MIME Office cũ tương ứng |
    | Văn bản | TXT, CSV, MD, JSON | UTF-8 hợp lệ, không có byte NUL | luôn là `text/plain; charset=utf-8` |

  - Mọi định dạng khác bị từ chối với `415`, kể cả SVG, HTML, XML, RTF, ZIP thuần và file thực thi.
  - **Xóa EXIF:** JPEG, PNG và WebP được re-encode qua `sharp`. Ảnh được xoay theo EXIF orientation trước, sau đó bỏ toàn bộ metadata. GIF giữ nguyên, không re-encode.
  - `size` của Attachment là kích thước sau xử lý.
- **Bản ghi Attachment:**
  - Upload thành công thì tạo bản ghi `{ id, uploaderId, storageKey, kind (IMAGE | DOCUMENT), mimeType, size, originalName (đã cắt còn ≤255 ký tự), createdAt }`.
  - Bản ghi liên kết tới **đúng một** Direct Message hoặc Room Message. Liên kết này nullable cho tới lúc gửi, và unique.
  - Response upload trả `201 { attachment: AttachmentDto }`, gồm signed URL để người upload xem trước.
- **Gửi tin kèm Attachment:**
  - Server kiểm tra Attachment tồn tại, `uploaderId` là người gửi, và Attachment chưa gắn vào tin nào.
  - Thất bại thì trả callback lỗi `ATTACHMENT_INVALID`.
  - Server tự điền loại tin. Message Character Limit áp cho `content`, với caption có chung giới hạn như hiện tại.
- **`AttachmentDto` trong mọi Direct Message hay Room Message:** `{ id, kind, mimeType, size, name, url, urlExpiresAt }`. Server ký URL với TTL 1 giờ mỗi khi trả lịch sử, Catch-up Sync hay broadcast. Tin có Attachment không còn khả dụng thì có `attachment: null` và cờ `attachmentUnavailable: true`.
- **Endpoint làm mới URL:** `GET /api/attachments/:id/url` trả `200 { url, expiresAt }` khi người gọi là Direct Chat Participant của Direct Chat chứa tin, hoặc Room Member hiện tại của Room chứa tin. Người upload xem Attachment chưa gắn tin của chính mình cũng được phép. Trường hợp khác trả `404`, không phân biệt "không tồn tại" với "không có quyền".
- **Client:**
  - Thêm một helper URL an toàn, chỉ cho phép `https:` và `blob:`; URL tương đối cùng origin cũng được chấp nhận ở dev. Mọi chỗ đưa URL vào `href`, `src`, `iframe` hay `window.open` (thẻ tài liệu, nút Download, Document Preview, Image Lightbox, GIF) phải đi qua helper này. URL không an toàn thì không render link hay iframe.
  - Khi `<img>`, iframe preview hoặc `fetch` preview văn bản thất bại, hoặc khi `urlExpiresAt` đã qua, client gọi endpoint làm mới đúng một lần rồi thử lại.
  - Input file có thuộc tính `accept` khớp với allowlist.
  - Tin có `attachmentUnavailable` hiển thị "Tệp đính kèm không còn khả dụng".

### Quyền realtime trong room (SEC-06)

- `leaveRoom` đồng bộ membership của socket (cho socket rời room `room:<id>`), giống `removeRoomMember` và `addRoomMember` đang làm.
- Khi một socket kết nối với `socket.recovered === true`, server đối chiếu mọi room `room:<id>` mà socket đang ở với bảng Room Member, và cho socket rời các room mà User không còn là thành viên. Việc đối chiếu xong trước khi socket nhận thêm event nào.
- Không kiểm tra membership trước mỗi broadcast.
- Cập nhật định nghĩa Connection State Recovery trong GLOSSARY (đã làm).

### Rate limiting (SEC-07)

- Bộ đếm in-memory, vì Render free chạy một instance. Ghi rõ trong comment rằng khi scale ngang thì phải chuyển sang store dùng chung.
- REST dùng `express-rate-limit`. Socket dùng token bucket tự viết, tính theo `userId`.
- Ngưỡng mặc định (có thể cấu hình):

  | Mục | Khóa | Ngưỡng |
  |---|---|---|
  | Login thất bại | IP + identifier (chữ thường) | 10 / 15 phút |
  | Register | IP | 5 / giờ |
  | Upload | userId | 20 / 10 phút |
  | `GET /api/users` | userId | 30 / phút |
  | `/api/gifs/*` | userId | 30 / phút |
  | `POST /api/rooms` | userId | 10 / giờ |
  | `direct:send`, `room:send` (gộp) | userId | 10 / 10 giây |
  | Typing (Direct Chat và Room Chat) | userId | 1 / giây, event vượt ngưỡng bị bỏ qua lặng lẽ |

- REST vượt ngưỡng trả `429` kèm header `Retry-After`. Socket gửi tin vượt ngưỡng trả callback `{ success: false, error: 'RATE_LIMITED', retryAfterMs }`. Client hiện thông báo kèm thời gian phải chờ.

### Quyền riêng tư User (SEC-13)

- Hai DTO tách biệt: `SelfUserDto` có email, chỉ trả ở `/api/auth/me`, register và login. `PublicUserDto` gồm `{ id, username, isOnline, lastSeenAt }`, dùng ở mọi chỗ khác: danh sách user, danh sách Room Member, partner của Direct Chat, sender của tin nhắn.
- `GET /api/users` bắt buộc có `q` từ 1 ký tự trở lên, thiếu thì trả `400`. Chỉ khớp theo `username` (không phân biệt hoa thường) và trả tối đa 20 kết quả.

### Thay đổi schema DB

- Chuyển sang **Prisma Migrate:**
  - Tạo migration `0_baseline` đúng bằng schema production hiện tại, rồi đánh dấu đã áp dụng trên production bằng `prisma migrate resolve --applied`.
  - Mọi thay đổi sau đó là migration có version.
  - Schema SQL nạp cho PGlite trong test được sinh từ chính Prisma schema (`migrate diff` từ rỗng tới schema), có script tái tạo, và không được sửa tay.
- **Model mới và thay đổi:**
  - `User`: bỏ `avatarUrl`; thêm khóa username chuẩn hóa (chữ thường) có unique; `email` luôn lưu chữ thường.
  - `Session`: `id`, `userId`, `tokenHash` (unique), `createdAt`, `lastActiveAt`, `expiresAt` (absolute), `ip`, `userAgent`. Thu hồi Session bằng cách xóa dòng.
  - `Attachment`: như mục Attachment, với khóa ngoại nullable và unique tới Direct Message hoặc Room Message, xóa theo cascade khi tin nhắn bị xóa.
  - `DirectMessage` và `RoomMessage`: bỏ `attachmentUrl`, `attachmentName`, `attachmentSize` sau khi dữ liệu đã được chuyển.
  - Ràng buộc độ dài cho `Room.name` và `Room.description` ở tầng DB.
- **RLS:** một migration bật Row Level Security trên **mọi** bảng, kể cả bảng quản lý migration của Prisma, mà không tạo policy nào. Prisma kết nối bằng role chủ sở hữu bảng nên không bị ảnh hưởng.
- **Trình tự expand → dữ liệu → contract:**
  - *Expand migration:* thêm bảng và cột mới (nullable), chưa xóa gì.
  - *Lệnh nâng cấp dữ liệu (seam test thứ 3):* một lệnh CLI phía server. Lệnh nhận Prisma client và storage adapter, chạy idempotent, có chế độ `--dry-run` chỉ in báo cáo. Lệnh làm:
    1. Username vi phạm quy tắc (ký tự ngoài `[a-zA-Z0-9_.]`, dài quá 32 hoặc ngắn hơn 3) được đổi thành `user_<6 ký tự đầu của id>`. Cặp trùng không phân biệt hoa thường thì giữ tài khoản tạo trước và đổi tên tài khoản sau.
    2. Email chuyển về chữ thường. Email trùng sau khi chuyển thì gắn `+dup<n>` vào phần local của tài khoản tạo sau.
    3. Room `name` và `description` được cắt về giới hạn và bỏ ký tự điều khiển. `name` rỗng sau khi làm sạch thì thành `Room <6 ký tự đầu của id>`.
    4. Tin có URL đính kèm trỏ đúng bucket của dự án (tức là bắt đầu bằng `SUPABASE_URL` cộng đường dẫn object public của bucket) được tách lấy `storageKey` và tạo Attachment với `uploaderId` là người gửi. `kind` theo `MessageType`, `mimeType` lấy theo metadata của object (không có thì là `application/octet-stream`), `originalName` cắt còn ≤255 ký tự, `size` âm hoặc không có thì đặt bằng 0.
    5. Tin có URL đính kèm **không** thuộc bucket (`javascript:`, domain lạ, rỗng) bị gỡ phần đính kèm và giữ `content`.
    6. Tin `EMOJI_GIF` có URL không thuộc host Giphy chuyển thành `TEXT`, với `content` là chuỗi rỗng kèm cờ đính kèm không khả dụng.
    7. Đặt mọi `avatarUrl` về null. Cột bị xóa ở bước contract.
    8. Xóa mọi object trong bucket không được Attachment nào tham chiếu.
    9. In báo cáo: các tài khoản bị đổi username hoặc email (giá trị cũ → mới), số tin bị gỡ đính kèm, số object bị xóa.
  - *Contract migration:* xóa các cột cũ, thêm ràng buộc unique và ràng buộc độ dài. Migration này lỗi nếu lệnh dữ liệu chưa chạy, và đó là điều cố ý.
  - Chuyển bucket sang private sau bước contract. Việc chuyển làm trên dashboard theo checklist, hoặc qua storage API trong lệnh nâng cấp.
  - Mọi Session cũ đều mất hiệu lực vì JWT không còn tồn tại, nên mọi User phải đăng nhập lại. Điều này được chấp nhận vì chưa có người dùng thật.

### Logging và giám sát (SEC-17)

- Dùng logger JSON có cấu trúc (`pino`). Mỗi dòng log có `requestId`, `userId` và `ip` khi có. Cấu hình redact cho `password`, `cookie`, `set-cookie`, `authorization` và mọi khóa chứa `secret`, `token`.
- Sự kiện bắt buộc ghi: `auth.login.success`, `auth.login.failure` (có identifier đã chuẩn hóa), `auth.register`, `auth.logout`, `auth.logout_all`, `session.revoked`, `ratelimit.hit`, `upload.accepted`, `upload.rejected` (có lý do), `room.member.kicked`, `room.member.role_changed`, `room.deleted`, `room.left`, `http.401`, `http.403`, `socket.handshake.rejected`, cùng mọi lỗi 5xx (kèm stack, chỉ trong log).
- `/health` giữ nguyên. Thêm `/health/ready` để kiểm tra kết nối DB. Không dùng dịch vụ monitoring trả phí. Monitor ping (ví dụ UptimeRobot) chỉ được nhắc trong runbook như tùy chọn chống cold start.

### Dependency (SEC-16)

- Nâng `prisma` và `@prisma/*` lên bản vá mới nhất trong major 7 (7.10.1, nếu bản này vá được các advisory đã liệt kê). Nếu advisory vẫn còn thì ghi nhận lý do trong `SECURITY.md`.
- Chuyển các gói chỉ dùng lúc build hoặc chỉ dùng cho kiểu (`prisma` CLI nếu có thể, `@types/*`, `typescript`) sang `devDependencies` nếu việc này không phá build trên Render.
- **Tailwind v3:** chấp nhận rủi ro và ghi lại trong `SECURITY.md`. Lý do: bản 3.4.19 là bản `v3-lts` mới nhất, các lỗi đều là DoS lúc build, và đầu vào là mã nguồn của dự án. Nâng lên Tailwind 4 là việc riêng.
- Thêm các thư viện mới: `zod`, `helmet`, `express-rate-limit`, `pino`, `sharp`, `file-type`, `cookie-parser` hoặc tương đương. Ghim theo semver bình thường.

### Quy trình và tài liệu (SEC-18, SEC-01)

- **`SECURITY.md`:** phạm vi, kênh báo cáo riêng tư (GitHub Private Vulnerability Reporting), thời gian phản hồi mục tiêu, và các rủi ro đã chấp nhận (Tailwind v3, rate limit in-memory, cold start).
- **Runbook xử lý sự cố** trong `docs/`: phát hiện; xoay vòng key Supabase; thu hồi Session (lệnh CLI); đánh giá phạm vi qua log ứng dụng và log Supabase; thông báo cho User. Kèm một ví dụ áp dụng đúng vào sự cố SEC-01.
- **Pre-commit hook `gitleaks`** cho repo. Thêm hướng dẫn trong README.
- **Checklist thủ công cho người vận hành,** ghi trong spec và lặp lại trong runbook:
  1. Supabase: tạo secret key mới (`sb_secret_…`) và đặt vào `SUPABASE_SECRET_KEY` trên Render.
  2. Supabase: deactivate hai legacy key `anon` và `service_role`.
  3. Supabase: tắt Data API. Nếu không tắt hẳn được thì bỏ `public` khỏi danh sách schema được expose. Kiểm tra lại: `GET /rest/v1/User` bằng key mới phải trả lỗi hoặc danh sách rỗng.
  4. Supabase: chuyển bucket `attachments` sang private, sau khi đã chạy lệnh nâng cấp dữ liệu.
  5. Render: xóa `JWT_SECRET` và các biến key Supabase cũ, đặt `APP_ORIGIN`, xác nhận các biến `sync: false` đã có giá trị.
  6. GitHub: bật Secret scanning, Push protection và Private vulnerability reporting.
  7. Sau khi deploy: kiểm tra CSP và cookie bằng DevTools trên production (không có lỗi CSP trong console, cookie có cờ `HttpOnly`, `Secure`, `SameSite=Strict`). Đăng nhập, gửi ảnh, xem tài liệu, gửi GIF và kick thành viên đều phải hoạt động.
- **Cập nhật tài liệu:**
  - ADR 0002 và ADR 0004: ghi rõ phần nào bị ADR 0010 và ADR 0009 thay thế.
  - README và kiến trúc hệ thống: deploy single-host, biến môi trường mới, quy trình migration.
  - `.env.example`: các biến mới. Không còn `JWT_SECRET`.

## Testing Decisions

### Thế nào là một test tốt

- Test kiểm tra **hành vi nhìn thấy từ bên ngoài**: status code, body, header, cookie, event socket nhận được hay không nhận được, và dữ liệu trả qua API. Test không kiểm tra cấu trúc nội bộ, không mock module của chính hệ thống, và không đọc DB khi API đã trả lời được câu hỏi đó. Ngoại lệ là seam 3, nơi bản thân DB chính là đầu ra.
- Mỗi mục SEC có **ít nhất một test hồi quy tái hiện đúng bước tấn công** trong audit (A02–A26, B1, B2), viết theo hướng kẻ tấn công. Test phải **fail trên mã hiện tại và pass sau khi sửa**. Tên test ghi kèm mã bước, ví dụ "A09: đăng nhập bằng object operator bị từ chối".
- Ngưỡng rate limit và TTL được ghi đè qua cấu hình để test chạy nhanh. Không `sleep` theo thời gian thật quá vài trăm mili-giây. Chỗ nào cần thời gian thì dùng fake timer hoặc TTL nhỏ.

### Các seam

1. **Server factory (seam chính).** Test dựng server bằng cấu hình test, PGlite in-memory và storage adapter in-memory, listen trên port ngẫu nhiên, rồi gọi REST bằng `supertest` hoặc `fetch` (có gửi `Origin` và cookie như trình duyệt) và socket bằng `socket.io-client`. Seam này bao phủ:
   - Session: register và login đặt cookie đúng cờ; `/me`; logout và logout-all; cookie cũ bị từ chối sau logout; socket bị ngắt khi Session bị thu hồi hoặc hết hạn; socket được khôi phục vẫn bị kiểm tra lại.
   - CSRF và Origin: request thay đổi dữ liệu thiếu hoặc sai `Origin` bị `403`; handshake socket có `Origin` lạ bị từ chối.
   - Validation: A02–A10, room `name`/`description`, payload gửi tin chứa `attachmentUrl`/`type` tự khai (A18–A20), A19 (metadata 200.000 ký tự).
   - Ổn định: A25/A26 (sau payload sai kiểu, server vẫn trả lời `/health`), A07 (không lộ lỗi Prisma), A24 (`413`), lỗi chỉ chứa `requestId`.
   - Attachment: A15–A17 (HTML, SVG, file PHP giả ảnh bị `415`), EXIF bị xóa (upload JPEG có GPS, tải lại qua signed URL thì không còn EXIF), file văn bản phục vụ dưới dạng `text/plain`, Attachment của người khác hoặc đã gắn tin bị từ chối, signed URL hết hạn sau TTL, endpoint làm mới trả `404` cho người ngoài và cho thành viên đã bị kick.
   - Realtime: A21 (rời room thì không nhận tin), B2 (bị kick khi đang offline ngắn, khôi phục kết nối vẫn không nhận tin).
   - Rate limit: A08 (login thứ 11 bị `429` kèm `Retry-After`), A22 (gửi 300 tin thì phần vượt ngưỡng bị `RATE_LIMITED`), cùng các endpoint còn lại.
   - Quyền riêng tư: A11 (`/api/users` không còn email, thiếu `q` thì `400`), DTO của Room Member và partner không có email.
   - Header: `GET /` và `GET /api/...` có CSP đúng chính sách, HSTS, nosniff, `frame-ancestors`, không có `X-Powered-By`, không có `Access-Control-Allow-Origin` (A01, A23).
   - Log: các sự kiện bảo mật được ghi ra một sink log test, và không chứa mật khẩu hay token.
2. **Hàm nạp cấu hình.** Test truyền vào object biến môi trường và kiểm tra cấu hình trả về, hoặc lỗi bị ném ra: thiếu `APP_ORIGIN` hay `DATABASE_URL`; production thiếu secret Supabase; production dùng `STORAGE_PROVIDER=local` hoặc để trống; production thiếu build client; không có giá trị fallback nào. Đây là bản thay cho B1.
3. **Lệnh nâng cấp dữ liệu.** Test dựng PGlite theo schema baseline, nạp dữ liệu rác mô phỏng production (username có CRLF, dài 50.000 ký tự, cặp `alice`/`Alice`; email `Bob@X.io` cùng `bob@x.io`; tin có `attachmentUrl` là `javascript:`, domain lạ và URL hợp lệ của bucket; `attachmentSize` âm; GIF không thuộc Giphy; room có tên quá dài), cùng storage in-memory có cả object được tham chiếu lẫn object mồ côi. Sau đó test áp expand migration, chạy lệnh (thử `--dry-run` trước, xác nhận DB không đổi), rồi áp contract migration. Test kiểm tra:
   - Dữ liệu cuối đúng quy tắc, báo cáo liệt kê đúng các tài khoản bị đổi.
   - Object mồ côi bị xóa còn object được tham chiếu vẫn còn.
   - Chạy lần hai không thay đổi gì (idempotent).
   - Mọi bảng đều bật RLS.
4. **Render toàn bộ client với `fetch` được mock** (React Testing Library và jsdom, như hiện có). Test kiểm tra:
   - Khởi động gọi `/api/auth/me`: nhận `200` thì vào Dashboard, nhận `401` thì vào AuthScreen.
   - `401` giữa chừng đưa về màn đăng nhập.
   - Không có gì được ghi vào localStorage.
   - Request không còn header `Authorization`.
   - "Đăng xuất" và "Đăng xuất mọi thiết bị" gọi đúng endpoint.
   - Tin có URL `javascript:` (Attachment, GIF) không render thành `href`, `src`, iframe hay `window.open`.
   - Hết hạn URL thì client gọi endpoint làm mới đúng một lần.
   - Tin có `attachmentUnavailable` hiển thị đúng thông báo.
   - Input file có `accept` khớp allowlist.
   - Thông báo `RATE_LIMITED` hiển thị thời gian chờ.

### Prior art

- Server: `server/tests/socket-auth.test.ts`, `room-socket.test.ts`, `catchup-sync.test.ts` (dựng server HTTP với Socket.IO trên port ngẫu nhiên, dùng `socket.io-client`); `auth.test.ts`, `upload.test.ts`, `attachment-message.test.ts` (`supertest`); `tests/setup.ts` (PGlite và reset DB trước mỗi test). Các test này sẽ được chuyển sang dùng factory và cookie thay cho `generateToken`/Bearer.
- Client: `App.test.tsx`, `components/auth/AuthScreen.test.tsx`, `components/chat/Attachment.test.tsx`, `components/chat/RichMedia.test.tsx`, `components/common/ReconnectionSync.test.tsx`.
- Không tự động hóa được, nên chỉ có checklist thủ công: hành vi CSP trên trình duyệt thật, các thao tác trên dashboard Supabase, Render và GitHub.

## Out of Scope

- Tính năng đổi mật khẩu, quên mật khẩu và reset qua email (Q28). Hệ thống không gửi mail và không xác minh email.
- Xác thực hai lớp (2FA), CAPTCHA, khóa tài khoản vĩnh viễn sau nhiều lần đăng nhập sai.
- Viết lại lịch sử git để xóa secret cũ (Q3). Secret đã bị vô hiệu nên bản trong lịch sử không còn tác dụng.
- Reset DB production (Q17). Dữ liệu được giữ và chuẩn hóa.
- Domain riêng và deploy tách Vercel/Render. Nếu sau này cần, viết ADR mới thay ADR 0010.
- Nâng cấp Express 5 và Tailwind 4.
- Rate limit dùng store dùng chung (Redis) và scale ngang.
- Kiểm tra membership trước mỗi lần broadcast (Q10).
- Dịch vụ monitoring hoặc cảnh báo trả phí. Monitor chống cold start chỉ là tùy chọn trong runbook.
- Quét virus hoặc malware cho nội dung file upload (ngoài việc kiểm tra loại file).
- Tính năng ảnh đại diện tải lên.
- Hỗ trợ Vercel preview deploy.

## Further Notes

- **Production chưa có người dùng thật**, nên không cần thông báo sự cố. Cho tới khi phần Session được deploy, production vẫn ký token bằng `JWT_SECRET` đã lộ. Rủi ro này được chấp nhận, và người vận hành có thể đổi giá trị trên Render bất cứ lúc nào để chặn sớm.
- **DB production nằm trên chính project Supabase có key bị lộ, và chưa bật RLS** (Q38). Vì vậy dữ liệu hiện có có thể đã bị đọc hoặc bị chèn thêm, ví dụ tài khoản do người lạ tạo. Lệnh nâng cấp dữ liệu không phát hiện được các dòng do người lạ chèn vào. Rủi ro này được chấp nhận vì dữ liệu hiện chỉ là dữ liệu rác.
- **Thứ tự phụ thuộc** cần tôn trọng khi chia ticket. Việc chia ticket sẽ bàn sau (Q35).
  - Factory và module cấu hình là nền cho mọi test.
  - Prisma Migrate baseline phải có trước mọi thay đổi schema.
  - Lớp lỗi phải có trước validation và rate limit.
  - Bản ghi Attachment phải có trước bucket private.
  - Session cookie và Origin check nên đi cùng nhau, vì thiếu Origin check thì cookie mở ra rủi ro CSRF.
- Các thông báo validate mới ở màn đăng ký và đăng nhập phải tuân thủ **Zero-Shift Auth Architecture**: nằm gọn trong khung form cố định hiện có, không làm xê dịch layout.
- Message Character Limit (spec `message-character-limit`, user story 17) chỉ thực sự có hiệu lực khi phần Attachment của spec này hoàn tất. Hiện tại metadata của Attachment vẫn là đường vượt qua giới hạn đó.
