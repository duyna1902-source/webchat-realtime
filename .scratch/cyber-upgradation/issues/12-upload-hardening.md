# 12: Siết upload

**What to build:** User chỉ upload được các loại file trong allowlist. Loại file được xác định theo **nội dung thật** của file, không theo MIME client khai hay đuôi file. File HTML, SVG, file thực thi, ZIP và file giả dạng ảnh bị từ chối với thông báo rõ ràng. Ảnh được xóa EXIF (GPS, thiết bị) mà vẫn giữ đúng hướng xoay. File văn bản luôn được phục vụ dưới dạng văn bản thuần. Phần này đóng SEC-04 và phần kiểu file cùng EXIF của SEC-15.

Spec: [`../spec.md`](../spec.md), mục *Attachment → Upload*.

**Blocked by:** 02 (Lớp lỗi, `requestId` và logger nền)

**Status:** ready-for-agent

- [ ] Nhận diện loại file bằng magic bytes theo đúng bảng allowlist của spec:
  - Ảnh: JPEG, PNG, WebP, GIF.
  - Tài liệu: PDF, DOCX, XLSX, PPTX (chữ ký ZIP **và** cấu trúc OOXML bên trong), DOC, XLS, PPT (chữ ký OLE).
  - Văn bản: TXT, CSV, MD, JSON (UTF-8 hợp lệ, không có byte NUL).
- [ ] Loại khác bị từ chối với `415`. `Content-Type` khi lưu là loại thật phát hiện được, riêng văn bản luôn là `text/plain; charset=utf-8`.
- [ ] JPEG, PNG và WebP được re-encode qua `sharp`: xoay theo EXIF orientation trước rồi bỏ toàn bộ metadata. GIF không bị re-encode. Kích thước trả về là kích thước sau xử lý. Giới hạn 10MB giữ nguyên.
- [ ] Tên object trong storage không chứa tên gốc của file.
- [ ] Adapter `local` (chỉ dev và test) phục vụ file kèm `Content-Disposition: attachment` và `X-Content-Type-Options: nosniff`.
- [ ] Input file ở client có `accept` khớp allowlist. Upload bị từ chối thì hiện thông báo dễ hiểu.
- [ ] Test hồi quy qua seam 1:
  - A15: HTML khai `application/octet-stream` bị `415`.
  - A16: SVG có `<script>` bị `415`.
  - A17: `evil.php` khai `image/png` bị `415`.
  - JPEG có GPS EXIF sau upload không còn EXIF, và hướng xoay đúng.
  - `.csv` và `.md` được lưu và phục vụ với `text/plain`.
  - DOCX hợp lệ được chấp nhận. ZIP đổi đuôi thành `.docx` bị từ chối.
- [ ] Test qua seam 4: input file có thuộc tính `accept` đúng.
