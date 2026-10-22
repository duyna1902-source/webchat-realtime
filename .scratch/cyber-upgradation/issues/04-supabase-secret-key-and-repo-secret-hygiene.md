# 04: Secret key Supabase và vệ sinh secret trong repo

**What to build:** Server dùng **secret key loại mới** của Supabase (gửi qua header `apikey`, không gửi qua Bearer), nên người vận hành có thể vô hiệu hóa các legacy key đã lộ mà upload không bị gãy. Blueprint deploy không còn chứa giá trị secret nào, và repo có hook chặn secret trước khi commit. Đây là phần code của SEC-01.

Spec: [`../spec.md`](../spec.md), mục *Tổng quan kiến trúc → Blueprint Render* và *Quy trình và tài liệu*.

**Blocked by:** 01 (Server factory và module cấu hình)

**Status:** ready-for-agent

- [ ] Storage adapter Supabase đọc `SUPABASE_SECRET_KEY` từ cấu hình và chỉ gửi key qua header `apikey`. Bỏ các biến `SUPABASE_SERVICE_ROLE_KEY` và `SUPABASE_ANON_KEY`.
- [ ] Xóa adapter Cloudinary cùng các biến cấu hình của nó.
- [ ] Trong blueprint Render, mọi secret (`DATABASE_URL`, `SUPABASE_SECRET_KEY`, `GIPHY_API_KEY`, `JWT_SECRET` cho tới khi ticket 10 gỡ nó) dùng `sync: false`. Không còn giá trị secret nào trong file. `APP_ORIGIN` được ghi dưới dạng giá trị thường.
- [ ] Có pre-commit hook `gitleaks`, kèm hướng dẫn cài đặt cho developer. Chạy `gitleaks` trên trạng thái hiện tại của repo không còn phát hiện nào, trừ các phát hiện trong lịch sử git đã được ghi nhận.
- [ ] `.env.example` phản ánh các biến mới.
- [ ] Test qua seam 1 với một adapter Supabase dùng `fetch` giả: request upload chỉ mang header `apikey` và không có `Authorization`.
