# 18: Cập nhật dependency

**What to build:** Các dependency có lỗ hổng đã công bố được nâng lên bản vá nếu có. Rủi ro còn lại được ghi nhận có chủ đích, để kết quả `npm audit` phản ánh các quyết định đã cân nhắc. Đóng SEC-16.

Spec: [`../spec.md`](../spec.md), mục *Dependency*. Quyết định Q37 trong [`../decisions.md`](../decisions.md).

**Blocked by:** 03 (Prisma Migrate baseline, RLS và khung lệnh nâng cấp dữ liệu)

**Status:** ready-for-agent

- [ ] `prisma`, `@prisma/client` và `@prisma/adapter-pg` được nâng lên bản vá mới nhất trong major 7. Kiểm tra lại xem các advisory `mysql2` và `deepmerge-ts` đã được đóng chưa.
- [ ] Các gói chỉ dùng lúc build hoặc chỉ cho kiểu (`@types/*`, `typescript`, Prisma CLI nếu khả thi) chuyển sang `devDependencies`. Build trên Render (`npm install --include=dev`) vẫn chạy.
- [ ] Tailwind v3 được giữ nguyên. Rủi ro còn lại (`braces`, `micromatch`, `postcss-*`: DoS lúc build, đầu vào là mã nguồn của dự án) được ghi vào danh sách rủi ro chấp nhận, để ticket 19 chép vào `SECURITY.md`.
- [ ] Kết quả `npm audit` sau khi cập nhật được ghi vào phần Comments của ticket, kèm giải thích cho mọi mục còn lại.
- [ ] Toàn bộ test server và client pass. `npm run build` của cả workspace thành công.
