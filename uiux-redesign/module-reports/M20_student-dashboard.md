# M20 — Tổng quan học viên

## 1. Phạm vi

- Route: `/student`.
- Source chính: `src/app/(dashboard)/student/page.tsx`.
- Dữ liệu read-only: `src/features/dashboard/server/student-queries.ts`.
- Shared impact được phép trong `P15-T1`: thêm semantic color token student-only vào `globals.css`; không đổi giá trị token hiện có và không đổi giao diện Admin/Teacher.
- Ngoài phạm vi: query, business rule, database, RLS, route, navigation, validation, nhãn và các module M21–M27.

## 2. Bằng chứng audit

Dashboard hiện có đủ dữ liệu thật để tạo một hành trình học tập mà không thêm chức năng: lớp hiện tại, 5 buổi sắp tới, bài chưa nộp, điểm chuyên cần, số dư học phí và 5 kết quả đã công bố. Query đã khoanh quyền bằng RLS và D-18; không cần sửa.

| Issue        | Mức    | Bằng chứng trước sửa                                                                                                               | Tác động                                                                                           |
| ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `UX-M20-001` | High   | `student/page.tsx:76-115` — bốn KPI cùng kích thước/cấp thị giác                                                                   | Buổi học kế tiếp và bài cần làm không nổi bật hơn học phí; dashboard chưa chỉ rõ việc học gần nhất |
| `UX-M20-002` | Medium | Toàn trang chỉ dùng Card trắng + icon xám; màu thương hiệu gần như chỉ xuất hiện ở nút                                             | Giao diện đúng chức năng nhưng phẳng, chưa tạo cảm giác hành trình học tập riêng cho học viên      |
| `UX-M20-003` | High   | `:140`, `:191`, `:224` dùng `CardTitle` mặc định là `div`; `:167`, `:211`, `:250`, `:292`, `:294` dùng `text-xs` cho nội dung thật | Trình đọc màn hình không nhảy được giữa các khu vực; metadata quan trọng khó đọc trên điện thoại   |
| `UX-M20-004` | Medium | Các hàng `flex-wrap` trộn nội dung, badge, điểm và CTA; tiêu đề dùng `truncate`                                                    | Ở 360px thứ tự đọc/nhìn dễ rời rạc và tên bài/kết quả có thể bị cắt                                |
| `UX-M20-005` | Low    | Cảnh báo học phí dùng `border-warning/40 bg-warning/5`                                                                             | Alpha ngẫu hứng, không bám semantic palette học viên đã chốt                                       |

## 3. Proposal đã được phép bởi DS-026/DS-027

### S01 — Student semantic palette

Thêm bốn nhóm màu hỗ trợ, chỉ dùng trong M20–M27:

| Nhóm  | Surface   | Border    | Ink       | Contrast ink/surface |
| ----- | --------- | --------- | --------- | -------------------: |
| Sky   | `#EAF6FF` | `#A8D7F5` | `#134B86` |               8.04:1 |
| Cyan  | `#E8FAF8` | `#9DDED9` | `#0E7490` |               4.97:1 |
| Amber | `#FFF4DD` | `#F3C96B` | `#A84A08` |               5.27:1 |
| Coral | `#FFF0EC` | `#F0B6AA` | `#B53A2D` |               5.25:1 |

Xanh `#1A5FA8`, cam `#FB9518` và đỏ `#C8102E` vẫn là màu chủ đạo trong hero/CTA/điểm nhận diện. Token mới không thay token cũ, không có consumer ngoài student page nếu module chưa triển khai.

### S02 — Learning Journey Bento

