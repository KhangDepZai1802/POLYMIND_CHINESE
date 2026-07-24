# UI/UX Governance

## 1. Nguyên tắc bắt buộc

- Đọc đầy đủ skill `ui-ux-pro-max` trước khi thực hiện.
- Ưu tiên rõ ràng, nhanh, dễ sử dụng và hạn chế nhầm lẫn hơn hiệu ứng trang trí.
- Giữ nguyên kiến trúc, nghiệp vụ, database, migration, API contract, route và phân quyền.
- Không xóa, đổi tên, thay đổi nhãn, thay đổi validation hoặc bổ sung chức năng ngoài phạm vi.
- Chỉ thay đổi UI/UX trong module đang được giao.
- Không refactor phần không liên quan.
- Không tự sửa vấn đề nghiệp vụ; chỉ ghi nhận trong `07_UIUX_ISSUES_LOG.md`.
- Không làm yếu lint, type-check hoặc build.
- Không thêm ignore, disable rule hoặc workaround để che lỗi.

## 2. Màu sắc và nhận diện

- Bắt buộc xác định màu chủ đạo hiện tại từ source code, theme hoặc design token.
- Không thay màu thương hiệu.
- Không áp dụng nguyên bảng màu mặc định của skill.
- Chỉ được điều chỉnh sắc độ, contrast, background, text, border và interaction state.
- Primary, sidebar, navigation, button chính và accent phải tiếp tục dựa trên màu chủ đạo hiện tại.
- Khi cần, tạo thang màu `50–950` từ màu chủ đạo.
- Success, warning, error và info phải phân biệt rõ nhưng hài hòa với theme.
- Không dùng màu làm tín hiệu trạng thái duy nhất; phải có icon, text hoặc label.
- Contrast tối thiểu WCAG AA.
- Không dùng chữ xám quá nhạt trên nền trắng.
- Không lạm dụng primary gây mất phân cấp.

## 3. Icon và tương tác

- Không dùng emoji làm icon.
- Dùng thư viện icon hiện tại; ưu tiên Lucide nếu dự án đã dùng.
- Không cài icon library mới nếu thư viện hiện tại đáp ứng.
- Touch target tối thiểu 44x44px khi phù hợp.
- Phải có hover, focus, active, loading, empty, error, success và disabled.
- Focus state phải rõ khi dùng bàn phím.
- Animation chỉ hỗ trợ phản hồi thao tác, thời lượng 150–300ms.
- Không dùng gradient, glassmorphism, neumorphism hoặc hiệu ứng trang trí lệch nhận diện.

## 4. Responsive

- Không tạo horizontal scroll ở cấp trang.
- Bảng dữ liệu được phép cuộn trong vùng bảng khi thật sự cần.
- Trên màn hình nhỏ phải chọn một trong các giải pháp:
  - Ẩn cột phụ.
  - Chuyển hàng thành card.
  - Giữ bảng và cuộn riêng trong container.
- Mỗi màn hình phải kiểm tra tối thiểu:
  - Mobile: khoảng 360–430px.
  - Tablet: khoảng 768–1024px.
  - Desktop: từ 1280px.
- Không đánh dấu hoàn thành nếu chưa ghi kết quả responsive.

## 5. Quy trình toàn dự án

### Phase 0 — Khởi tạo

1. Đọc skill.
2. Khảo sát framework, UI library, icon library, CSS framework và token.
3. Lập `03_UIUX_MODULE_INVENTORY.md` từ sidebar, route và cấu trúc source.
4. Xác định màu chủ đạo bằng bằng chứng source.
5. Soạn `02_UIUX_DESIGN_SYSTEM.md`.
6. Tạo thứ tự module trong `04_UIUX_MODULE_BOARD.md`.

Phase 0 không được tự ý sửa UI nếu design system chưa được ghi nhận.

### Phase 1 — Thực hiện theo module

Mỗi module phải đi theo chu trình:

1. Đọc checkpoint và báo cáo module.
2. Khảo sát riêng module.
3. Liệt kê vấn đề có bằng chứng.
4. Đề xuất style và component behavior cho module.
5. Chia module thành từng màn hình hoặc nhóm component nhỏ.
6. Chỉ triển khai một màn hình hoặc một nhóm nhỏ mỗi lượt.
7. Sau mỗi màn hình:
   - Cập nhật báo cáo module.
   - Ghi file và component thay đổi.
   - Ghi vấn đề đã xử lý.
   - Ghi responsive.
   - Chạy kiểm tra phù hợp.
   - Cập nhật checkpoint ngay.
8. Khi module hoàn tất:
   - Chạy lint.
   - Chạy type-check.
   - Chạy build.
   - Cập nhật board, changelog và checkpoint.
9. Chỉ sau đó mới chuyển module tiếp theo.

## 6. Điều kiện hoàn thành module

Module chỉ được đánh dấu `DONE` khi:

- Tất cả màn hình trong phạm vi đã hoàn thành.
- Không thay business logic, API, route, database hoặc phân quyền.
- Responsive đã kiểm tra.
- Keyboard focus và trạng thái tương tác đã kiểm tra.
- Loading, empty, error, disabled và success state đã được xử lý hoặc xác nhận không áp dụng.
- Lint pass.
- Type-check pass.
- Build pass.
- Báo cáo module đầy đủ.
- Changelog và checkpoint đã cập nhật.

Nếu một kiểm tra không chạy được do lỗi có sẵn ngoài phạm vi, phải ghi rõ lệnh, lỗi, bằng chứng và trạng thái `BLOCKED`; không được báo pass.

## 7. Trạng thái chuẩn

- `NOT_STARTED`
- `AUDITING`
- `PROPOSAL_READY`
- `IMPLEMENTING`
- `VERIFYING`
- `BLOCKED`
- `DONE`

Chỉ một module được có trạng thái `AUDITING`, `IMPLEMENTING` hoặc `VERIFYING` tại một thời điểm.
