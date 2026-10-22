# 16: Security header, CSP và gỡ CORS

**What to build:** Mọi response (SPA, API, file tĩnh) mang bộ security header đầy đủ:
- CSP chặt, nên trình duyệt chỉ chạy script của chính app, không cho nhúng trang vào frame của site khác, và chỉ tải ảnh hay iframe từ Supabase và Giphy.
- Có thêm HSTS, `nosniff`, `Referrer-Policy` và `Permissions-Policy`.

App là single-host chung origin (ADR 0010), nên CORS được gỡ hẳn và mọi dấu vết cấu hình Vercel bị xóa. Đóng SEC-10 và SEC-12.

Spec: [`../spec.md`](../spec.md), mục *Single-host, CORS và security header*.

**Blocked by:** 01 (Server factory và module cấu hình)

**Status:** ready-for-agent

- [ ] `helmet` áp cho mọi response với CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: <SUPABASE_ORIGIN> https://*.giphy.com; connect-src 'self' <SUPABASE_ORIGIN>; frame-src <SUPABASE_ORIGIN>; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`. `<SUPABASE_ORIGIN>` lấy từ cấu hình. Nếu bản build buộc phải có style inline thì chỉ nới `style-src` và ghi lý do.
- [ ] Có các header: `Strict-Transport-Security` (một năm, `includeSubDomains`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` tắt camera, microphone và geolocation, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`. Không có `X-Powered-By`.
- [ ] Gỡ middleware CORS trên REST và cấu hình `origin: '*'` của Socket.IO.
- [ ] Xóa cấu hình Vercel và các biến `VITE_API_URL`, `VITE_SOCKET_URL`. Client luôn gọi cùng origin, dev đi qua proxy Vite.
- [ ] Fallback `index.html` của SPA chỉ áp cho `GET` không thuộc `/api`, `/socket.io`, `/health` hay `/uploads`.
- [ ] Bản build client chạy được dưới CSP này: không có script inline, và các thư viện không dùng `eval`. Kiểm tra bằng cách chạy bản build cục bộ với header thật.
- [ ] Test hồi quy qua seam 1:
  - A01: `GET /` và `GET /api/...` có đủ header và CSP đúng chính sách, không có `X-Powered-By`.
  - A23: preflight từ `https://evil.example` không nhận `Access-Control-Allow-Origin`.
