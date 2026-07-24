# M21 — Lớp của tôi (Học viên)

## 1. Phạm vi

- Route: `/student/class`; route cũ `/student/schedule` tiếp tục redirect.
- Một page gồm 7 tab read-only: Tổng quan, Lịch/Buổi, Bài tập, Kiểm tra, Tiến độ, Chuyên cần, Tài liệu.
- Source chính: `src/app/(dashboard)/student/class/page.tsx` (663 dòng trước sửa).
- Component dùng chung được **đọc nhưng không sửa**: `SessionCalendar` có consumer Admin/Teacher/Student. `MaterialList` chỉ có một consumer nhưng không có issue bằng chứng ở audit hiện tại nên giữ nguyên.
- Ngoài phạm vi: query/server, RLS, dữ liệu, route, navigation, validation, nhãn, công thức tiến độ/chuyên cần và các module M22–M27.

## 2. Bằng chứng audit

| Issue        | Mức    | Bằng chứng trước sửa                                                         | Tác động                                                                                          |
| ------------ | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `UX-M21-001` | High   | Dòng 103–119: PageHeader + badge/meta rời; 7 tab đều bắt đầu bằng card trắng | Thiếu “neo” thị giác cho lớp/khóa đang học, khó cảm nhận đây là không gian học tập thống nhất     |
| `UX-M21-002` | High   | Dòng 121–132: tab text-only trong `overflow-x-auto`, nền mặc định            | Mobile biết tab hiện tại nhưng khó quét 7 khu vực và khó nhận ra còn tab nằm ngoài khung          |
| `UX-M21-003` | High   | 7 `CardTitle` mặc định render `div`                                          | Trình đọc màn hình không thể nhảy giữa các khu vực lớn trong tab                                  |
| `UX-M21-004` | High   | 9 vị trí `text-xs` chứa nhãn, ngày, điểm, ghi chú và KPI                     | Nội dung thật bị ép 12px, đặc biệt khó đọc trên điện thoại                                        |
| `UX-M21-005` | Medium | 4 vị trí `truncate`, gồm tên giáo viên, tên bài/thi và URL phòng học         | Thông tin chính bị cắt mà không có cách đọc đầy đủ                                                |
| `UX-M21-006` | Medium | Hầu hết card/list cùng trắng-xám, icon 16px trần                             | Bảy tab nhiều dữ liệu nhưng thiếu phân nhóm/nhịp thị giác theo Learning Journey Bento             |
| `UX-M21-007` | Medium | Hàng bài tập/thi/điểm danh dùng `flex-wrap` trộn content, badge và CTA       | Ở 360px thứ tự nhìn dễ vỡ, CTA/badge chen vào metadata                                            |
| `UX-M21-008` | Low    | Sáu AttendanceStat trắng giống nhau, grid bật 2 cột từ 640 và 6 cột ở xl     | Chưa phân biệt số tổng quan và trạng thái, thiếu nhịp nhưng vẫn phải giữ icon/chữ thay vì chỉ màu |

## 3. Proposal theo DS-026/DS-027

### S01 — Class identity + tab journey

- Bọc page trong `max-w-7xl`; thêm class identity banner sky surface dùng đúng lớp/khóa/trạng thái/delivery/session count hiện có.
- Tab strip dùng student sky surface, border và icon Lucide cho từng nhãn; giữ `defaultValue`, không đưa tab vào URL và không đổi `NAVIGATION`.
- Wrapper scroll riêng, không tạo page overflow. Focus/keyboard vẫn do Radix Tabs giữ.

### S02 — Tổng quan + Lịch/Buổi

- Section card có header màu nhẹ, icon trong ô semantic và `<h2>` thật.
- Field/metadata tối thiểu `text-sm`; meeting URL `break-all` + focus ring, không truncate.
- Lịch lặp chuyển row thành grid mobile rõ; `SessionCalendar` chỉ được bọc, không sửa component chung.

### S03 — Bài tập + Kiểm tra

- Giữ nguyên nhãn, trạng thái, href và phép tính; chuyển mỗi row sang mobile stack, bỏ truncate.
- CTA “Xem tất cả…” ở đầu tab giữ nguyên; card/list dùng amber/coral accent để phân biệt hai loại.

