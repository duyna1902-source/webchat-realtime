# Security Checklist: webchat-realtime

Nguồn: [FallibleInc/security-guide-for-developers — security-checklist.md](https://github.com/FallibleInc/security-guide-for-developers/blob/master/security-checklist.md)

Ngày kiểm tra: 2026-10-22 · Nhánh: `feat/message-character-limit` @ `4c205d7`

Chi tiết từng lỗi (bằng chứng, cách tái hiện, tác động) nằm trong [`spec.md`](./spec.md), tham chiếu bằng mã `SEC-xx`.

## Phương pháp kiểm tra

- **Đọc mã tĩnh:** toàn bộ `server/src`, `client/src` (các điểm render URL hoặc nội dung do người dùng gửi), cấu hình deploy (`render.yaml`, `vercel.json`), `.env.example` và lịch sử git.
- **Test động:** chạy backend cục bộ với PGlite in-memory, `STORAGE_PROVIDER=local` và `NODE_ENV=production`, ở một thư mục tách biệt để không nạp `.env` thật. Sau đó chạy script tấn công thử qua REST và Socket.IO. Mã `A01`–`A26` và `B1`–`B2` trong spec là ID của từng bước test.
- **`npm audit`** trên toàn bộ workspace.
- **Không** dùng các secret bị lộ để truy cập hạ tầng thật (Supabase, Render).

## Chú giải

| Ký hiệu | Ý nghĩa |
|---|---|
| ✅ PASS | Đạt yêu cầu |
| ❌ FAIL | Không đạt. Xem mã `SEC-xx` trong spec |
| ➖ N/A | Tính năng không tồn tại trong dự án nên không áp dụng |
| ⚠️ CHƯA XÁC MINH | Phụ thuộc hạ tầng hoặc quy trình bên ngoài repo, không kiểm chứng được từ mã nguồn |

---

## 1. Authentication (signup / signin / 2FA / password reset)

| # | Hạng mục | Kết quả | Ghi chú / Bằng chứng |
|---|---|---|---|
| 1.1 | Dùng HTTPS ở mọi nơi | ⚠️ CHƯA XÁC MINH | Render/Vercel cấp TLS ở tầng platform. App không tự ép HTTPS và không có HSTS (SEC-10) |
| 1.2 | Hash mật khẩu bằng bcrypt (có salt) | ✅ PASS | `bcryptjs`, cost 10 (`server/src/controllers/auth.controller.ts:50`) |
| 1.3 | Hủy session ID khi logout | ❌ FAIL | Logout chỉ xóa localStorage. JWT vẫn còn hiệu lực đủ 7 ngày → **SEC-11** |
| 1.4 | Hủy mọi session khi reset mật khẩu | ➖ N/A | Không có tính năng reset hoặc đổi mật khẩu. Hệ thống cũng không có cơ chế thu hồi session nào (SEC-11) |
| 1.5 | Dùng tham số `state` trong OAuth2 | ➖ N/A | Không dùng OAuth |
| 1.6 | Không có open redirect | ✅ PASS | Server không có endpoint redirect nào |
| 1.7 | Sanitize input signup/login (scheme nguy hiểm, CRLF) | ❌ FAIL | Chấp nhận username chứa CRLF, dài 50.000 ký tự, email sai định dạng, `avatarUrl=javascript:`, và cả object (operator injection) → **SEC-08** |
| 1.8 | Cookie đặt cờ `Secure` + `HttpOnly` | ➖ N/A | Không dùng cookie. Token lưu ở localStorage nên JavaScript đọc được (liên quan SEC-03, SEC-04, SEC-11) |
| 1.9 | Không trả OTP trong response | ➖ N/A | Không có OTP |
| 1.10 | Rate-limit login / OTP / resend (backoff, CAPTCHA) | ❌ FAIL | 60 lần login sai liên tiếp đều trả 401, không bị chặn → **SEC-07** |
| 1.11 | Reset token ngẫu nhiên, có hạn, dùng một lần | ➖ N/A | Không có tính năng reset mật khẩu |

## 2. User Data & Authorization

| # | Hạng mục | Kết quả | Ghi chú / Bằng chứng |
|---|---|---|---|
| 2.1 | Kiểm tra quyền sở hữu tài nguyên theo session | ❌ FAIL | REST có kiểm tra participant/member. **Nhưng** Socket.IO vẫn đẩy tin nhắn room cho user đã rời room hoặc bị kick → **SEC-06** |
| 2.2 | Không dùng ID tuần tự trong URL, ưu tiên `/me/...` | ✅ PASS | Dùng UUID. Danh sách chat/room được lọc theo user trong JWT |
| 2.3 | Xác minh khi đổi email/SĐT | ➖ N/A | Không có tính năng đổi email. Lúc đăng ký cũng không xác minh email (SEC-08) |
| 2.4 | Sanitize tên file upload, lưu trên object storage tách khỏi app server | ❌ FAIL | Tên file có sanitize, nhưng ở chế độ mặc định (`local`) file được lưu và phục vụ **cùng origin với app**. Upload HTML/SVG đều chạy được → **SEC-04**, **SEC-15** |
| 2.5 | Xóa EXIF khỏi ảnh | ❌ FAIL | Ảnh được lưu nguyên bản, không xử lý gì → **SEC-15** |
| 2.6 | Dùng UUID thay vì số nguyên | ✅ PASS | Mọi model dùng `@default(uuid())` (`server/prisma/schema.prisma`) |
| 2.7 | Dùng JWT cho SPA/API (đúng cách) | ❌ FAIL | Có dùng JWT, nhưng secret bị commit công khai, có secret mặc định hardcode, và `.env` bị bỏ qua do thứ tự load → **SEC-01**, **SEC-02** |
| 2.x | *(bổ sung)* Không lộ PII của user khác | ❌ FAIL | `GET /api/users` trả email của toàn bộ user → **SEC-13** |

## 3. Android / iOS Apps

| # | Hạng mục | Kết quả | Ghi chú |
|---|---|---|---|
| 3.1–3.5 | Hardcode secret trong app, server-to-server call, permission, Keychain, cert pinning | ➖ N/A | Dự án không có app mobile (chỉ có responsive web) |
| 3.x | *(áp dụng tinh thần 3.1 cho web/repo)* Không hardcode secret của SDK bên thứ ba | ❌ FAIL | Supabase service-role key, anon key và JWT secret nằm trong `render.yaml` của repo public → **SEC-01** |

## 4. Security Headers & Configuration

| # | Hạng mục | Kết quả | Ghi chú / Bằng chứng |
|---|---|---|---|
| 4.1 | Content-Security-Policy | ❌ FAIL | Không có header CSP, ở cả Express lẫn `vercel.json` → **SEC-10** |
| 4.2 | CSRF protection + SameSite cookie | ✅ PASS | Xác thực bằng header `Authorization: Bearer`, không dùng cookie, nên không bị CSRF kiểu cổ điển |
| 4.3 | HSTS (+ preload) | ❌ FAIL | App không gửi `Strict-Transport-Security` → **SEC-10** |
| 4.4 | X-Frame-Options | ❌ FAIL | Không có, nên trang có thể bị nhúng iframe (clickjacking) → **SEC-10** |
| 4.5 | X-XSS-Protection | ❌ FAIL | Không có (header này đã lỗi thời trên trình duyệt hiện đại). Đáng chú ý hơn là thiếu `X-Content-Type-Options: nosniff` → **SEC-10** |
| 4.6 | SPF record | ➖ N/A | Hệ thống không gửi email |
| 4.7 | Subresource Integrity cho script bên thứ ba | ✅ PASS | `client/index.html` không nạp script nào từ CDN bên ngoài |
| 4.8 | CSRF token ngẫu nhiên, hành động nghiệp vụ dùng POST | ✅ PASS | Các hành động thay đổi dữ liệu dùng POST/PATCH/DELETE hoặc socket event. Không áp dụng CSRF token vì không dùng cookie |
| 4.9 | Không đặt dữ liệu nhạy cảm hoặc token trong GET param | ✅ PASS | Token đi qua header hoặc `handshake.auth` của socket, không nằm trong query string |
| 4.x | *(bổ sung)* Không để CORS wildcard | ❌ FAIL | `Access-Control-Allow-Origin: *` trên cả REST lẫn Socket.IO → **SEC-12** |
| 4.x | *(bổ sung)* Không lộ `X-Powered-By` | ❌ FAIL | Response có `X-Powered-By: Express` → **SEC-10** |

## 5. Input Sanitization

| # | Hạng mục | Kết quả | Ghi chú / Bằng chứng |
|---|---|---|---|
| 5.1 | Sanitize input/output chống XSS | ❌ FAIL | Text thường được React escape (đạt), **nhưng** URL trong `attachmentUrl` (scheme `javascript:`) được render vào `href`/`iframe src` → **SEC-03**. File HTML/SVG upload chạy được trên origin của app → **SEC-04** |
| 5.2 | Parameterized query chống SQL injection | ✅ PASS | Prisma parameterize toàn bộ. `$executeRawUnsafe` chỉ chạy chuỗi hằng trong `resetDatabase()` |
| 5.x | *(bổ sung)* Chống operator/type injection vào ORM | ❌ FAIL | Login với `emailOrUsername: {"contains":"b"}` vẫn đăng nhập thành công → **SEC-08** |
| 5.3 | Sanitize input dùng cho CSV import | ➖ N/A | Không có tính năng import CSV |
| 5.4 | Sanitize tên profile dùng trong URL path (tên reserved) | ➖ N/A | Username không xuất hiện trong URL path. Tuy nhiên username chấp nhận ký tự điều khiển (SEC-08) |
| 5.5 | Không tự nối chuỗi để tạo JSON | ✅ PASS | Luôn dùng `res.json()` hoặc `JSON.stringify` |
| 5.6 | Validate URL input chống SSRF | ✅ PASS | Server không fetch URL do user cung cấp (chỉ gọi Giphy/Cloudinary/Supabase với host cố định). URL do user gửi chỉ được trình duyệt dùng, xem SEC-03 |
| 5.x | *(bổ sung)* Giới hạn độ dài hoặc kiểu cho mọi field | ❌ FAIL | `attachmentName`/`attachmentUrl` dài 200.000 ký tự vẫn được chấp nhận, vượt qua giới hạn 4000 ký tự. `attachmentSize` âm cũng được chấp nhận → **SEC-14** |

## 6. Operations

| # | Hạng mục | Kết quả | Ghi chú / Bằng chứng |
|---|---|---|---|
| 6.1 | Dùng PaaS nếu team nhỏ | ✅ PASS | Render (backend) và Vercel (frontend) |
| 6.2 | Script provisioning tự động | ✅ PASS | `render.yaml` và `vercel.json` (IaC) |
| 6.3 | Audit port mở ngoài ý muốn | ➖ N/A | PaaS chỉ expose `PORT` |
| 6.4 | Đổi mật khẩu mặc định của DB | ⚠️ CHƯA XÁC MINH | `DATABASE_URL` production đặt `sync: false` (không nằm trong repo). `postgres:postgres` chỉ xuất hiện trong `.env.example` cho môi trường local |
| 6.5 | SSH key thay cho password | ➖ N/A | Không quản lý VM |
| 6.6 | Cập nhật bản vá kịp thời | ❌ FAIL | `npm audit`: 11 lỗ hổng (9 high, 2 moderate) → **SEC-16** |
| 6.7 | Bắt buộc TLS ≥ 1.2 | ⚠️ CHƯA XÁC MINH | Do Render/Vercel quyết định |
| 6.8 | Tắt debug mode ở production | ❌ FAIL | `NODE_ENV=production` có được đặt, nhưng error handler vẫn trả `err.message` gốc (lộ cấu trúc query Prisma) → **SEC-09** |
| 6.9 | Chống DDoS | ❌ FAIL | Không rate-limit (SEC-07). **Một request** của user đã đăng nhập đủ làm sập process → **SEC-05** |
| 6.10 | Monitoring & logging | ❌ FAIL | Chỉ có `console.*`. Không có audit log cho sự kiện auth, không có cảnh báo → **SEC-17** |
| 6.11 | Mã hóa dữ liệu lúc lưu trữ (at rest) | ⚠️ CHƯA XÁC MINH | Phụ thuộc nhà cung cấp Postgres/Supabase. Ở chế độ `local`, file nằm trên đĩa của container Render, không được mã hóa |

## 7. People

| # | Hạng mục | Kết quả | Ghi chú |
|---|---|---|---|
| 7.1 | Có kênh liên hệ bảo mật / trang báo cáo lỗ hổng | ❌ FAIL | Không có `SECURITY.md`, README cũng không nhắc tới → **SEC-18** |
| 7.2 | Giới hạn quyền truy cập DB người dùng | ❌ FAIL | Service-role key của Supabase (quyền cao nhất, bỏ qua RLS) nằm công khai trên GitHub → **SEC-01** |
| 7.3 | Lịch sự với người báo lỗi | ➖ N/A | Quy trình con người |
| 7.4 | Code review bảo mật bởi người khác | ✅ PASS | Repo có quy trình code review (commit `091ea67 fix(review): ...`, skill `code-review`) |
| 7.5 | Quy trình xử lý khi bị xâm nhập (xem log, yêu cầu reset mật khẩu) | ❌ FAIL | Không có tài liệu. Hệ thống cũng không có tính năng đổi/reset mật khẩu hay thu hồi session để thực hiện quy trình này → **SEC-11**, **SEC-18** |
| 7.6 | Theo dõi nhắc đến tổ chức trên mạng | ➖ N/A | Ngoài phạm vi repo |

---

## Tổng kết

| Kết quả | Số hạng mục |
|---|---|
| ✅ PASS | 14 |
| ❌ FAIL | 25 |
| ➖ N/A | 14 |
| ⚠️ CHƯA XÁC MINH | 4 |

Có 18 lỗi riêng biệt (`SEC-01` → `SEC-18`): **2 Critical, 5 High, 7 Medium, 4 Low**. Xem [`spec.md`](./spec.md).
