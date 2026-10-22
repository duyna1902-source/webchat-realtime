# 08: Hồ sơ công khai và tìm kiếm có giới hạn

**What to build:** Email của User chỉ hiển thị cho chính chủ. Mọi nơi khác (danh sách user, danh sách Room Member, partner của Direct Chat, sender của tin nhắn) chỉ thấy hồ sơ công khai. Tìm kiếm User bắt buộc có từ khóa, chỉ khớp theo username và trả về số kết quả có giới hạn, nên không thể dò cả danh bạ hay dò email. Đóng SEC-13.

Spec: [`../spec.md`](../spec.md), mục *Quyền riêng tư User*.

**Blocked by:** 07 (Validation dùng chung, quy tắc tài khoản và room)

**Status:** ready-for-agent

- [ ] Có hai DTO tách biệt, định nghĩa trong `shared`:
  - `SelfUserDto` có email, chỉ trả ở `/api/auth/me`, register và login.
  - `PublicUserDto` gồm `{ id, username, isOnline, lastSeenAt }`, dùng ở mọi chỗ còn lại, kể cả payload socket.
- [ ] `GET /api/users` thiếu `q` hoặc `q` rỗng thì trả `400`. Có `q` thì khớp theo `username` không phân biệt hoa thường, không khớp theo email, và trả tối đa 20 kết quả.
- [ ] Client hiển thị đúng ở mọi chỗ trước đây có dùng email của người khác (nếu có).
- [ ] Test hồi quy qua seam 1: A11 (`/api/users` không chứa email, thiếu `q` trả `400`). Tìm theo một phần email không ra ai. Chi tiết room, danh sách Direct Chat và tin nhắn broadcast không chứa email của người khác.
