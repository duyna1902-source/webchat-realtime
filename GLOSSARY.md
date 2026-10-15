# Web Chat Real-Time

Hệ thống nhắn tin hai chiều thời gian thực hỗ trợ trò chuyện trực tiếp (1-1) và theo phòng (room chat).

## Language

**User**:
Tài khoản người dùng đã được định danh và xác thực qua hệ thống bằng JWT.
_Avoid_: Account, Client, Profile

**Direct Chat**:
Không gian trò chuyện trực tiếp riêng tư giữa đúng hai người dùng độc lập.
_Avoid_: 1-1 Conversation, Private Message, DM

**Room Chat**:
Không gian trò chuyện nhóm dành cho nhiều người dùng, có người quản trị và quyền thêm/xóa thành viên.
_Avoid_: Group, Group Conversation, Channel

**Direct Message**:
Bản ghi tin nhắn thuộc về một Direct Chat cụ thể, được lưu trữ và đồng bộ giữa hai người tham gia.
_Avoid_: Chat Message, Message (khi cần phân biệt với Room Message)

**Room Message**:
Bản ghi tin nhắn thuộc về một Room Chat cụ thể, được phát tán và lưu trữ cho các thành viên trong phòng.
_Avoid_: Group Message, Broadcast Message

**Presence**:
Trạng thái kết nối mạng của người dùng (trực tuyến - Online hoặc ngoại tuyến - Offline).
_Avoid_: Status, User Status, Availability

**Typing Indicator**:
Tín hiệu tạm thời phát theo thời gian thực thông báo một người dùng đang soạn thảo nội dung.
_Avoid_: Typing Status, Drafting

**Read Receipt**:
Dấu mốc ghi nhận trạng thái người nhận đã xem một tin nhắn cụ thể, được định danh thông qua `lastReadMessageId`.
_Avoid_: Seen, Message Seen, Delivered Status

**Attachment**:
Tệp đính kèm (hình ảnh, tài liệu) được lưu trữ trên cloud lưu trữ ngoài (Cloudinary / Supabase Storage) và liên kết vào tin nhắn thông qua URL.
_Avoid_: File, Media, Upload

**Room Member**:
Bản ghi thành viên tham gia vào một Room Chat với vai trò xác định (`Room Role`).
_Avoid_: Participant (dùng cho Room), User (khi nói về quyền trong phòng)

**Room Role**:
Phân cấp vai trò quản trị trong Room Chat gồm `OWNER` (chủ phòng), `ADMIN` (quản trị viên), và `MEMBER` (thành viên thông thường).

**Direct Chat Participant**:
Bản ghi liên kết giữa người dùng và một Direct Chat để quản lý vị trí đọc (`lastReadMessageId`) của từng người.

**Connection State Recovery**:
Cơ chế của Socket.io tự động khôi phục các sự kiện/gói tin bị gián đoạn trong thời gian mất mạng tạm thời ngắn.

**Catch-up Sync**:
Quy trình client gọi REST API để kéo lại toàn bộ tin nhắn bị bỏ lỡ sau khi kết nối mạng phục hồi từ gián đoạn dài.

**Cursor-based Pagination**:
Cơ chế phân trang tải lịch sử tin nhắn sử dụng mốc con trỏ thời gian hoặc ID tin nhắn (mặc định 50 tin nhắn mới nhất và tải thêm khi cuộn lên).
_Avoid_: Offset Pagination

**Presence Grace Period**:
Khoảng thời gian đệm (5 giây) trước khi chuyển trạng thái người dùng sang Offline khi ngắt kết nối, nhằm tránh nhấp nháy khi tải lại trang.

**Master-Detail Navigation**:
Cơ chế điều hướng hiển thị luân phiên giữa danh sách hội thoại (Master) và không gian trò chuyện chi tiết (Detail) trên màn hình hẹp (mobile) mà không làm gián đoạn kết nối thời gian thực.
_Avoid_: Multi-column mobile layout, Split-screen mobile

**Dynamic Viewport Height**:
Đơn vị chiều cao động của màn hình web (`100dvh`), tự động co giãn theo sự xuất hiện của thanh công cụ trình duyệt và bàn phím ảo trên thiết bị di động.
_Avoid_: Fixed 100vh on mobile

**Dual-Pane Desktop Layout**:
Bố cục giao diện hiển thị đồng thời hai cột song song trên màn hình máy tính (>= 768px): cột danh sách hội thoại cố định bề rộng và cột không gian trò chuyện chi tiết co giãn.
_Avoid_: Single-pane desktop, Fullscreen sidebar on desktop

**Persistent Detail View**:
Cơ chế duy trì hiển thị cuộc trò chuyện đang mở tại cột chi tiết khi người dùng duyệt qua lại giữa các tab danh mục ở cột danh sách, chỉ chuyển đổi khi người dùng chọn một cuộc trò chuyện hoặc phòng mới.
_Avoid_: Tab-resetting view, Fleeting chat view
