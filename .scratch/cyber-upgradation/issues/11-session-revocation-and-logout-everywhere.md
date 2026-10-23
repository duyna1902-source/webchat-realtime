# 11: Thu hồi Session và đăng xuất mọi thiết bị

**What to build:** User có thể "Đăng xuất mọi thiết bị" để cắt mọi Session khác của mình. Khi một Session bị thu hồi hoặc đạt hạn tối đa, mọi socket đang mở của Session đó bị ngắt ngay, nên không còn nhận tin. Người vận hành có lệnh CLI để thu hồi Session của một User hoặc của toàn bộ User khi xảy ra sự cố. Phần này hoàn tất SEC-11.

Spec: [`../spec.md`](../spec.md), mục *Session và xác thực* (Session store, xác thực socket, lệnh vận hành).

**Blocked by:** 10 (Đăng nhập bằng session cookie)

**Status:** resolved

- [x] `POST /api/auth/logout-all` trả `204`, thu hồi mọi Session của User (kể cả Session hiện tại) và xóa cookie.
- [x] Session store phát sự kiện khi Session bị thu hồi. Tầng socket ngắt mọi socket trong `session:<id>`, hoặc trong `user:<id>` khi thu hồi toàn bộ Session của User.
- [x] Mỗi socket tự ngắt đúng lúc Session đạt hạn absolute.
- [x] Có lệnh CLI phía server thu hồi Session theo User (username hoặc id) hoặc thu hồi tất cả, in ra số Session đã thu hồi.
- [x] Client có nút "Đăng xuất mọi thiết bị" cạnh nút đăng xuất. Bị ngắt do Session bị thu hồi thì client đưa về màn đăng nhập kèm thông báo rõ ràng.
- [x] Test qua seam 1:
  - Hai Session của cùng một User trên hai "thiết bị". `logout-all` từ một thiết bị thì socket ở thiết bị kia bị ngắt và cookie của nó bị `401`.
  - Logout một Session không ảnh hưởng Session còn lại.
  - Session đạt hạn absolute (TTL nhỏ qua cấu hình) thì socket bị ngắt.
  - Lệnh CLI thu hồi đúng phạm vi.
- [x] Test qua seam 4: nút "Đăng xuất mọi thiết bị" gọi đúng endpoint và đưa về màn đăng nhập.
