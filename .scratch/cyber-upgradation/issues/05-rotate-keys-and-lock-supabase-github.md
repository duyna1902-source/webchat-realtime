# 05: Xoay vòng key và khóa Supabase, GitHub

**What to build:** Mọi key đã lộ trên GitHub public trở nên vô dụng. Data API của Supabase không còn mở bảng dữ liệu nào ra ngoài. GitHub tự chặn secret bị push và có kênh báo lỗ hổng riêng tư. Đây là các thao tác trên dashboard, thuộc phần hạ tầng của SEC-01 và Q42.

Spec: [`../spec.md`](../spec.md), mục *Quy trình và tài liệu → Checklist thủ công cho người vận hành* (các bước 1, 2, 3, 5, 6).

**Blocked by:** 04 (Secret key Supabase và vệ sinh secret trong repo)

**Status:** ready-for-human

- [x] Supabase: tạo secret key mới (`sb_secret_…`) và đặt vào `SUPABASE_SECRET_KEY` trên Render, sau khi bản deploy chứa ticket 04 đã chạy.
- [x] Xác nhận upload trên production vẫn hoạt động với key mới.
- [x] Supabase: deactivate hai legacy key `anon` và `service_role`.
- [x] Supabase: tắt Data API. Nếu không tắt hẳn được thì bỏ `public` khỏi danh sách schema được expose. Kiểm tra lại: `GET /rest/v1/User` bằng key mới phải trả lỗi hoặc danh sách rỗng.
- [x] Render: xóa các biến key Supabase cũ, đặt `APP_ORIGIN=https://webchat-realtime.onrender.com`, xác nhận các biến `sync: false` đã có giá trị.
- [x] GitHub: bật Secret scanning, Push protection và Private vulnerability reporting.
- [ ] (Khuyến nghị) Xem log API và Storage của Supabase để tìm truy cập lạ dùng key `service_role`, rồi ghi kết quả vào phần Comments của ticket này.

## Comments

- 2026-10-23: Đã tạo secret key `sb_secret_…` và đặt vào `SUPABASE_SECRET_KEY` trên Render; đã xóa `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` và đặt `APP_ORIGIN`. GitHub: đã bật Secret scanning, Push protection, Private vulnerability reporting (API xác nhận `enabled: true`). Còn lại: xác nhận upload với key mới, deactivate legacy key, tắt Data API, xem log Supabase.
- 2026-10-23: Upload ảnh trên production chạy với key mới. Legacy key `anon`/`service_role` đã bị tắt: `GET /rest/v1/User` bằng key `anon` cũ (lấy từ lịch sử git) trả `Legacy API keys are disabled`. Data API: `GET /rest/v1/User` bằng secret key mới trả `PGRST002`, không có dữ liệu. Còn lại (khuyến nghị): xem log API và Storage của Supabase.
