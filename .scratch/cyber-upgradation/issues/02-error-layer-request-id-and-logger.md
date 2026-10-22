# 02: Lớp lỗi, `requestId` và logger nền

**What to build:** Không request hay event socket nào có thể làm sập process. Mọi lỗi bất ngờ trả về cho User một thông báo chung kèm mã tra cứu (`requestId`). Người vận hành dùng mã này để tìm đúng dòng log JSON có cấu trúc, trong đó không có secret. Đóng SEC-05 và SEC-09, đồng thời đặt nền logger cho SEC-17.

Spec: [`../spec.md`](../spec.md), mục *Validation và xử lý lỗi* và *Logging và giám sát*.

**Blocked by:** 01 (Server factory và module cấu hình)

**Status:** ready-for-agent

- [ ] Mọi route handler async được bọc qua `asyncHandler`. Mọi socket handler được bọc qua một wrapper tương đương, đẩy lỗi về callback lỗi.
- [ ] Mỗi request và mỗi event socket có `requestId`. REST trả `requestId` trong header `X-Request-Id`.
- [ ] Error handler toàn cục chỉ trả `{ message, code, requestId }` với thông báo chung. Không bao giờ trả `err.message` gốc, lỗi Prisma hay lỗi của dịch vụ lưu trữ, kể cả ở các controller auth và upload.
- [ ] Callback lỗi của socket chỉ trả `{ success: false, error: <code>, requestId }`.
- [ ] Body JSON quá lớn trả `413`. JSON sai cú pháp trả `400`.
- [ ] Logger JSON (`pino`) có `requestId`, `userId` và `ip` khi có. Redact `password`, `cookie`, `set-cookie`, `authorization` và mọi khóa chứa `secret` hoặc `token`. Lỗi 5xx được log kèm stack, và stack chỉ nằm trong log.
- [ ] `unhandledRejection` và `uncaughtException` được log ở mức fatal. Riêng `unhandledRejection` không làm process thoát.
- [ ] `maxHttpBufferSize` của Socket.IO là 64KB.
- [ ] Test hồi quy: A25/A26 (sau `POST /api/rooms` với `description` là số, `/health` vẫn trả lời), A07 (lỗi không chứa chi tiết Prisma), A24 (`413`). Tất cả fail trên mã cũ và pass sau khi sửa.
- [ ] Test xác nhận log không chứa mật khẩu hay giá trị cookie, dùng một sink log test.
