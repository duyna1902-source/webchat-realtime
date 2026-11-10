# Cấu trúc Monorepo và Hợp đồng Dữ liệu dùng chung

Hệ thống bao gồm ứng dụng web frontend và backend thời gian thực cần chia sẻ định dạng dữ liệu (DTO), enum và sự kiện Socket.io để đảm bảo an toàn kiểu dữ liệu (type-safety). Chúng tôi quyết định tổ chức dự án dưới dạng Monorepo với 3 phân vùng: `client/`, `server/`, và `shared/`.

## Status
accepted

## Considered Options
- **Hai repository độc lập (Polyrepo)**: Frontend và backend nằm ở 2 repo riêng. Bị từ chối vì việc đồng bộ các thay đổi về kiểu dữ liệu (DTO, Socket events) rất dễ bị lệch phiên bản và phát sinh lỗi runtime.
- **Monorepo (Được chọn)**: Toàn bộ code nằm trong một repository; thư mục `shared/` chứa các interface và enum dùng chung được cả client và server import trực tiếp.
- **Tự động build `shared` trước khi chạy dev, kèm watcher `tsc -w`**: Server phát triển tiếp tục đọc bản build `shared/dist/`, được build trước khi chạy dev và giữ cập nhật bằng một tiến trình watcher. Bị từ chối vì: bản build có thể cũ so với mã nguồn mà không ai nhận ra; watcher chạy đua với bộ tự nạp lại của `tsx watch`, nên server có thể nạp lại giữa lúc bản build đang được ghi; nó thêm một tiến trình vào đầu ra dev; và nó hỏng khi cài đặt với lifecycle script bị tắt (`--ignore-scripts`). Thay vào đó, phát triển đọc `shared` từ mã nguồn (xem Consequences).

## Consequences
- Đảm bảo tính toàn vẹn 100% về type giữa frontend và backend khi phát triển.
- Dễ dàng thiết lập CI/CD: một lệnh `npm run build` ở gốc repo build lần lượt `shared`, `server` và `client`. Ban đầu dự kiến Vercel trỏ vào thư mục `client` và Render trỏ vào thư mục `server`; từ [ADR 0010](./0010-single-host-render-with-session-cookie.md), chỉ còn Render build toàn bộ monorepo và phục vụ cả SPA lẫn API.
- **Phát triển đọc `shared` từ mã nguồn, chỉ production dùng bản build.** Khi phát triển, chạy test và chạy lệnh vận hành, `@webchat/shared` được đọc từ `shared/src/`; chỉ `npm run build` và server production (`node dist/index.js`) dùng `shared/dist/`. Client và các test runner giữ alias trỏ vào mã nguồn. Server dùng export condition `@webchat/source` (đứng trước `types`, `import` và `default` trong `exports` của `shared/package.json`), và mọi script server chạy qua `tsx` đều truyền `--conditions=@webchat/source`; `npm test` kiểm tra điều này và nêu tên script thiếu. Tên condition có tiền tố riêng của dự án vì `--conditions` áp dụng cho mọi package trong tiến trình. Mapping `paths` cho `@webchat/shared` trong `server/tsconfig.json` đã bị bỏ, vì `tsx` ưu tiên nó hơn export condition nên chạy bản build hễ `shared/dist/` tồn tại; TypeScript giờ lấy kiểu qua export `types`. Hook `postinstall` vẫn build `shared` để editor có kiểu, nhưng ứng dụng không phụ thuộc vào bước này. Quyết định này dễ đảo ngược nên không cần ADR riêng.
