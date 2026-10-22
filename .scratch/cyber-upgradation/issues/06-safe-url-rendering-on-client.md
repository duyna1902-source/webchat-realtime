# 06: Render URL an toàn ở client

**What to build:** Không link, ảnh, GIF hay Document Preview nào trong tin nhắn có thể chạy mã khi User click hoặc xem. Mọi URL lấy từ tin nhắn chỉ được đưa vào `href`, `src`, iframe hoặc `window.open` sau khi qua một helper chỉ cho phép `https:` và `blob:` (cộng URL tương đối cùng origin ở dev). URL không an toàn thì không render link hay iframe. Đây là lớp phòng thủ phía client của SEC-03.

Spec: [`../spec.md`](../spec.md), mục *Attachment → Client* và *Testing Decisions → seam 4*.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Có helper URL an toàn dùng chung ở client.
- [ ] Mọi chỗ hiện đang dùng URL từ tin nhắn đều đi qua helper: thẻ tài liệu và nút Download, Document Preview (iframe PDF, `fetch` preview văn bản, các link), Image Lightbox, click mở GIF.
- [ ] URL bị từ chối thì Attachment hiển thị ở trạng thái không khả dụng thay cho một link hỏng.
- [ ] Test qua seam 4, render component tin nhắn: tin `DOCUMENT` với `attachmentUrl: "javascript:alert(1)"` và tên `report.pdf` không tạo ra `href`, `src` hay iframe nào mang scheme `javascript:`. Mở preview hay bấm Download đều không gọi `window.open` hay điều hướng với URL đó (A18).
- [ ] Test qua seam 4: tin `EMOJI_GIF` có `content` là `javascript:alert(1)` không gọi `window.open` khi click (A20).
- [ ] Test xác nhận URL `https://` hợp lệ vẫn hiển thị và mở được như trước.
