# Cấu trúc Monorepo và Hợp đồng Dữ liệu dùng chung

Hệ thống bao gồm ứng dụng web frontend và backend thời gian thực cần chia sẻ định dạng dữ liệu (DTO), enum và sự kiện Socket.io để đảm bảo an toàn kiểu dữ liệu (type-safety). Chúng tôi quyết định tổ chức dự án dưới dạng Monorepo với 3 phân vùng: `client/`, `server/`, và `shared/`.

## Status
accepted

## Considered Options
- **Hai repository độc lập (Polyrepo)**: Frontend và backend nằm ở 2 repo riêng. Bị từ chối vì việc đồng bộ các thay đổi về kiểu dữ liệu (DTO, Socket events) rất dễ bị lệch phiên bản và phát sinh lỗi runtime.
- **Monorepo (Được chọn)**: Toàn bộ code nằm trong một repository; thư mục `shared/` chứa các interface và enum dùng chung được cả client và server import trực tiếp.

## Consequences
- Đảm bảo tính toàn vẹn 100% về type giữa frontend và backend khi phát triển.
- Dễ dàng thiết lập CI/CD: Vercel trỏ vào thư mục `client`, Render trỏ vào thư mục `server`.