### S04 — Tiến độ + Chuyên cần + Tài liệu

- Progress card có heading thật, thanh tiến độ giữ nguyên ARIA/formula; 4 chỉ số thành bento nhỏ ≥14px.
- AttendanceStat dùng tone sky/cyan/amber/coral theo nhóm nhưng luôn có label + value; lịch sử điểm danh mobile stack.
- Tài liệu chỉ thêm wrapper/heading M21; `MaterialList` giữ nguyên.

## 4. Quyết định cần user

Không có. Proposal chỉ thay visual hierarchy/layout/ARIA trong page M21 và dùng token đã duyệt ở M20. Không đổi chức năng, nhãn, query, shared component behavior hoặc kiến trúc tab.

## 5. Impact map

| Source                      |                  Consumer | Quyết định                                           |
| --------------------------- | ------------------------: | ---------------------------------------------------- |
| `student/class/page.tsx`    |                       M21 | Sửa trong scope                                      |
| `globals.css` student token |   M20, sau M21 là M20–M21 | Chỉ dùng token có sẵn; không thêm token mới          |
| `SessionCalendar`           | Admin + Teacher + Student | Không sửa; chỉ bọc ở M21                             |
| `MaterialList`              |                       M21 | Không sửa vì audit không có issue component-specific |
| query/redirect              |                   M21/P14 | Không sửa                                            |

## 6. Implementation log

- **S01 — hoàn tất:** thêm class identity banner bằng dữ liệu thật và tab journey có icon; giữ nguyên 7 `value`, `defaultValue` và hành vi Radix. Tab chưa chọn dùng `text-student-sky-ink` sau khi E2E lần đầu phát hiện contrast chỉ **4.11:1** trên nền sky; lần chạy lại axe A/AA không còn violation.
- **S02 — hoàn tất:** Tổng quan và Lịch/Buổi dùng section card có `<h2>` thật, metadata tối thiểu 14px, URL phòng học `break-all` + focus ring. `SessionCalendar` chỉ được bọc, không sửa.
- **S03 — hoàn tất:** danh sách Bài tập/Kiểm tra chuyển sang mobile stack, bỏ cắt tên và giữ nguyên badge, href, dữ liệu, công thức cùng CTA hiện có.
- **S04 — hoàn tất:** Tiến độ, Chuyên cần và Tài liệu có hierarchy/tone semantic rõ hơn; ARIA/công thức tiến độ giữ nguyên. `MaterialList` chỉ được bọc, không sửa.
- **Component test:** `student-class-page.test.tsx` **2/2**, gồm đủ 7 tab, không roster, heading theo tab và điều hướng click/bàn phím.
- **E2E:** `student-class-responsive.spec.ts` xanh trên Chromium và Pixel 7. Đã đo/chụp 360/768/1280, không page overflow, axe WCAG A/AA không có violation; xem ảnh trực tiếp xác nhận mobile một cột, tablet hai cột và desktop đủ 7 tab.
- **Test ổn định:** route sau đăng nhập dùng `waitUntil: "domcontentloaded"`; không bỏ/nới assertion. Trước đó Pixel 7 timeout khi chờ sự kiện `load` dù DOM route đã sẵn sàng.
- **Full gate:** lint sạch; typecheck sạch; Vitest **176/176** (54 file); production build xanh; `git diff --check` không có whitespace error. Không có migration hay thay đổi data/API/RLS/Storage.

## 7. Completion gate

- [x] S01 class identity + tabs.
- [x] S02 Tổng quan + Lịch/Buổi.
- [x] S03 Bài tập + Kiểm tra.
- [x] S04 Tiến độ + Chuyên cần + Tài liệu.
- [x] Component/E2E responsive/a11y.
- [x] Lint/typecheck/full test/build.
- [x] Docs/board/QA/WORKLOG đồng bộ.

**Kết luận:** `DONE — chờ xác minh độc lập`. Codex vừa thiết kế vừa triển khai nên không tự ghi `Verified`.
