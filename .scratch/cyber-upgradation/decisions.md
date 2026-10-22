# Nhật ký quyết định: Cyber Upgradation

Ghi lại kết quả buổi grill ngày 2026-10-22 về giải pháp cho các lỗi trong [`../security-audit/spec.md`](../security-audit/spec.md). File này **không phải spec**. Spec và ticket sẽ được viết sau khi chốt.

## Bối cảnh

- Production **chưa có người dùng thật**. DB production chỉ chứa dữ liệu rác, nhưng vẫn **giữ lại**, không reset.
- Không có domain riêng.
- Production thật chạy **single-host** tại `https://webchat-realtime.onrender.com`. Render phục vụ cả SPA lẫn API, và không có bản deploy Vercel nào.

## Quyết định đã chốt

| # | Chủ đề | Quyết định | SEC |
|---|---|---|---|
| Q1 | Nơi lưu tài liệu | `.scratch/cyber-upgradation/`: `spec.md` mới về việc sửa lỗi, sau đó là các ticket trong `issues/`. `security-audit/spec.md` giữ nguyên, chỉ mô tả lỗi | – |
| Q2 | Mức khẩn cấp | Production không có người dùng, nên đây không phải sự cố đang diễn ra. Không cần thông báo cho người dùng | 01 |
| Q3 | Secret đã lộ | Xoay vòng các key Supabase (`JWT_SECRET` bị gỡ hẳn theo Q43), chuyển `render.yaml` sang `sync: false`, bật secret scanning, push protection và gitleaks. **Không** viết lại lịch sử git | 01 |
| Q4 | Topology | ~~Vercel + Render~~ → **chốt lại ở Q4′: single-host trên Render** (`webchat-realtime.onrender.com`). App và API chung origin | 10, 11, 12 |
| Q5 | Storage `local` | Production bắt buộc dùng Supabase, server từ chối khởi động nếu dùng `local` hoặc để trống. `local` chỉ cho dev/test, phục vụ kèm `Content-Disposition: attachment` và `nosniff` | 04, 15 |
| Q6 | Quyền riêng tư của Attachment | Bucket private, signed URL có hạn. Tin nhắn lưu storage key, không lưu URL | 03, 15 |
| Q7 | Nạp cấu hình | `config.ts` có validate, nạp đầu tiên qua `dotenv/config`. Fail-fast ở **mọi** môi trường khi thiếu biến bắt buộc. Không có fallback hardcode. `JWT_SECRET` không còn tồn tại (Q43) | 02 |
| Q8 | Validation | Dùng zod, đặt schema trong `shared/`, áp cho mọi body REST và payload socket | 05, 08, 14 |
| Q9 | Lỗi async và che lỗi | Giữ Express 4, dùng `asyncHandler` cho route và wrapper cho socket. Thông báo lỗi chung kèm `requestId`, trả 400/413 đúng, log `unhandledRejection`. Nâng Express 5 để sau | 05, 09 |
| Q10 | Quyền realtime trong room | `leaveRoom` gọi sync, `skipMiddlewares: false`, đối chiếu socket room với `RoomMember` khi `socket.recovered`. Không kiểm tra membership trước mỗi broadcast | 06 |
| Q11 | Hạ tầng rate limit | In-memory (single instance), chưa dùng Redis | 07 |
| Q12 | Email trong DTO | `PublicUserDto` không có email, email chỉ trả ở `/api/auth/me`. Tìm kiếm chỉ theo `username`. `/api/users` bắt buộc có `q` và giới hạn số kết quả | 13 |
| Q13 | Nhóm Low | Làm mức tối thiểu: cập nhật dependency, logger `pino` cho sự kiện auth và quản trị, `SECURITY.md` cùng runbook sự cố. Không dùng monitoring trả phí | 16, 17, 18 |
| Q14 | Hotfix | Không làm nhánh hotfix riêng. Xoay vòng secret và sửa SEC-01/02 vẫn bắt buộc, nằm trong kế hoạch chính | 01, 02 |
| Q15 | Bản ghi Attachment | Lúc upload, server tạo bản ghi Attachment (`uploaderId`, `storageKey`, MIME do server phát hiện, `size`, tên gốc). Client gửi `attachmentId`, server kiểm tra người gửi là người upload và Attachment chưa gắn vào tin nào. Mỗi Attachment gắn vào đúng một tin | 03, 14 |
| Q16 | Signed URL | Ký lúc trả lịch sử hoặc broadcast, TTL 1 giờ. Client làm mới qua `GET /api/attachments/:id/url` (có kiểm tra participant/member) khi URL hết hạn | 15 |
| Q17 | Dữ liệu hiện có | **Giữ DB hiện tại**, không reset | – |
| Q18 | Quy tắc tài khoản | `username` 3–32 ký tự `[a-zA-Z0-9_.]`, unique không phân biệt hoa thường. `password` 8–72 byte. `email` đúng định dạng, lưu chữ thường, không xác minh | 08 |
| Q19 | `avatarUrl` | Xóa cột khỏi `User` và khỏi DTO. Avatar luôn là Deterministic 4-Color Avatar | 08 |
| Q20 | Loại file upload | Allowlist ảnh `jpeg/png/gif/webp` và tài liệu `pdf/docx/xlsx/pptx/txt`. Phát hiện bằng magic bytes, từ chối SVG và HTML, server tự đặt `Content-Type`. Xóa EXIF bằng cách re-encode qua `sharp`, GIF động giữ nguyên | 04, 15 |
| Q21 | Ngưỡng rate limit | Login 10 lần sai / 15 phút theo IP + username. Register 5 / giờ / IP. Upload 20 / 10 phút / user. Gửi tin 10 / 10 giây / user. Typing 1 / giây. Bật `trust proxy`. `maxHttpBufferSize` 64KB | 07 |
| Q22 | GIF và URL ở client | `EMOJI_GIF` chỉ nhận `https` thuộc host Giphy. Client có helper `safeUrl()` chỉ cho phép `https:` và `blob:` | 03 |
| Q23 | Domain riêng | Không có | – |
| Q24 | Mô hình session | Bảng Session, mỗi request kiểm tra session (định danh session bằng token ngẫu nhiên theo Q43, không dùng JWT). Logout thu hồi session hiện tại, có thêm "đăng xuất mọi thiết bị". Hết hạn 7 ngày không hoạt động, tối đa 30 ngày. Ngắt socket khi session bị thu hồi hoặc hết hạn | 11 |
| Q25 | Lưu token | ~~localStorage~~ → thay bằng Q43–Q46 (cookie `HttpOnly`) | 11 |
| Q26 | CORS | ~~Allowlist~~ → thay bằng Q47 | 12 |
| Q27 | CSP và header | ~~Vercel + helmet~~ → thay bằng Q48. Nguyên tắc giữ nguyên: CSP chặt, bật chặn thật ngay, bỏ `X-Powered-By`, `X-XSS-Protection: 0` | 10 |
| Q28 | Đổi mật khẩu | **Không làm**. Runbook dùng "đăng xuất mọi thiết bị" thay thế | – |
| Q29 | Test | Mỗi SEC có test hồi quy tái hiện bước tấn công trong audit: fail trước khi sửa, pass sau khi sửa. Phần trình duyệt dùng unit test cho `safeUrl()` cộng checklist thủ công | – |
| Q30 | ADR | ADR 0009 (Attachment riêng tư qua bản ghi, bucket private và signed URL, thay một phần ADR 0004) và ADR 0010 (~~Bearer token trong localStorage~~ → single-host trên Render và session cookie `HttpOnly`, thay một phần ADR 0002). Viết cùng lúc với spec | – |
| Q31 | Thay đổi schema | Chuyển sang Prisma Migrate: tạo `0_baseline` rồi `migrate resolve --applied` trên production, deploy bằng `migrate deploy`. `schema.sql` cho PGlite sinh tự động bằng `migrate diff` | – |
| Q32 | Tin nhắn cũ có đính kèm | URL thuộc bucket thì tạo bản ghi Attachment. URL khác thì gỡ phần đính kèm, giữ `content`. `EMOJI_GIF` không thuộc host Giphy thì chuyển thành `TEXT` | 03, 14 |
| Q33 | Tài khoản cũ vi phạm quy tắc | Đổi tên username vi phạm thành `user_<6 ký tự đầu của id>`. Cặp trùng không phân biệt hoa thường thì giữ tài khoản tạo trước. Email chuyển chữ thường, email trùng thêm `+dup<n>`. Migration in danh sách tài khoản bị đổi | 08 |
| Q34 | Dọn bucket | Xóa object không được bản ghi Attachment nào tham chiếu, rồi chuyển bucket sang private | 01, 15 |
| Q35 | Chia ticket | **Hoãn**, chưa bàn | – |
| Q36 | Mở rộng allowlist ở Q20 | Giữ thêm `csv/md/json` (kiểm tra là UTF-8 hợp lệ, không có NUL, luôn phục vụ dạng `text/plain`) và `doc/xls/ppt` (chữ ký OLE). Bỏ `zip/xml/rtf`. Input ở client có `accept` khớp allowlist | 04, 15 |
| Q37 | Tailwind v3 chưa có bản vá | Chấp nhận rủi ro và ghi lại (DoS lúc build, đầu vào là mã nguồn của dự án). Nâng lên Tailwind 4 tách thành việc riêng. Prisma nâng trong cùng major (7.10.1) nếu bản đó có vá | 16 |
| Q38 | Vị trí DB production | **Có**: `DATABASE_URL` production nằm trên chính project Supabase có key bị lộ. Key `service_role` (và có thể cả `anon`) đã mở được các bảng Prisma qua Data API | 01 |
| Q39 | Tên và mô tả room | `name` 1–64 ký tự, `description` tối đa 500 ký tự, cắt khoảng trắng hai đầu, từ chối ký tự điều khiển. Room cũ vi phạm được cắt bớt trong migration | 08 |
| Q42 | Khóa Data API | Tắt Data API của Supabase (nếu không tắt hẳn được thì bỏ `public` khỏi danh sách schema được expose), và thêm migration bật RLS không có policy trên mọi bảng. Kiểm tra: `GET /rest/v1/User` phải trả lỗi hoặc danh sách rỗng | 01 |
| Q4′ | Chốt lại topology | **(b) Single-host trên Render.** Không dùng Vercel | 10, 11, 12 |
| Q49 | Cold start | Chấp nhận cold start của Render free. Monitor ping `/health` (ví dụ UptimeRobot) chỉ ghi trong runbook như một tùy chọn | – |
| Q43 | Session token | Bỏ JWT, gỡ `jsonwebtoken` và `JWT_SECRET`. Cookie `__Host-session` chứa chuỗi ngẫu nhiên 32 byte, DB chỉ lưu SHA-256 của chuỗi đó. Thuộc tính `HttpOnly; Secure; SameSite=Strict; Path=/`, `Max-Age` 30 ngày | 01, 02, 11 |
| Q44 | Chống CSRF | `SameSite=Strict`, cộng kiểm tra `Origin` đúng origin của app cho mọi `POST/PATCH/PUT/DELETE`. Thiếu `Origin` thì yêu cầu `Sec-Fetch-Site: same-origin`. Thiếu cả hai thì `403`. Không dùng CSRF token | 11 |
| Q45 | Xác thực socket | Session đọc từ cookie, bỏ `handshake.auth.token`, kiểm tra `Origin` của handshake. Socket gom vào room `session:<id>` và bị ngắt khi logout, thu hồi hoặc hết hạn | 06, 11 |
| Q46 | Trạng thái đăng nhập ở client | Khởi động bằng `GET /api/auth/me`. Xóa token và user khỏi localStorage, bỏ mọi header `Bearer`. Logout gọi `POST /api/auth/logout` để thu hồi session và xóa cookie. Gặp `401` thì quay về màn đăng nhập | 11 |
| Q47 | CORS | Gỡ hẳn middleware `cors` trên REST và `origin: '*'` trên Socket.IO. Không có `CORS_ORIGINS`. Dev dùng proxy Vite sẵn có | 12 |
| Q48 | CSP và header | Tất cả cấu hình bằng `helmet` trên Express, áp cho cả SPA lẫn API. CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: <supabase> https://*.giphy.com; connect-src 'self' <supabase>; frame-src <supabase>; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, với host Supabase lấy từ `SUPABASE_URL`. Kèm HSTS, nosniff, Referrer-Policy, Permissions-Policy, `X-XSS-Protection: 0`, bỏ `X-Powered-By`. Xóa `vercel.json`, `VITE_API_URL`, `VITE_SOCKET_URL`. Production bắt buộc phục vụ SPA, thiếu `client/dist` thì không khởi động | 10 |
| Q40 | Rate limit bổ sung | `/api/users` 30 / phút / user, `/api/gifs` 30 / phút / user, tạo room 10 / giờ / user. Vượt ngưỡng trả `429` kèm `Retry-After` (áp dụng cho cả Q21) | 07 |

## Ghi chú

- Cho tới khi Q43 được deploy, production vẫn ký token bằng `JWT_SECRET` đã lộ. Vì chưa có người dùng, rủi ro này được chấp nhận. Bạn có thể đổi giá trị trên Render bất cứ lúc nào để chặn sớm hơn.

## Câu hỏi còn mở

Không còn. Phần grill hoàn tất ngày 2026-10-23. Bước tiếp theo là viết `spec.md`, ADR 0009, ADR 0010, sau đó là các ticket (Q35).