- Giữ nguyên `PageHeader` và toàn bộ nhãn/dữ liệu.
- Biến “Buổi học kế tiếp” thành hero chính màu xanh thương hiệu; cam/đỏ chỉ là hình học trang trí `aria-hidden`.
- Ba KPI còn lại thành bento hỗ trợ: bài chưa nộp = amber, chuyên cần = cyan, học phí = coral. Mỗi card có icon + chữ nên không dùng màu làm tín hiệu duy nhất.
- Các khu vực “Bài tập cần nộp”, “Buổi học sắp tới”, “Kết quả mới công bố” dùng heading `<h2>`, metadata `text-sm`, không cắt tiêu đề.
- Mobile xếp một cột theo thứ tự học trước; tablet gom KPI thành hàng; desktop hero 7/12 và KPI 5/12. Không scroll ngang cấp trang.
- Loading/error dùng boundary dashboard hiện có; empty state giữ component chung.

## 4. Quyết định cần user

Không có. Phạm vi, phong cách, font và quyền dùng màu hỗ trợ đã được user chốt trong `DS-026`/`DS-027`. Proposal không đổi chức năng, nhãn, query hay shared component behavior.

## 5. Kế hoạch triển khai

1. S01 — thêm token student-only và mapping Tailwind trong `globals.css`.
2. S02 — thiết kế lại duy nhất `student/page.tsx`; helper Stat vẫn local.
3. Thêm component test cho role guard, hierarchy, link/dữ liệu và trạng thái chưa có lớp.
4. Chạy responsive/browser nếu môi trường local có dữ liệu; luôn chạy lint/typecheck/full test/build.

## 6. Implementation log

### S01 — hoàn tất

- Thêm 12 token `student-{sky,cyan,amber,coral}-{surface,border,ink}` và mapping Tailwind trong `globals.css`.
- Không đổi giá trị token cũ. Tìm consumer sau triển khai: chỉ `student/page.tsx`, nên Admin/Teacher không đổi giao diện.

### S02 — hoàn tất

- Hero xanh thương hiệu ưu tiên buổi học kế tiếp; cam/đỏ + chữ Hán `学` chỉ là hình học `aria-hidden`.
- Ba KPI hỗ trợ dùng amber/cyan/coral; icon và chữ luôn đi kèm màu.
- Ba section danh sách có `<h2>` thật; bỏ toàn bộ `text-xs`/`truncate` khỏi nội dung M20.
- Giữ nguyên `requireRole("student")`, `getStudentDashboard()`, mọi label, href, công thức và empty/error/loading behavior.
- Thêm 2 component test cho hierarchy/dữ liệu/link và trạng thái chưa được xếp lớp.
- Thêm E2E M20 cho 360/768/1280, axe WCAG A/AA, page overflow và hình học hero/KPI. Lần chụp đầu phát hiện KPI 3 cột bị hẹp ở 768px; đổi tablet thành 2 cột và bổ sung assertion card rộng tối thiểu 180px trước khi chụp lại.

### Xác minh thật

- Seed local bằng `npm run db:seed:dev` (truyền byte qua `docker cp`); kiểm mắt UTF-8 trả về `Giáo viên Demo A`, `Giáo viên Demo B`, `Học viên Demo 1` đúng dấu.
- Playwright Chromium **1/1 pass** với ảnh full-page 360/768/1280; cả ba không tràn ngang, axe không có violation WCAG A/AA.
- Ảnh kiểm bằng mắt: mobile một cột; tablet hero + KPI 2 cột; desktop hero 7/12 + KPI 5/12. Next Dev Tools tạo nút `N` đen trong ảnh local, không có ở production.
- Lint pass · typecheck pass · Vitest **175/175** (54 file) · build production pass. Build sandbox đầu tiên chỉ lỗi tải Google Font; chạy lại có quyền mạng thành công.

## 7. Completion gate

- [x] S01 semantic palette.
- [x] S02 dashboard.
- [x] Heading/keyboard/touch/states.
- [x] Responsive 360–430 / 768–1024 / 1280+.
- [x] Lint/typecheck/test/build.
- [x] Board/changelog/checkpoint/QA/WORKLOG đồng bộ.

**Final Status:** `DONE — chờ xác minh độc lập`. Codex vừa thiết kế vừa triển khai nên không tự ghi Verified.
