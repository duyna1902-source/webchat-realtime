# 07: Tự động Kết nối lại & Đồng bộ Tin nhắn Bỏ lỡ (Catch-up Sync)

**What to build:**
Cơ chế đảm bảo độ ổn định mạng và chống mất dữ liệu khi kết nối bị gián đoạn. Khi người dùng gặp sự cố mạng ngắn (dưới 2 phút), Socket.io tự động kết nối lại và khôi phục các sự kiện bị đệm (Connection State Recovery). Đối với trường hợp mất mạng dài hơn hoặc khi người dùng mở lại tab trình duyệt, client tự động kích hoạt quy trình Catch-up Sync qua REST API để kéo về toàn bộ tin nhắn mới phát sinh trong thời gian ngoại tuyến dựa trên mốc `lastMessageId`, đảm bảo không bỏ sót bất kỳ tin nhắn nào.

**Blocked by:** 02: Nhắn tin Trực tiếp 1-1 Thời gian thực & Lưu trữ Lịch sử Tin nhắn

**Status:** claimed

- [ ] Cấu hình `connectionStateRecovery` trên máy chủ Socket.io với thời gian đệm `maxDisconnectionDuration: 2 * 60 * 1000`.
- [ ] API Catch-up Sync cho Direct Chat (`GET /api/direct-chats/:id/messages?after=<lastMessageId>`) trả về toàn bộ tin nhắn mới hơn mốc tin nhắn chỉ định.
- [ ] API Catch-up Sync cho Room Chat (`GET /api/rooms/:id/messages?after=<lastMessageId>`) trả về toàn bộ tin nhắn mới của phòng kể từ mốc chỉ định.
- [ ] Client lắng nghe các sự kiện vòng đời socket (`connect`, `disconnect`, `connect_error`) và hiển thị banner trạng thái "Đang kết nối lại..." trên giao diện khi mất mạng.
- [ ] Khi socket kết nối lại sau gián đoạn, client tự động kiểm tra trạng thái khôi phục (`socket.recovered`); nếu không được phục hồi tự động, client kích hoạt Catch-up Sync để đồng bộ tin nhắn còn thiếu.
- [ ] Logic client tự động khử trùng lặp tin nhắn (deduplication) để đảm bảo không hiển thị hai lần một tin nhắn.
- [ ] Kiểm thử tích hợp giả lập ngắt mạng client, gửi tin nhắn từ phía khác, kết nối lại client và xác minh toàn bộ tin nhắn bị bỏ lỡ được đồng bộ đầy đủ.
