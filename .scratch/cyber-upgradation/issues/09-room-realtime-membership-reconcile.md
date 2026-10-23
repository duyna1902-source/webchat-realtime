# 09: Đồng bộ membership realtime của room

**What to build:** Room Member đã rời room, hoặc bị OWNER/ADMIN kick, ngừng nhận Room Message, Typing Indicator và Read Receipt của room đó ngay lập tức. Điều này đúng cả khi người bị kick đang mất mạng ngắn rồi được Connection State Recovery khôi phục kết nối. Đóng SEC-06.

Spec: [`../spec.md`](../spec.md), mục *Quyền realtime trong room*.

**Blocked by:** 01 (Server factory và module cấu hình)

**Status:** resolved

- [x] Rời room đồng bộ membership của mọi socket của User đó, cho socket rời room realtime của Room, giống cách thêm và kick thành viên đang làm.
- [x] Khi một socket được khôi phục qua Connection State Recovery, server đối chiếu mọi room realtime mà socket đang ở với danh sách Room Member trong DB, và cho socket rời các room không còn quyền **trước khi** socket nhận thêm event nào.
- [x] Không thêm bước kiểm tra membership trước mỗi lần broadcast.
- [x] Test hồi quy qua seam 1: A21 (carol rời room, alice gửi tin, carol không nhận `room:receive`). B2 (carol mất transport, bị kick lúc đang offline, kết nối lại với `recovered = true`, alice gửi tin, carol không nhận). Cả hai fail trên mã cũ và pass sau khi sửa.
- [x] Test xác nhận Typing Indicator và Read Receipt của room cũng không còn tới người đã rời.
- [x] Test xác nhận một Room Member hợp lệ được khôi phục kết nối vẫn nhận tin bình thường.
