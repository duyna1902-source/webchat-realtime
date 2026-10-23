# 18: Cập nhật dependency

**What to build:** Các dependency có lỗ hổng đã công bố được nâng lên bản vá nếu có. Rủi ro còn lại được ghi nhận có chủ đích, để kết quả `npm audit` phản ánh các quyết định đã cân nhắc. Đóng SEC-16.

Spec: [`../spec.md`](../spec.md), mục *Dependency*. Quyết định Q37 trong [`../decisions.md`](../decisions.md).

**Blocked by:** 03 (Prisma Migrate baseline, RLS và khung lệnh nâng cấp dữ liệu)

**Status:** resolved

- [x] `prisma`, `@prisma/client` và `@prisma/adapter-pg` được nâng lên bản vá mới nhất trong major 7. Kiểm tra lại xem các advisory `mysql2` và `deepmerge-ts` đã được đóng chưa.
- [x] Các gói chỉ dùng lúc build hoặc chỉ cho kiểu (`@types/*`, `typescript`, Prisma CLI nếu khả thi) chuyển sang `devDependencies`. Build trên Render (`npm install --include=dev`) vẫn chạy.
- [x] Tailwind v3 được giữ nguyên. Rủi ro còn lại (`braces`, `micromatch`, `postcss-*`: DoS lúc build, đầu vào là mã nguồn của dự án) được ghi vào danh sách rủi ro chấp nhận, để ticket 19 chép vào `SECURITY.md`.
- [x] Kết quả `npm audit` sau khi cập nhật được ghi vào phần Comments của ticket, kèm giải thích cho mọi mục còn lại.
- [x] Toàn bộ test server và client pass. `npm run build` của cả workspace thành công.

## Comments

### 2026-10-23: kết quả triển khai (branch `cyber/18-dependency-updates`)

**Thay đổi**

- `prisma`, `@prisma/client`, `@prisma/adapter-pg`: 7.10.0 → **7.10.1** (bản mới nhất của major 7; khai báo `^7.10.1` trong `server/package.json`). `allowScripts` ở `package.json` gốc đổi sang `prisma@7.10.1` và `@prisma/engines@7.10.1`.
- Hai advisory của Prisma **đã đóng**: `prisma@7.10.1` kéo `mysql2@3.24.4` (vá GHSA-3f6p-5ww8-9rcr và GHSA-rgwj-5xj2-c3m3, cần `>3.23.0`), còn `@prisma/config@7.10.1` kéo `deepmerge-ts@8.0.2` (vá GHSA-ggr8-5vv4-36mx, cần `>=8.0.0`).
- Chuyển sang `devDependencies`:
  - gốc: `typescript`.
  - server: `@types/bcryptjs`, `@types/express`, `@types/jsonwebtoken`, `@types/multer`, `@types/node`, `@types/pg`, `typescript`.
  - client: `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `autoprefixer`, `postcss`, `tailwindcss`, `typescript`, `vite`. Client là SPA được bundle lúc build, nên các gói này chỉ dùng lúc build.
- **Giữ `prisma` (CLI) trong `dependencies`**, vì chuyển nó là không khả thi. Lệnh start trên Render chạy `prisma migrate deploy` (ticket 03), và `postinstall` ở gốc chạy `prisma generate` để sinh `@prisma/client`. Nếu `prisma` nằm trong devDependencies thì mọi lần cài bỏ dev (`npm ci --omit=dev`) sẽ hỏng ngay ở `postinstall`, và server không migrate được lúc start.
- Tailwind giữ nguyên v3.4.19 (Q37). Không đụng đến gói nào khác.

**Kiểm tra build trên Render:** chạy `NODE_ENV=production npm ci --include=dev && npm run build` (giống `buildCommand` trong `render.yaml`) thì thành công, và `prisma --version` vẫn chạy trong workspace server. Toàn bộ test server (24 file, 209 test, sau khi merge ticket 02) và client (15 file, 166 test) pass, `npm run build` thành công.

**`npm audit`**

| | Tổng | critical | high | moderate |
|---|---|---|---|---|
| Trước (lockfile ở `integration/cyber-upgradation`) | 17 | 2 | 10 | 5 |
| Sau (`npm audit`) | 13 | 2 | 6 | 5 |
| Sau (`npm audit --omit=dev`, phần chạy ở production) | **0** | 0 | 0 | 0 |

Các mục đã hết: `mysql2`, `deepmerge-ts`, `@prisma/config`, `prisma`.

Giải thích cho từng mục còn lại (tất cả đều chỉ nằm trong `devDependencies`, không có trong bản deploy):

1. **Chuỗi Tailwind v3**: `braces` (high, GHSA-vfj7-8cjw-p6xm), `micromatch`, `fast-glob`, `chokidar` (bản lồng trong `tailwindcss`), `tailwindcss`, `postcss-nested`, `postcss-selector-parser` (moderate, GHSA-rj75-hqrm-r3gf).
   - Đây là DoS (stack exhaustion, độ phức tạp bậc hai) xảy ra **lúc build**. Đầu vào là glob `content` và CSS của chính dự án, không phải dữ liệu từ User.
   - Cách vá duy nhất là lên Tailwind 4, thay đổi phá vỡ tương thích, đã được tách thành việc riêng (Q37). **Chấp nhận rủi ro.**
2. **Chuỗi Vitest 2**: `vitest`, `@vitest/mocker` (moderate, GHSA-82fw-gwwq-j7x9 và GHSA-qxg6-89mg-rqv8), `vite-node`, các bản `vite` và `esbuild` lồng bên trong (moderate, GHSA-67mh-4wv8-2f99), `tinypool` (critical, GHSA-5gmw-xhrv-c9v3 và GHSA-85c8-ppgw-ccpr).
   - Chúng chỉ chạy khi test (`vitest run`) trên máy dev hoặc CI, với mã test của chính dự án. Chế độ này không mở dev server hay mock server nào ra mạng.
   - Lỗi của `tinypool` cần kẻ tấn công kiểm soát được object option truyền vào worker trong chính process test.
   - Bản `vite` client dùng để build là 6.4.4, nằm ngoài vùng bị ảnh hưởng (`<=6.4.3`).
   - Cách vá là `vitest@5` (thay đổi phá vỡ tương thích, ngoài phạm vi ticket này). **Tạm chấp nhận** và đề xuất một ticket riêng để nâng Vitest.

**Danh sách rủi ro chấp nhận (để ticket 19 chép vào `SECURITY.md`)**

- **Tailwind v3** (`braces`, `micromatch`, `fast-glob`, `chokidar`, `postcss-nested`, `postcss-selector-parser`): DoS lúc build, đầu vào là mã nguồn của dự án, chỉ có trong devDependencies. Lên Tailwind 4 là việc riêng (Q37).
- **Vitest 2** (`vitest`, `@vitest/mocker`, `vite-node`, `vite`/`esbuild` lồng bên trong, `tinypool`): chỉ dùng khi chạy test, không deploy. Nên nâng lên Vitest 5 trong một ticket riêng.
- Kiểm tra định kỳ: `npm audit --omit=dev` phải ra 0 lỗ hổng.
