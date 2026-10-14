# Công nghệ nền tảng và Chiến lược triển khai Free-Tier

Hệ thống yêu cầu chạy thực tế trên browser với chi phí 0 đồng (free services) và hỗ trợ kết nối hai chiều thời gian thực liên tục. Chúng tôi quyết định sử dụng Full-stack TypeScript với React (Vite) triển khai trên Vercel, Node.js + Socket.io chạy trên Render (Web Service), và PostgreSQL lưu trữ trên Neon/Supabase đi kèm Prisma ORM.

## Status
accepted

## Considered Options
- **Vercel Serverless + Pusher/Ably**: Vercel không hỗ trợ duy trì kết nối WebSocket lâu dài nên phải dùng dịch vụ trung gian ngoài (Pusher/Ably). Bị từ chối vì giới hạn tin nhắn nghiêm ngặt ở gói miễn phí và phụ thuộc bên thứ 3.
- **Node.js (Socket.io) trên Render + Neon/Supabase PostgreSQL (Được chọn)**: Render hỗ trợ persistent WebSocket connection ở gói free; Neon/Supabase cung cấp PostgreSQL miễn phí với độ tin cậy và tính toàn vẹn quan hệ cao.

## Consequences
- Do Render gói free sẽ tự động sleep sau 15 phút không có request HTTP, lần truy cập đầu tiên có thể mất khoảng 30-50 giây để khởi động (cold start). Client cần có UI hiển thị trạng thái đang kết nối máy chủ.
- Prisma ORM đảm bảo tính an toàn kiểu dữ liệu (type safety) từ schema cơ sở dữ liệu đến code backend.
