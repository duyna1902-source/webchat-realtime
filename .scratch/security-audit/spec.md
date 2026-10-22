# Spec: Security Audit Findings (theo FallibleInc Security Checklist)

Status: needs-triage

Ngày kiểm tra: 2026-10-22 · Nhánh: `feat/message-character-limit` @ `4c205d7`
Checklist đối chiếu: [`checklist.md`](./checklist.md)

> Tài liệu này **chỉ mô tả lỗi**: vị trí, bằng chứng, cách tái hiện, tác động và phạm vi. Tài liệu cố ý **không** đưa ra giải pháp sửa.
>
> Giá trị thật của các secret bị lộ **không** được chép lại ở đây. Tài liệu chỉ tham chiếu tới file và dòng chứa chúng.

## Tổng quan

| Mã | Mức độ | Tiêu đề | Hạng mục checklist |
|---|---|---|---|
| [SEC-01](#sec-01) | 🔴 Critical | Secret production (JWT secret, Supabase service-role key) bị commit vào repo GitHub **public** | 2.7, 3.x, 7.2 |
| [SEC-02](#sec-02) | 🔴 Critical | JWT secret mặc định hardcode, và `JWT_SECRET` trong `.env` bị bỏ qua do thứ tự import | 2.7 |
| [SEC-03](#sec-03) | 🟠 High | Stored XSS qua `attachmentUrl` / GIF URL (`javascript:`) trong tin nhắn | 5.1 |
| [SEC-04](#sec-04) | 🟠 High | Stored XSS qua file upload HTML/SVG được phục vụ cùng origin | 2.4, 5.1 |
| [SEC-05](#sec-05) | 🟠 High | Một request sai kiểu dữ liệu làm sập toàn bộ server (unhandled async error) | 6.9 |
| [SEC-06](#sec-06) | 🟠 High | User đã rời hoặc bị kick khỏi room vẫn nhận tin nhắn real-time | 2.1 |
| [SEC-07](#sec-07) | 🟠 High | Không có rate limiting cho login, register, upload và socket event | 1.10, 6.9 |
| [SEC-08](#sec-08) | 🟡 Medium | Thiếu validate đầu vào ở đăng ký/đăng nhập (operator injection, CRLF, mật khẩu yếu, email sai) | 1.7, 5.x |
| [SEC-09](#sec-09) | 🟡 Medium | Lộ thông tin nội bộ qua thông báo lỗi | 6.8 |
| [SEC-10](#sec-10) | 🟡 Medium | Thiếu toàn bộ security header (CSP, HSTS, X-Frame-Options, nosniff, …) | 4.1, 4.3, 4.4, 4.5 |
| [SEC-11](#sec-11) | 🟡 Medium | Quản lý session: JWT sống 7 ngày, không thu hồi được, logout chỉ ở client, token nằm trong localStorage | 1.3, 1.4, 7.5 |
| [SEC-13](#sec-13) | 🟡 Medium | `GET /api/users` lộ email của toàn bộ người dùng | 2.x |
| [SEC-14](#sec-14) | 🟡 Medium | Metadata đính kèm không bị giới hạn, vượt qua anti-spam character limit | 5.x |
| [SEC-15](#sec-15) | 🟡 Medium | Upload: tin MIME từ client, file đính kèm riêng tư truy cập công khai, không xóa EXIF | 2.4, 2.5 |
| [SEC-12](#sec-12) | 🔵 Low | CORS wildcard `*` trên REST và Socket.IO | 4.x |
| [SEC-16](#sec-16) | 🔵 Low | Dependency có lỗ hổng đã công bố (9 high, 2 moderate) | 6.6 |
| [SEC-17](#sec-17) | 🔵 Low | Không có logging bảo mật hay monitoring | 6.10 |
| [SEC-18](#sec-18) | 🔵 Low | Không có chính sách công bố lỗ hổng hay quy trình xử lý sự cố | 7.1, 7.5 |

### Môi trường test động

- Backend chạy bằng `tsx server/src/index.ts`, với `NODE_ENV=production`, `DATABASE_URL=memory:` (PGlite) và `STORAGE_PROVIDER=local`. Thư mục làm việc tách khỏi repo, nên `server/.env` thật không được nạp.
- Script test gọi REST bằng `fetch` và Socket.IO bằng `socket.io-client` (cùng phiên bản trong repo).
- Phiên bản: Node 24.19.0, Express 4.22.3, Socket.IO 4.8.4, jsonwebtoken 9.0.3, React 18.3.1.
- Mã `Axx`/`Bx` là ID của từng bước test. Output được trích nguyên văn khi cần.

---

## 🔴 Critical

<a id="sec-01"></a>
### SEC-01: Secret production bị commit vào repo GitHub public

**Hạng mục checklist:** 2.7 (dùng JWT đúng cách), 3.1 (không hardcode secret của SDK bên thứ ba), 7.2 (giới hạn quyền truy cập DB)

**Vị trí:**
- `render.yaml:17-18`: `JWT_SECRET` được ghi trực tiếp dưới dạng `value:` (chuỗi bắt đầu bằng `webchat_jwt_secret_production_key_…`).
- `render.yaml:21-22`: `SUPABASE_URL` (để lộ project ref `dpxpgpjblbapivaijwoo`).
- `render.yaml:23-24`: `SUPABASE_ANON_KEY`, là JWT với claim `role: anon`.
- `render.yaml:25-26`: `SUPABASE_SERVICE_ROLE_KEY`, là JWT với claim `role: service_role` và `exp: 2107594610` (khoảng năm 2036).
- Đã có trong lịch sử git từ commit `25121a1 feat(deploy): configure cross-domain deployment, static serving, and cloud configs`.

**Mô tả:**
`render.yaml` là blueprint deploy của Render và được commit vào repo. Thay vì đặt `sync: false` như `DATABASE_URL` (dòng 15-16), ba secret quan trọng nhất lại được ghi thẳng giá trị thật. Repo `github.com/duyna1902-source/webchat-realtime` là **public**: gọi `GET https://api.github.com/repos/duyna1902-source/webchat-realtime` không cần xác thực vẫn trả HTTP 200.

**Bằng chứng:**
- Nội dung file `render.yaml` hiện tại.
- `git log --all -S "SERVICE_ROLE_KEY" -- render.yaml` trả về commit `25121a1`.
- Payload của hai key Supabase decode ra `"role":"anon"` và `"role":"service_role"`.

**Tác động:**
1. **Giả mạo danh tính bất kỳ user nào trên production.** Server ký và kiểm tra token chỉ bằng `JWT_SECRET` (`server/src/lib/jwt.ts:11-17`), và payload chỉ gồm `{ userId, username }`. Ai có secret này đều tự ký được token cho mọi `userId` (UUID của user khác lấy được qua `GET /api/users`, xem SEC-13). Từ đó đọc toàn bộ tin nhắn riêng, gửi tin dưới danh nghĩa người khác, xóa room với tư cách owner. Bước A12 và B1 đã chứng minh: token tự ký bằng đúng secret mà server dùng được `/api/auth/me` chấp nhận (HTTP 200).
2. **Toàn quyền trên project Supabase.** Key `service_role` bỏ qua Row Level Security. Người có key có thể đọc, ghi, xóa mọi object trong Storage (bucket `attachments` chứa ảnh và tài liệu của mọi cuộc trò chuyện). Nếu Postgres production cũng nằm trên Supabase thì có thể truy cập cả bảng dữ liệu qua REST API của Supabase.
3. Xóa file hoặc sửa commit bây giờ cũng **không thu hồi được** việc lộ, vì secret vẫn còn trong lịch sử git và có thể đã bị bot quét secret trên GitHub thu thập.

**Phạm vi:** toàn bộ dữ liệu và tài khoản trên môi trường production deploy bằng `render.yaml`.

**Ghi chú:** Trong quá trình audit, các key **không** được dùng để truy cập hạ tầng thật. Mức tác động ở trên được suy ra từ claim trong key và từ mã nguồn.

---

<a id="sec-02"></a>
### SEC-02: JWT secret mặc định hardcode, và `JWT_SECRET` trong `.env` bị bỏ qua

**Hạng mục checklist:** 2.7

**Vị trí:**
- `server/src/lib/jwt.ts:8`: `const JWT_SECRET = process.env.JWT_SECRET || 'webchat-realtime-default-secret-key-32-chars';`
- `server/src/index.ts:1-7`: `import { app } from './app.js'` (dòng 3) đứng **trước** `dotenv.config()` (dòng 7).

**Mô tả:**
Có hai lỗi chồng lên nhau:
1. **Fallback hardcode.** Khi biến môi trường `JWT_SECRET` không có, server lặng lẽ dùng một chuỗi cố định nằm trong mã nguồn public. Server không báo lỗi hay cảnh báo gì.
2. **Sai thứ tự nạp `.env`.** Dự án dùng ES modules (`"type": "module"`), nên mọi `import` được hoist và chạy trước thân module. Khi `index.ts` chạy, `app.js` được nạp trước, kéo theo `routes` → `auth.middleware` → `lib/jwt.ts`. `jwt.ts` đọc `process.env.JWT_SECRET` ngay ở top-level, **trước khi** `dotenv.config()` ở `index.ts:7` kịp chạy. Hậu quả: giá trị `JWT_SECRET` trong file `.env` **không bao giờ được dùng**, và server luôn rơi về secret mặc định.

**Tái hiện (B1):**
1. Tạo thư mục trống chứa file `.env` gồm đúng một dòng `JWT_SECRET=from-dotenv-file-secret`.
2. Từ thư mục đó, khởi động server mà không đặt biến môi trường `JWT_SECRET`.
3. Đăng ký user `alice`, rồi kiểm tra token server trả về.

**Kết quả thực tế:**
```
### B1 .env JWT_SECRET ignored? token signed with DEFAULT secret
200
### B1 token signed with secret from .env
401
### B1 issued token is signed with
"webchat-realtime-default-secret-key-32-chars"
```
Ở bước A12, server chạy không có `JWT_SECRET`. Token tự ký bằng secret mặc định cho `userId` của alice vẫn được `/api/auth/me` trả 200 kèm đầy đủ thông tin tài khoản.

**Tác động:** Mọi môi trường cấu hình qua file `.env` (dev local, VPS, Docker có mount `.env`, hoặc cách deploy khác Render) đều dùng secret công khai, nên **ai cũng giả mạo được token của bất kỳ user nào**. Lập trình viên lại tưởng `.env` đã có hiệu lực. Render không bị lỗi thứ tự load vì biến được inject vào môi trường process, nhưng vẫn dính SEC-01.

**Phạm vi:** toàn bộ xác thực REST (`authMiddleware`) và Socket.IO (`server/src/socket/index.ts:35-54`).

---

## 🟠 High

<a id="sec-03"></a>
### SEC-03: Stored XSS qua URL đính kèm và GIF trong tin nhắn

**Hạng mục checklist:** 5.1

**Vị trí phía server (nhận và lưu URL tùy ý, không kiểm tra scheme):**
- `server/src/socket/direct.handler.ts:73-131`: `DIRECT_SEND` lấy `attachmentUrl`, `type` và `content` thẳng từ payload rồi ghi vào DB.
- `server/src/socket/room.handler.ts:116-165`: `ROOM_SEND` làm tương tự.

**Vị trí phía client (render URL vào sink nguy hiểm):**
- `client/src/components/chat/MessageItemContent.tsx:92-96`: `<a href={attachmentUrl} target="_blank">` (nút Download của DOCUMENT).
- `client/src/components/chat/MessageItemContent.tsx:39`: `window.open(content, ...)` khi click GIF (`type = EMOJI_GIF`, URL nằm trong `content`).
- `client/src/components/chat/DocumentPreviewModal.tsx:156-161`: `<iframe src={documentUrl}>` khi `attachmentName` có đuôi `.pdf`.
- `client/src/components/chat/DocumentPreviewModal.tsx:131, 179, 226`: `<a href={documentUrl}>`.
- `client/src/components/chat/ImageLightboxModal.tsx:46`: `<a href={imageUrl}>`.

**Mô tả:**
Client gửi tin nhắn đính kèm qua socket với `attachmentUrl` do chính client tự điền. Server không kiểm tra URL có thật là kết quả của `/api/upload` hay không, cũng không kiểm tra scheme (`http`/`https`). React **18.3.1** (phiên bản đang dùng) **không chặn** URL `javascript:` trong `href` hay `src`, mà chỉ in cảnh báo ở console development. React chỉ bắt đầu chặn từ bản 19.

**Tái hiện (A18, A20):**
1. Đăng nhập alice và tạo direct chat với bob.
2. Emit `direct:send` với payload:
   `{ directChatId, content: "report", type: "DOCUMENT", attachmentUrl: "javascript:alert(document.domain)", attachmentName: "report.pdf", attachmentSize: -5 }`
3. Server phản hồi:
   ```
   { "success": true, "attachmentUrl": "javascript:alert(document.domain)", "size": -5 }
   ```
4. Phía bob nhận được thẻ tài liệu "report.pdf". Nếu bob **click vào thẻ** để xem trước, `DocumentPreviewModal` render `<iframe src="javascript:...">` vì tên file có đuôi `.pdf`, và mã chạy trong origin của app. Nếu bob **click nút Download**, `<a href="javascript:...">` cũng thực thi.
5. Tương tự, `direct:send` với `{ type: "EMOJI_GIF", content: "javascript:alert(1)" }` cũng được chấp nhận (A20). Payload này đi vào `window.open(content)` khi người nhận click GIF.

**Phương pháp xác minh:** Việc server chấp nhận và phát lại payload đã được xác nhận bằng test động. Việc thực thi ở trình duyệt được xác nhận bằng phân tích mã cùng hành vi đã biết của React 18 (cho qua `javascript:` URL), chưa chạy trong trình duyệt thật.

**Tác động:**
- Mã JavaScript của kẻ tấn công chạy trong phiên của nạn nhân, đọc được `localStorage.webchat_token` (`client/src/context/AuthContext.tsx:84,103`), dẫn tới **chiếm tài khoản**. Token có hạn 7 ngày và không thu hồi được (SEC-11).
- Trong Room, chỉ một tin nhắn là đủ nhắm tới mọi thành viên.
- Có thể dùng URL `https://` trỏ tới trang của kẻ tấn công để phishing trong iframe xem trước PDF. Ngoài ra, với tài liệu text, client sẽ `fetch()` tới URL tùy ý (`DocumentPreviewModal.tsx:186`), làm lộ IP người xem.

**Phạm vi:** Direct Chat và Room Chat, các loại tin `DOCUMENT`, `IMAGE` và `EMOJI_GIF`.

---

<a id="sec-04"></a>
### SEC-04: Stored XSS qua file upload HTML/SVG được phục vụ cùng origin

**Hạng mục checklist:** 2.4, 5.1

**Vị trí:**
- `server/src/lib/storage.ts:24-56`: `isAllowedMimeType()` chấp nhận mọi `image/*` (gồm `image/svg+xml`) và cả `application/octet-stream` (dòng 52).
- `server/src/middlewares/upload.middleware.ts:13-17`: tên file lưu trên đĩa giữ nguyên đuôi do client gửi (`poc.html` → `<ts>-<rand>-poc.html`).
- `server/src/middlewares/upload.middleware.ts:25-31`: filter chỉ dựa vào `file.mimetype`, là giá trị do client tự khai.
- `server/src/app.ts:25`: `app.use('/uploads', express.static(UPLOADS_DIR))` phục vụ file với `Content-Type` suy ra từ **đuôi file**, không có `Content-Disposition: attachment`, không có `nosniff`.
- `server/src/app.ts:41-48`: cùng process đó phục vụ luôn SPA (`client/dist`), tức là file upload và ứng dụng **chung một origin** khi deploy kiểu single-host.

**Tái hiện (A15, A16):**
1. `POST /api/upload` gửi file `poc.html` với nội dung `<script>alert(localStorage.webchat_token)</script>` và khai MIME `application/octet-stream`.
2. Server trả `{"url":"/uploads/1792684285866-799880116-poc.html", "mimeType":"application/octet-stream"}`.
3. `GET` URL đó **không cần token** thì nhận `200` với `Content-Type: text/html; charset=UTF-8`.
4. Làm tương tự với `poc.svg` (`image/svg+xml`, có thẻ `<script>`): server phục vụ với `Content-Type: image/svg+xml`, và trình duyệt chạy script khi mở trực tiếp.

**Tác động:**
- Kẻ tấn công gửi link file này trong chat. Nạn nhân mở link thì script chạy **trên chính origin của ứng dụng**, đọc được token trong localStorage và chiếm tài khoản.
- Ở cấu hình tách domain (Vercel + Render), script chạy trên origin API. Mức ảnh hưởng tới token thấp hơn, nhưng vẫn là trang HTML tùy ý dưới domain chính thức (phishing).
- Mặc định `STORAGE_PROVIDER` trống, nên `LocalStorageAdapter` được dùng (`storage.ts:214-223`).

**Phạm vi:** mọi deployment dùng `STORAGE_PROVIDER=local` (giá trị mặc định, cũng là giá trị trong `.env.example`). Với Supabase, file nằm trên domain `*.supabase.co` với `Content-Type` do client khai (`storage.ts:187`): đó vẫn là một trang HTML do kẻ tấn công kiểm soát, nhưng khác origin với app.

---

<a id="sec-05"></a>
### SEC-05: Một request sai kiểu dữ liệu làm sập toàn bộ server

**Hạng mục checklist:** 6.9 (chống DoS)

**Vị trí:**
- `server/src/controllers/room.controller.ts:71`: `description.trim()` không kiểm tra `typeof description === 'string'`.
- Các controller async **không có `try/catch`**: toàn bộ `room.controller.ts`, `direct-chat.controller.ts` và `user.controller.ts`. Chỉ `auth`, `gif` và `upload` có `try`.
- Express 4.22.3 **không bắt** promise bị reject trong handler async. Error handler toàn cục ở `server/src/app.ts:52-55` không nhận được lỗi.
- `server/src/index.ts` không đăng ký `process.on('unhandledRejection')`. Từ Node 15 trở đi, unhandled rejection làm **dừng process**.

**Tái hiện (A25, A26):**
1. Đăng nhập với một user bất kỳ.
2. `POST /api/rooms` với body `{"name":"x","description":12345}`.
3. Request không có response (`TypeError: fetch failed`). Log server:
   ```
   TypeError: description.trim is not a function
       at createRoom (server/src/controllers/room.controller.ts:71:46)
   Node.js v24.19.0
   ```
4. `GET /health` ngay sau đó trả `ECONNREFUSED`: process đã thoát với exit code 1.

**Tác động:**
- **Bất kỳ user nào** (đăng ký miễn phí, không giới hạn, xem SEC-07) dùng **một request** là đánh sập server cho **mọi người dùng**: mọi kết nối socket bị ngắt, presence trong RAM mất hết. Lặp lại liên tục thì dịch vụ không hồi phục được, vì Render free tier khởi động lại khá chậm.
- Không chỉ dữ liệu sai kiểu: mọi lỗi Prisma hay lỗi kết nối DB phát sinh trong các controller không có `try/catch` cũng làm sập process theo cùng cơ chế.

**Phạm vi:** toàn bộ backend (REST + Socket.IO chạy chung process).

---

<a id="sec-06"></a>
### SEC-06: User đã rời hoặc bị kick khỏi room vẫn nhận tin nhắn real-time

**Hạng mục checklist:** 2.1 (kiểm tra quyền sở hữu/thành viên)

**Vị trí:**
- `server/src/controllers/room.controller.ts:485-543` (`leaveRoom`): xóa bản ghi `RoomMember` và phát event `LEAVE`, nhưng **không** gọi `syncUserSocketsRoomMembership(io, userId, id, 'leave')`. Ngược lại, `removeRoomMember` (dòng 402) và `addRoomMember` (dòng 317) có gọi.
- `server/src/socket/room.handler.ts:195`: tin nhắn được broadcast theo **socket room** `room:<id>` (`io.to(...)`), không đối chiếu lại với bảng `RoomMember`.
- `server/src/socket/index.ts:27-30`: `connectionStateRecovery` với `skipMiddlewares: true`. Khi socket kết nối lại trong vòng 2 phút, Socket.IO **khôi phục danh sách room cũ** của socket và **bỏ qua** middleware xác thực JWT.

**Tái hiện, trường hợp 1: tự rời room (A21)**
1. Alice tạo room và thêm carol. Carol đang online, socket đã ở trong `room:<id>`.
2. Carol gọi `POST /api/rooms/<id>/leave` và nhận 200.
3. Alice gửi `room:send` với nội dung `"secret after carol left"`.
4. Socket của carol **vẫn nhận** event `room:receive`:
   ```
   { "leaveStatus": 200, "carolReceived": ["secret after carol left"] }
   ```

**Tái hiện, trường hợp 2: bị kick trong lúc mất mạng ngắn (B2)**
1. Alice và carol cùng ở trong room, cả hai đang kết nối.
2. Ngắt transport của carol đột ngột (`socket.io.engine.close()`, giả lập rớt mạng).
3. Trong lúc carol mất kết nối, alice kick carol: `DELETE /api/rooms/<id>/members/<carolId>` trả 200. Lúc này `syncUserSocketsRoomMembership` không tìm thấy socket nào của carol để gỡ khỏi room.
4. Carol tự động kết nối lại và được khôi phục (`socket.recovered = true`) cùng danh sách room cũ.
5. Alice gửi `"secret after carol was kicked"` và carol **vẫn nhận được**:
   ```
   B2 kick while carol offline briefly; recovered=true
   { "kickStatus": 200, "carolReceived": ["warmup", "secret after carol was kicked"] }
   ```

**Tác động:** Lộ toàn bộ nội dung trò chuyện về sau của room (text, link đính kèm, typing, read receipt) cho người không còn quyền truy cập. Kick là hành động kiểm duyệt (loại người phá rối hoặc người ngoài), và hành động này bị vô hiệu cho tới khi người đó tự reload hoặc ngắt kết nối hẳn. Trường hợp 1 kéo dài suốt phiên socket. Trường hợp 2 có thể bị lợi dụng có chủ đích bằng cách chủ động ngắt mạng ngay trước khi bị kick.

Ngoài ra, vì `skipMiddlewares: true`, socket được khôi phục **không bị kiểm tra lại JWT**, nên token đã hết hạn vẫn giữ được phiên socket nếu kết nối lại trong vòng 2 phút.

**Phạm vi:** Room Chat (event `room:receive`, `room:typing`, `room:read`).

---

<a id="sec-07"></a>
### SEC-07: Không có rate limiting

**Hạng mục checklist:** 1.10, 6.9

**Vị trí:** `server/src/app.ts` (không có middleware giới hạn tần suất), `server/src/socket/*.ts` (không giới hạn tần suất event). `server/package.json` không có thư viện rate limit nào.

**Tái hiện:**
- **A08:** 60 lần `POST /api/auth/login` sai mật khẩu liên tiếp cho user `bob`. Kết quả `{"401": 60}`: không lần nào bị chặn, không có độ trễ tăng dần, không khóa tài khoản, không CAPTCHA.
- **A22:** 300 event `direct:send` gửi song song từ một socket. Kết quả `{"accepted": 300, "ms": 663}`: cả 300 tin được ghi vào DB và đẩy tới người nhận trong chưa tới 0,7 giây.

**Tác động:**
- Brute-force hoặc credential stuffing mật khẩu không bị cản trở, càng nguy hiểm vì không có chính sách độ mạnh mật khẩu (SEC-08, chấp nhận mật khẩu `"1"`).
- Spam hoặc flood tin nhắn vô hiệu hóa giới hạn ký tự chống spam đã đặc tả trong `.scratch/message-character-limit/spec.md`, vì giới hạn đó chỉ tính theo từng tin chứ không theo tần suất.
- Đăng ký tài khoản hàng loạt, upload hàng loạt (10MB mỗi file, lưu trên đĩa server) làm cạn tài nguyên.

**Phạm vi:** `/api/auth/login`, `/api/auth/register`, `/api/upload`, `/api/users` và mọi socket event.

---

## 🟡 Medium

<a id="sec-08"></a>
### SEC-08: Thiếu validate đầu vào ở đăng ký và đăng nhập

**Hạng mục checklist:** 1.7, 5.x

**Vị trí:**
- `server/src/controllers/auth.controller.ts:21-27` (`register`): chỉ kiểm tra field có tồn tại (truthy).
- `server/src/controllers/auth.controller.ts:76-95` (`login`): đưa `emailOrUsername` thẳng vào `prisma.user.findFirst({ where: { OR: [{ username: X }, { email: X }] } })` mà không kiểm tra kiểu.

**Tái hiện và kết quả:**

| Bước | Input | Kết quả |
|---|---|---|
| A02 | `password: "1"` | `201` (chấp nhận mật khẩu 1 ký tự) |
| A03 | `email: "not-an-email"` | `201` (không kiểm tra định dạng email, không xác minh email) |
| A04 | `avatarUrl: "javascript:alert(1)"` | `201`, lưu nguyên `"javascript:alert(1)"` |
| A05 | `username` dài 50.000 ký tự | `201` |
| A06 | `username: "crlf\r\nX-Injected: 1"` | `201`, lưu nguyên CR/LF |
| A07 | `username: {"a":1}` (object) | `500` kèm thông báo lỗi Prisma (xem SEC-09) |
| A09 | `emailOrUsername: {"contains":"b"}`, `password: "bobpass"` | **`200`, đăng nhập thành công vào `bob`** |
| A10 | `password: {"a":1}` | `500` với `"Illegal arguments: object, string"` |

**Mô tả chi tiết A09 (ORM operator injection):** `express.json()` cho phép body chứa object lồng nhau, và Prisma hiểu object `{ contains: "b" }` là toán tử lọc. Vì vậy `findFirst` trả về user **đầu tiên** khớp mẫu, thay vì yêu cầu username hay email chính xác. Kẻ tấn công vẫn phải có đúng mật khẩu, nhưng **không cần biết username hay email**. Kết hợp với việc không có rate limit (SEC-07), có thể thử một mật khẩu phổ biến trên nhiều tài khoản bằng cách đổi mẫu `contains`/`startsWith`.

**Tác động:**
- Mật khẩu yếu cộng với không rate limit làm tăng khả năng tài khoản bị chiếm.
- Username chứa ký tự điều khiển hoặc siêu dài hiển thị ở mọi nơi (sidebar, room member list, notification) gây vỡ giao diện và cho phép mạo danh. Username cũng không giới hạn ký tự nhìn giống nhau (homoglyph): `alice` và `Alice` là hai tài khoản khác nhau.
- `avatarUrl` tùy ý được dùng làm `icon` của browser Notification (`client/src/components/dashboard/Dashboard.tsx:141`), nên trình duyệt người nhận sẽ tải ảnh từ server của kẻ tấn công (lộ IP, theo dõi online).
- Email không được xác minh: có thể đăng ký bằng email của người khác.

**Phạm vi:** `/api/auth/register`, `/api/auth/login`. Room `name`/`description` (`room.controller.ts:58-72`) cũng không có giới hạn độ dài.

---

<a id="sec-09"></a>
### SEC-09: Lộ thông tin nội bộ qua thông báo lỗi

**Hạng mục checklist:** 6.8 (tắt debug ở production)

**Vị trí:**
- `server/src/app.ts:54`: `res.status(500).json({ message: err?.message || ... })`
- `server/src/controllers/auth.controller.ts:72, 119, 143`
- `server/src/controllers/upload.controller.ts:17`: chuyển nguyên thông báo lỗi của Supabase/Cloudinary (`storage.ts:131, 194`) cho client.
- Mọi callback socket: `callback({ success: false, error: err.message })`, ví dụ `direct.handler.ts:172` và `room.handler.ts:92, 109, 203, 278, 328`.

**Tái hiện (A07),** trên server chạy với `NODE_ENV=production`:
```
POST /api/auth/register  {"username":{"a":1}, ...}
→ 500 {"message":"\nInvalid `prisma.user.findUnique()` invocation:\n\n{\n  where: {\n    username: {\n      a: 1\n    }\n ... Argument `username`: Invalid value provided. Expected String, provided Object."}
```
A24: body JSON lớn hơn 100KB trả về **500** (thay vì 413) kèm `"request entity too large"`.

**Tác động:** Lộ tên model, tên field, cấu trúc query và ORM đang dùng. Thông tin này giúp kẻ tấn công dò ra các lỗ hổng injection như A09. Thông báo lỗi từ dịch vụ lưu trữ bên ngoài có thể chứa bucket, path hoặc chi tiết cấu hình.

**Phạm vi:** mọi endpoint REST và socket event có nhánh xử lý lỗi.

---

<a id="sec-10"></a>
### SEC-10: Thiếu security header

**Hạng mục checklist:** 4.1, 4.3, 4.4, 4.5

**Vị trí:** `server/src/app.ts` (không dùng `helmet` hay middleware tương đương, không gọi `app.disable('x-powered-by')`), `vercel.json` (không có khối `headers`), `client/index.html` (không có thẻ meta CSP).

**Tái hiện (A01):** Header nhận được từ `GET /health`:
```
access-control-allow-origin: *
content-type: application/json; charset=utf-8
x-powered-by: Express
(và etag, date, connection, keep-alive)
```

**Header còn thiếu:**

| Header | Hệ quả khi thiếu |
|---|---|
| `Content-Security-Policy` | Không có lớp phòng thủ thứ hai khi XSS xảy ra (SEC-03, SEC-04): script inline, `javascript:` URL, iframe tới domain lạ đều chạy được |
| `Strict-Transport-Security` | Trình duyệt không bị buộc dùng HTTPS, có thể bị hạ cấp ở lần truy cập đầu |
| `X-Frame-Options` / `frame-ancestors` | Trang có thể bị nhúng iframe để clickjacking (lừa click "Delete room", "Kick") |
| `X-Content-Type-Options: nosniff` | Trình duyệt có thể đoán MIME của file upload, tăng rủi ro SEC-04 |
| `Referrer-Policy` | Lộ URL nội bộ cho các domain bên ngoài (Giphy, link đính kèm) |
| `X-XSS-Protection` | Hạng mục checklist yêu cầu (header này đã lỗi thời trên trình duyệt hiện đại) |

`X-Powered-By: Express` để lộ công nghệ server.

**Phạm vi:** backend Render (REST, `/uploads`, SPA khi deploy single-host) và frontend Vercel.

---

<a id="sec-11"></a>
### SEC-11: Quản lý session yếu

**Hạng mục checklist:** 1.3, 1.4, 7.5

**Vị trí:**
- `server/src/lib/jwt.ts:9`: `JWT_EXPIRES_IN = '7d'`. Không có refresh token, không có danh sách thu hồi, không có trường version trong token.
- `client/src/context/AuthContext.tsx:107-112`: `logout()` chỉ xóa `localStorage` và state ở client. Server không có endpoint logout.
- `client/src/context/AuthContext.tsx:84-85, 103-104`: token và thông tin user lưu trong `localStorage`.
- `server/src/middlewares/auth.middleware.ts:18-21`: chỉ kiểm tra chữ ký và hạn của token, không kiểm tra user còn tồn tại hay token còn hiệu lực theo phía server.

**Tái hiện (A13):** token sau khi đăng nhập có `exp - iat = 604800` giây (7 ngày). Sau khi "logout" ở client, token cũ vẫn dùng được đầy đủ với mọi API và socket cho tới khi hết hạn, vì server không có cơ chế nào để vô hiệu hóa nó.

**Tác động:**
- Token bị đánh cắp (qua SEC-03, SEC-04, máy dùng chung, extension độc hại) có hiệu lực tối đa 7 ngày, và **nạn nhân không có cách nào thu hồi**: logout không giúp gì, lại không có tính năng đổi mật khẩu.
- Token lưu trong localStorage nên mọi script chạy trên origin đều đọc được (khác với cookie `HttpOnly`).
- Khi xảy ra sự cố như SEC-01, không có cơ chế buộc đăng xuất toàn bộ user ngoài việc đổi secret.

**Phạm vi:** toàn bộ xác thực.

---

<a id="sec-13"></a>
### SEC-13: `GET /api/users` lộ email của toàn bộ người dùng

**Hạng mục checklist:** 2.x (bảo vệ dữ liệu người dùng)

**Vị trí:**
- `server/src/controllers/user.controller.ts:19-47`: không có tham số tìm kiếm thì trả về **mọi** user (trừ người gọi), không phân trang, không giới hạn số lượng.
- `server/src/controllers/user.controller.ts:6-17`: `toUserDto` luôn kèm `email`. DTO này cũng được dùng trong danh sách thành viên room (`room.controller.ts:47`) và `partner` của direct chat (`direct-chat.controller.ts:80, 111, 207`).
- Tìm kiếm `q` khớp cả trên trường `email` (dòng 37), nên có thể dò email theo từng phần.

**Tái hiện (A11):** đăng nhập bằng `bob` rồi gọi `GET /api/users` sẽ nhận danh sách đầy đủ username **và email** của mọi tài khoản khác (`alice@x.io`, `carol@x.io`, `eve@x.io`, …).

**Tác động:** Ai cũng đăng ký được không giới hạn (SEC-07, SEC-08), nên trên thực tế **email của toàn bộ người dùng là công khai** và thu thập được chỉ bằng một request. Danh sách này phục vụ spam, phishing nhắm mục tiêu, hoặc credential stuffing trên các dịch vụ khác. Đồng thời lộ `id` (UUID) của mọi user, là đầu vào cho việc giả mạo token ở SEC-01 và SEC-02.

**Phạm vi:** `/api/users`, `/api/rooms/:id`, `/api/direct-chats`, `/api/auth/me`.

---

<a id="sec-14"></a>
### SEC-14: Metadata đính kèm không bị giới hạn, vượt qua anti-spam character limit

**Hạng mục checklist:** 5.x

**Vị trí:**
- `server/src/socket/direct.handler.ts:82-87` và `room.handler.ts:143-153`: chỉ kiểm tra `content.length`.
- `server/src/socket/direct.handler.ts:121-131` và `room.handler.ts:156-165`: `attachmentUrl`, `attachmentName` và `attachmentSize` được ghi nguyên vào DB. `type` do client chọn (chỉ bị ràng buộc bởi enum của Prisma).
- `server/prisma/schema.prisma:103-105, 155-157`: `attachmentUrl`/`attachmentName` là `String` không giới hạn độ dài, `attachmentSize` là `Int` không ràng buộc dấu.

**Tái hiện:**
- **A19:** `direct:send` với `content: "hi"`, `attachmentUrl` dài 200.000 ký tự và `attachmentName` dài 200.000 ký tự. Kết quả `success: true, nameLen: 200000`, tức là **gấp 50 lần** giới hạn 4000 ký tự của Direct Chat.
- **A18:** `attachmentSize: -5` được chấp nhận và lưu lại.

**Tác động:**
- Vô hiệu hóa hoàn toàn tính năng "Message Character Limit" vừa hoàn thành (`.scratch/message-character-limit/spec.md`, user story 17: *"backend socket handlers strictly validate incoming message lengths … malicious users attempting to bypass client-side checks … are completely blocked"*). Spam bằng `attachmentName` vẫn hiển thị trong thẻ tài liệu và tiêu đề modal xem trước.
- Mỗi tin có thể nặng tới khoảng 1MB (giới hạn `maxHttpBufferSize` mặc định của Socket.IO). Kết hợp với SEC-07, kẻ tấn công làm phình DB và băng thông broadcast tới mọi thành viên room.
- `type` và `attachmentUrl` tùy ý là tiền đề của SEC-03.

**Phạm vi:** `direct:send`, `room:send`.

---

<a id="sec-15"></a>
### SEC-15: Upload tin MIME từ client, file đính kèm riêng tư truy cập công khai, không xóa EXIF

**Hạng mục checklist:** 2.4, 2.5

**Vị trí:**
- `server/src/middlewares/upload.middleware.ts:25-31`: chỉ kiểm tra `file.mimetype`, là header do client tự khai. Không kiểm tra magic bytes hay nội dung thật.
- `server/src/lib/storage.ts:52`: cho phép `application/octet-stream`, tức là mọi loại file.
- `server/src/app.ts:25`: `/uploads` phục vụ tĩnh, **không yêu cầu xác thực**.
- `server/src/lib/storage.ts:197`: Supabase trả URL dạng `/storage/v1/object/public/...`, tức bucket ở chế độ **public**.
- `server/src/lib/storage.ts:67-84`: ảnh lưu nguyên bản, không xử lý metadata.
- `server/src/lib/storage.ts:5`: `UPLOADS_DIR` nằm trên filesystem của container Render. Filesystem này tạm thời và cùng máy chạy ứng dụng.

**Tái hiện:**
- **A17:** upload `evil.php` (nội dung `<?php system($_GET[c]); ?>`) và khai `image/png`: server chấp nhận và lưu thành `/uploads/…-evil.php`.
- **A15:** `GET /uploads/<file>` **không gửi token** vẫn nhận `200`.
- Không có bước nào loại bỏ EXIF (GPS, model thiết bị, thời gian chụp) khỏi ảnh.

**Tác động:**
- **Riêng tư:** ảnh và tài liệu gửi trong Direct Chat hoặc Room kín ai có link cũng xem được, kể cả người đã bị kick (SEC-06), người không có tài khoản, hay link bị chuyển tiếp hoặc lộ qua log, Referer. Quyền truy cập đính kèm hoàn toàn tách rời khỏi quyền truy cập cuộc trò chuyện.
- **EXIF:** ảnh chụp từ điện thoại có thể làm lộ toạ độ GPS nhà riêng hay nơi làm việc của người gửi.
- **Kiểu file:** cho phép lưu file thực thi hoặc mã độc dưới nhãn "ảnh" và phát tán qua chat. Kết hợp với `express.static` thì dẫn tới SEC-04.
- File lưu trên đĩa của app server: upload hàng loạt (SEC-07) có thể làm đầy đĩa container.

**Phạm vi:** `/api/upload`, `/uploads/*`, bucket Supabase `attachments`.

---

## 🔵 Low

<a id="sec-12"></a>
### SEC-12: CORS wildcard trên REST và Socket.IO

**Hạng mục checklist:** 4.x

**Vị trí:** `server/src/app.ts:20` (`app.use(cors())`), `server/src/socket/index.ts:22-25` (`cors: { origin: '*' }`).

**Tái hiện (A23):** preflight `OPTIONS /api/users` với `Origin: https://evil.example` và `Access-Control-Request-Headers: authorization` trả `204` kèm `access-control-allow-origin: *` và `access-control-allow-headers: authorization`.

**Mô tả và tác động:** Ứng dụng xác thực bằng header Bearer chứ không bằng cookie, nên wildcard CORS **tự nó** không cho phép đánh cắp dữ liệu. Tuy nhiên, wildcard cho phép bất kỳ website nào dùng API làm backend, và bỏ mất một lớp phòng thủ khi token đã bị lộ: script trên domain lạ dùng token đánh cắp được (SEC-03, SEC-11) để gọi API trực tiếp từ trình duyệt nạn nhân. Danh sách origin không phản ánh kiến trúc thực tế, vốn chỉ có hai origin hợp lệ: Vercel frontend và chính backend Render.

**Phạm vi:** toàn bộ REST và handshake Socket.IO.

---

<a id="sec-16"></a>
### SEC-16: Dependency có lỗ hổng đã công bố

**Hạng mục checklist:** 6.6

**Bằng chứng:** `npm audit` trên toàn workspace cho **11 lỗ hổng (9 high, 2 moderate)**:

| Package | Mức | Advisory | Đường dẫn phụ thuộc |
|---|---|---|---|
| `mysql2` ≤ 3.23.0 | high | GHSA-3f6p-5ww8-9rcr (lộ mật khẩu dạng plaintext qua auth downgrade), GHSA-rgwj-5xj2-c3m3 (decompression-bomb DoS) | `prisma` → transitive |
| `deepmerge-ts` < 8.0.0 | high | GHSA-ggr8-5vv4-36mx (stack exhaustion) | `prisma` → `@prisma/config` |
| `prisma`, `@prisma/config` 7.x ≤ 7.10.0 | high | thừa hưởng từ hai package trên | dependency trực tiếp của `server` |
| `braces`, `micromatch`, `fast-glob`, `chokidar` | high | stack-exhaustion DoS | `tailwindcss` 3.4.x (build-time) |
| `tailwindcss` ≤ 3.4.19 | high | thừa hưởng | dependency trực tiếp của `client` |
| `postcss-selector-parser` < 7.1.6, `postcss-nested` | moderate | GHSA-rj75-hqrm-r3gf (CPU exhaustion) | `tailwindcss` |

**Tác động:** Phần lớn nằm ở công cụ build (Tailwind, PostCSS) hoặc ở driver không được dùng (`mysql2`, vì dự án chạy Postgres), nên khả năng bị khai thác ở runtime thấp. Tuy vậy, `prisma` được khai báo trong `dependencies` (không phải `devDependencies`) nên được cài cả trên production, và repo đang ở trạng thái lệch so với các bản vá đã phát hành.

**Phạm vi:** `server/package.json`, `client/package.json`, `package-lock.json`.

---

<a id="sec-17"></a>
### SEC-17: Không có logging bảo mật hay monitoring

**Hạng mục checklist:** 6.10

**Vị trí:** toàn bộ `server/src`. Ghi log chỉ dùng `console.error` trong nhánh lỗi, không có logger có cấu trúc hay correlation ID.

**Thiếu sót cụ thể:**
- Không ghi lại sự kiện đăng nhập thành công hoặc thất bại (kèm IP, user-agent). Chuỗi 60 lần login sai ở A08 không để lại dấu vết nào trong log.
- Không ghi các hành động quản trị (kick, đổi role, xóa room), upload file, hay request bị từ chối 401/403.
- Không có health check sâu hơn `/health` (không kiểm tra DB), không có cảnh báo khi process crash (SEC-05) hoặc tỉ lệ lỗi tăng.
- `console.error('Unhandled application error:', err)` (`app.ts:53`) có thể in ra cả object lỗi kèm dữ liệu request.

**Tác động:** Không phát hiện được brute-force, việc dùng token giả mạo (SEC-01, SEC-02) hay lạm dụng. Khi có sự cố, không có dữ liệu để điều tra phạm vi ảnh hưởng (checklist 7.5).

**Phạm vi:** backend.

---

<a id="sec-18"></a>
### SEC-18: Không có chính sách công bố lỗ hổng hay quy trình xử lý sự cố

**Hạng mục checklist:** 7.1, 7.5

**Bằng chứng:** Không có `SECURITY.md`, thư mục `.github/` hay mục liên hệ bảo mật trong `README.md`. `docs/` không có tài liệu nào về xử lý sự cố.

**Tác động:** Người phát hiện lỗ hổng (repo đang public) không có kênh báo cáo riêng, nên dễ báo công khai qua issue hoặc không báo. Khi xảy ra sự cố như SEC-01, không có quy trình định sẵn cho việc xoay vòng secret, đánh giá dữ liệu bị ảnh hưởng hay thông báo cho người dùng. Ứng dụng cũng không có tính năng để thực hiện bước "yêu cầu người dùng đổi mật khẩu" mà checklist 7.5 nêu (xem SEC-11).

**Phạm vi:** quy trình dự án.

---

## Phụ lục: Hạng mục PASS đáng chú ý

Các điểm sau đã được kiểm tra và **đạt**, ghi lại để tránh kiểm tra trùng:

- Mật khẩu được hash bằng bcrypt cost 10 và không bao giờ trả về client: `toUserDto` không chứa `passwordHash`.
- Toàn bộ truy vấn DB đi qua Prisma, đã được parameterize. Không có raw SQL ghép từ input.
- REST kiểm tra quyền đúng: xem tin nhắn direct chat yêu cầu là participant (`direct-chat.controller.ts:245-250`). Xem room, tin nhắn room và socket `room:join`/`room:send`/`room:read`/`room:typing` yêu cầu là member. Phân quyền OWNER/ADMIN/MEMBER khi kick hoặc đổi role đúng với thiết kế.
- ID dùng UUID, không đoán được và không tuần tự.
- Nội dung text tin nhắn được React escape, không có `dangerouslySetInnerHTML` hay `innerHTML` trong `client/src`.
- Tên file upload được sanitize bằng `/[^a-zA-Z0-9._-]/g` và thêm tiền tố ngẫu nhiên, nên không bị path traversal.
- Giới hạn kích thước: upload tối đa 10MB, body JSON tối đa 100KB (giá trị mặc định của Express).
- Server không fetch URL do người dùng cung cấp, nên không có SSRF.
- `jsonwebtoken` 9.x mặc định từ chối `alg: none`.
