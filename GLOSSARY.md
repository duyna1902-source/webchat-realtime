# GDG-HUST Realtime Chat

Hệ thống nhắn tin hai chiều thời gian thực dành cho cộng đồng sinh viên công nghệ Google Developer Groups on Campus • Hanoi University of Science and Technology (GDG-HUST), hỗ trợ trò chuyện trực tiếp (1-1) và theo phòng (room chat).

## Language

**GDG Brand Identity**:
Tập hợp các yếu tố nhận diện chính thức của cộng đồng công nghệ `GDG-HUST`, bao gồm biểu trưng góc mở đóng (`<>` bracket mark), tiêu đề định danh rút gọn "GDG-HUST" và tên phân hiệu học xá đầy đủ "Google Developer Groups on Campus • Hanoi University of Science and Technology".
_Avoid_: Generic Chat Brand, Web Chat Real-Time

**Zero-Shift Auth Architecture**:
Kiến trúc bố cục giao diện xác thực không xê dịch, cố định chiều cao thẻ đăng nhập (rigid 540px card height), khung chứa biểu mẫu cố định (fixed 275px form container), và ghim nút hành động chính ở tọa độ cố định, đảm bảo 0px layout displacement (hoàn toàn không giật, nhảy khung hình) khi chuyển đổi qua lại giữa tab Đăng nhập và Đăng ký.
_Avoid_: Bouncing form layout, Variable-height auth card, Dynamic auth jumping

**Google Palette Semantics**:
Hệ thống mã màu chuẩn hóa theo ngôn ngữ thiết kế Google áp dụng xuyên suốt ứng dụng, gồm Google Blue (`#4285F4` - hành động chính, tab kích hoạt, bong bóng tin nhắn đi), Google Red (`#EA4335` - cảnh báo, đăng xuất, xóa phòng), Google Yellow (`#FBBC04` - vai trò phòng, cảnh báo kết nối lại), Google Green (`#34A853` - trạng thái trực tuyến, kết nối socket), và Google Greys (`#F1F3F4` / `#F8F9FA` / `#202124` - nền giao diện, bong bóng tin nhắn đến và màu chữ).
_Avoid_: Indigo theme, Generic palette, Custom arbitrary hex colors

**Deterministic 4-Color Avatar**:
Hệ thống gán màu đại diện người dùng tự động dựa trên hàm băm (hash) tên đăng nhập hoặc mã người dùng, phân bổ đều và nhất quán theo bốn gam màu chủ đạo của Google (Blue, Red, Yellow, Green) khi người dùng chưa thiết lập ảnh đại diện cá nhân.
_Avoid_: Monocolor avatar, Random avatar colors, Server-stored color flags

**Ultra-Compact Header**:
Thanh tiêu đề điều hướng tối giản với chiều cao cố định siêu gọn 42px (`h-11`), hiển thị biểu trưng và tên thương hiệu trên một dòng duy nhất (`whitespace-nowrap`), kết hợp chỉ báo kết nối chấm tròn xanh 8px và nút đăng xuất tinh gọn, giúp tối đa hóa không gian hiển thị nội dung trò chuyện (Maximal Chat Workspace) chiếm trên 85% chiều cao màn hình di động.
_Avoid_: Bloated multi-line header, Stacked navigation bar


**User**:
Tài khoản người dùng đã được định danh và xác thực qua một Session còn hiệu lực.
_Avoid_: Account, Client, Profile

**Session**:
Phiên đăng nhập của một User trên một thiết bị, bắt đầu khi đăng nhập và kết thúc khi đăng xuất, hết hạn, hoặc bị thu hồi. Một User có thể có nhiều Session cùng lúc; thu hồi một Session chỉ đăng xuất thiết bị đó, còn "đăng xuất mọi thiết bị" thu hồi toàn bộ Session của User.
_Avoid_: Token, Login, Connection

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

**Message Character Limit**:
Hạn mức ký tự tối đa cho phép trong một lần gửi tin nhắn nhằm ngăn chặn tình trạng phát tán nội dung rác hoặc quá tải, áp dụng 4000 ký tự cho Direct Chat và Room Chat cấp quản trị (OWNER, ADMIN), và 2000 ký tự cho Room Chat cấp thành viên (MEMBER).
_Avoid_: Message length quota, Text cap, Max characters

**Presence**:
Trạng thái kết nối mạng của người dùng (trực tuyến - Online hoặc ngoại tuyến - Offline).
_Avoid_: Status, User Status, Availability

**Typing Indicator**:
Tín hiệu tạm thời phát theo thời gian thực thông báo một người dùng đang soạn thảo nội dung.
_Avoid_: Typing Status, Drafting

**Read Receipt**:
Dấu mốc ghi nhận trạng thái người nhận đã xem một tin nhắn cụ thể, được định danh thông qua `lastReadMessageId`.
_Avoid_: Seen, Message Seen, Delivered Status

**Delivery Status**:
Trạng thái chuyển phát của một Direct Message từ phía người gửi tới người nhận theo ba nấc: đã gửi lên hệ thống (`SENT`), đã chuyển tới người nhận đang trực tuyến (`DELIVERED`), và người nhận đã mở xem (`READ`).
_Avoid_: Message State, Ack Status

**Unread Count Badge**:
Con số hiển thị tổng lượng tin nhắn mới chưa được người dùng xem trong một Direct Chat hoặc Room Chat, tính từ sau dấu mốc `Read Receipt` gần nhất của người dùng đó.
_Avoid_: Notification Counter, Unseen Badge

**Attachment**:
Tệp đính kèm (hình ảnh, tài liệu) được lưu trữ trên cloud lưu trữ ngoài và gắn vào một tin nhắn. Quyền xem một Attachment đi theo quyền truy cập cuộc trò chuyện chứa nó: chỉ Direct Chat Participant hoặc Room Member hiện tại mới xem được, và người đã rời hoặc bị kick sẽ mất quyền xem.
_Avoid_: File, Media, Upload, Public link

**Document Preview**:
Khả năng xem trực tiếp nội dung hoặc thông tin tóm tắt của tệp tài liệu đính kèm ngay trong không gian ứng dụng trước hoặc thay cho việc tải tệp về thiết bị.
_Avoid_: External File Opener, Forced Download

**Room Member**:
Bản ghi thành viên tham gia vào một Room Chat với vai trò xác định (`Room Role`).
_Avoid_: Participant (dùng cho Room), User (khi nói về quyền trong phòng)

**Room Role**:
Phân cấp vai trò quản trị trong Room Chat gồm `OWNER` (chủ phòng), `ADMIN` (quản trị viên), và `MEMBER` (thành viên thông thường).

**Direct Chat Participant**:
Bản ghi liên kết giữa người dùng và một Direct Chat để quản lý vị trí đọc (`lastReadMessageId`) của từng người.

**Connection State Recovery**:
Cơ chế của Socket.io tự động khôi phục các sự kiện/gói tin bị gián đoạn trong thời gian mất mạng tạm thời ngắn. Cơ chế này chỉ khôi phục gói tin, không khôi phục quyền: danh tính và tư cách thành viên của người dùng vẫn được kiểm tra lại khi kết nối được khôi phục.

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
