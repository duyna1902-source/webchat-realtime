# 03: Prisma Migrate baseline, RLS và khung lệnh nâng cấp dữ liệu

**What to build:** Schema DB được quản lý bằng migration có version thay cho `db push`. Mọi bảng bật Row Level Security mà không có policy nào, nên Data API của Supabase không đọc được dữ liệu kể cả khi bị bật lại. Có sẵn khung **lệnh nâng cấp dữ liệu** (seam test 3), để các ticket sau thêm bước chuẩn hóa dữ liệu production vào.

Spec: [`../spec.md`](../spec.md), mục *Thay đổi schema DB*. Quyết định Q31 và Q42 trong [`../decisions.md`](../decisions.md).

**Blocked by:** 01 (Server factory và module cấu hình)

**Status:** resolved

- [x] Có migration `0_baseline` khớp đúng schema production hiện tại. Tài liệu có ghi bước `prisma migrate resolve --applied` cho production.
- [x] Schema SQL nạp cho PGlite trong test được sinh tự động từ Prisma schema bằng một script tái tạo được. Có ghi chú cấm sửa tay.
- [x] Có migration bật RLS trên **mọi** bảng, kể cả bảng quản lý migration của Prisma, mà không tạo policy. Prisma vẫn đọc và ghi bình thường.
- [x] Lệnh khởi động trên Render chạy `prisma migrate deploy` trước khi start server.
- [x] Có lệnh CLI nâng cấp dữ liệu nhận Prisma client và storage adapter. Lệnh có chế độ `--dry-run` không ghi gì, in báo cáo tổng hợp, và cho phép đăng ký các "bước" chạy theo thứ tự. Chạy lại lần hai không thay đổi gì.
- [x] Test qua seam 3: dựng PGlite theo baseline, áp các migration, rồi xác nhận mọi bảng có `relrowsecurity` bật. Chạy lệnh với một bước giả và xác nhận `--dry-run` không đổi DB, chạy thật thì đổi, chạy lần hai thì không đổi thêm.
- [x] Bộ test hiện có vẫn pass trên schema sinh tự động.
