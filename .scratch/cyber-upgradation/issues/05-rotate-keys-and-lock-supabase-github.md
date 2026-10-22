# 05: Xoay vòng key và khóa Supabase, GitHub

**What to build:** Mọi key đã lộ trên GitHub public trở nên vô dụng. Data API của Supabase không còn mở bảng dữ liệu nào ra ngoài. GitHub tự chặn secret bị push và có kênh báo lỗ hổng riêng tư. Đây là các thao tác trên dashboard, thuộc phần hạ tầng của SEC-01 và Q42.

Spec: [`../spec.md`](../spec.md), mục *Quy trình và tài liệu → Checklist thủ công cho người vận hành* (các bước 1, 2, 3, 5, 6).

**Blocked by:** 04 (Secret key Supabase và vệ sinh secret trong repo)

**Status:** ready-for-human

- [ ] Supabase: tạo secret key mới (`sb_secret_…`) và đặt vào `SUPABASE_SECRET_KEY` trên Render, sau khi bản deploy chứa ticket 04 đã chạy.
- [ ] Xác nhận upload trên production vẫn hoạt động với key mới.
- [ ] Supabase: deactivate hai legacy key `anon` và `service_role`.
- [ ] Supabase: tắt Data API. Nếu không tắt hẳn được thì bỏ `public` khỏi danh sách schema được expose. Kiểm tra lại: `GET /rest/v1/User` bằng key mới phải trả lỗi hoặc danh sách rỗng.
- [ ] Render: xóa các biến key Supabase cũ, đặt `APP_ORIGIN=https://webchat-realtime.onrender.com`, xác nhận các biến `sync: false` đã có giá trị.
- [ ] GitHub: bật Secret scanning, Push protection và Private vulnerability reporting.
- [ ] (Khuyến nghị) Xem log API và Storage của Supabase để tìm truy cập lạ dùng key `service_role`, rồi ghi kết quả vào phần Comments của ticket này.
