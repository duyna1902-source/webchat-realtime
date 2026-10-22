# Attachment riêng tư qua bản ghi server, bucket private và signed URL

Trước đây mỗi tin nhắn lưu một URL public của Attachment, và client tự khai URL, tên, kích thước. Hệ quả là ai có link cũng xem được tệp, kể cả người đã bị kick, và client chèn được URL `javascript:` hay metadata dài vô hạn (SEC-03, SEC-14, SEC-15). Chúng tôi quyết định:
- Mỗi lần upload tạo một **bản ghi Attachment** do server quản lý, gắn với đúng một tin nhắn. Client chỉ gửi `attachmentId`.
- Tệp nằm trong **bucket private**, tin nhắn chỉ lưu `storageKey`.
- Server ký **signed URL có hạn** (TTL 1 giờ) cho Direct Chat Participant và Room Member hiện tại mỗi khi trả tin nhắn, kèm một endpoint làm mới URL có kiểm tra quyền.

ADR này thay thế phần "liên kết vào tin nhắn thông qua URL" của ADR 0004. Quyết định lưu trên cloud storage ngoài của ADR 0004 vẫn giữ nguyên.

## Status
accepted

## Considered Options
- **Giữ bucket public, chỉ kiểm tra URL thuộc bucket:** cách đơn giản nhất. Bị từ chối vì quyền xem tệp vẫn tách rời quyền vào cuộc trò chuyện, link bị lộ là xem được mãi.
- **Endpoint proxy `/api/attachments/:id` stream tệp qua server:** kiểm soát quyền tuyệt đối. Bị từ chối vì mọi byte ảnh phải đi qua Render free, tốn băng thông, và `<img>` không gửi được header xác thực (lúc đó app còn dùng Bearer token).
- **Bản ghi Attachment cùng signed URL (được chọn):** tệp vẫn tải thẳng từ Supabase, server chỉ ký URL. Quyền xem đi theo tư cách thành viên, chỉ trễ tối đa bằng TTL.

## Consequences
- Một người vừa bị kick vẫn có thể dùng URL đã nhận trong tối đa 1 giờ. Đây là đánh đổi có chủ đích để không phải proxy tệp.
- Client phải xử lý URL hết hạn bằng cách gọi endpoint làm mới khi ảnh hoặc preview tải lỗi.
- Không thể "chuyển tiếp" một Attachment sang cuộc trò chuyện khác. Muốn có tính năng đó thì phải sao chép tệp thành bản ghi mới.
- Dữ liệu cũ phải được chuyển: URL thuộc bucket thành bản ghi, phần còn lại bị gỡ.
