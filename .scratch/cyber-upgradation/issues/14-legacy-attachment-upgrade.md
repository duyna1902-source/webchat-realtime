# 14: Nâng cấp Attachment cũ

**What to build:** Tin nhắn cũ trên production được chuyển sang mô hình Attachment mới:
- Tin có file thật trong bucket vẫn xem được qua signed URL.
- Tin có URL không an toàn hoặc không thuộc bucket được gỡ phần đính kèm, nhưng vẫn giữ nội dung chữ và hiển thị "Tệp đính kèm không còn khả dụng".
- Object trong bucket không được Attachment nào tham chiếu, có thể do kẻ khác đặt vào bằng key đã lộ, bị xóa.

Spec: [`../spec.md`](../spec.md), mục *Thay đổi schema DB → Lệnh nâng cấp dữ liệu* (các bước 4, 5, 6, 8, 9).

**Blocked by:** 13 (Bản ghi Attachment và signed URL)

**Status:** ready-for-agent

- [ ] Lệnh nâng cấp dữ liệu có thêm các bước:
  - Tin có URL đính kèm trỏ đúng bucket của dự án được tạo bản ghi Attachment với `uploaderId` là người gửi. `kind` theo `MessageType`. `mimeType` lấy từ metadata của object, không có thì là `application/octet-stream`. `originalName` cắt còn ≤255 ký tự. `size` âm hoặc không có thì đặt bằng 0.
  - Tin có URL đính kèm không thuộc bucket (`javascript:`, domain lạ, rỗng) bị gỡ đính kèm, `content` được giữ nguyên.
  - Tin `EMOJI_GIF` có URL không thuộc host Giphy chuyển thành `TEXT`, cùng cờ đính kèm không khả dụng.
  - Xóa mọi object trong bucket không được Attachment nào tham chiếu.
  - Báo cáo in số tin bị gỡ đính kèm và số object bị xóa.
- [ ] DTO tin nhắn có `attachment: null` và `attachmentUnavailable: true` cho những tin đã bị gỡ đính kèm.
- [ ] Client hiển thị "Tệp đính kèm không còn khả dụng" cho các tin đó, phần chữ vẫn hiện bình thường.
- [ ] Test qua seam 3: dữ liệu rác có `attachmentUrl` dạng `javascript:`, domain lạ và URL hợp lệ của bucket; `attachmentSize` âm; GIF không thuộc Giphy; storage in-memory có cả object được tham chiếu lẫn object mồ côi. Kiểm tra:
  - `--dry-run` không đổi gì.
  - Chạy thật cho kết quả đúng quy tắc: object mồ côi bị xóa, object được tham chiếu vẫn còn.
  - Chạy lần hai không đổi gì.
- [ ] Test qua seam 4: tin có `attachmentUnavailable` hiển thị đúng thông báo.
