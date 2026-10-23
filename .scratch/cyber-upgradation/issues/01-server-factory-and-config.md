# 01: Server factory và module cấu hình

**What to build:** Server được dựng qua một factory nhận *cấu hình đã validate* và *storage adapter*, thay cho `app` được tạo ngay khi import. Cấu hình được nạp từ một hàm duy nhất: `.env` được đọc trước mọi import khác, không có giá trị fallback hardcode cho secret nào, và server từ chối khởi động khi cấu hình sai. Đây là prefactor cho seam test 1 (factory) và seam 2 (hàm nạp cấu hình) trong spec, đồng thời đóng SEC-02.

Spec: [`../spec.md`](../spec.md), mục *Tổng quan kiến trúc* và *Testing Decisions → Các seam*.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Có hàm nạp cấu hình nhận object biến môi trường và trả về cấu hình có kiểu, hoặc ném lỗi liệt kê **mọi** biến sai. Không module nào khác đọc thẳng `process.env`.
- [x] `.env` được nạp trước mọi import khác của entrypoint. Giá trị trong `.env` thực sự có hiệu lực (B1).
- [x] Không còn secret mặc định hardcode. Thiếu `JWT_SECRET` hoặc `JWT_SECRET` ngắn hơn 32 byte thì báo lỗi ở **mọi** môi trường. Đây là bước tạm, ticket 10 sẽ gỡ hẳn JWT.
- [x] `APP_ORIGIN` và `DATABASE_URL` bắt buộc ở mọi môi trường (riêng test được dùng `DATABASE_URL=memory:`).
- [x] Ở `NODE_ENV=production`: `STORAGE_PROVIDER` là `local` hoặc để trống thì báo lỗi; thiếu `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET` hoặc secret key Supabase thì báo lỗi; thiếu build client thì báo lỗi.
- [x] Ngưỡng rate limit, TTL và các tham số thời gian (ví dụ grace period của Presence) đi qua cấu hình, có giá trị mặc định và test ghi đè được.
- [x] Factory trả về server HTTP đã gắn Express và Socket.IO. Entrypoint production chỉ nạp cấu hình, dựng storage adapter, gọi factory rồi listen.
- [x] Có storage adapter in-memory cho test.
- [x] Mọi test server hiện có được chuyển sang dựng server qua factory và vẫn pass.
- [x] Test qua seam 2 cho từng trường hợp fail-fast nêu trên. Test B1 tái hiện audit: fail trên mã cũ, pass sau khi sửa.
