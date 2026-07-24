# UI/UX Module Inventory

> Lập ngày **2026-07-21** từ `src/lib/permissions/navigation.ts` (menu 3 role), 51 file `page.tsx` trong `src/app/`, và cấu trúc `src/features/`.
> Không có module nào được tự nghĩ thêm — mỗi dòng đều truy được về một mục menu hoặc một route thật.

## Quy tắc xác định module

Một module thường được xác định bởi một hoặc nhiều tín hiệu:

- Mục cấp cao trong sidebar/navigation.
- Nhóm route có cùng nghiệp vụ.
- Nhóm page có chung layout và permission scope.
- Nhóm chức năng người dùng nhận biết như một khu vực độc lập.

Không tách một modal hoặc component nhỏ thành module riêng. Không gộp nhiều khu vực nghiệp vụ độc lập vào một module.

**Ánh xạ ID:** `M00` = nền tảng dùng chung · `M01–M12` = Super Admin (12 mục menu) · `M13–M19` = Giáo viên (7 mục menu) · `M20–M27` = Học viên (8 mục menu) · `M28` = Xác thực & trang công khai.

---

## Danh sách module

### M00 — Nền tảng dùng chung

| Trường | Giá trị |
|---|---|
| Module ID | **M00** |
| Tên module | Shared Foundation — App shell, navigation, design token |
| Route chính | Áp dụng cho mọi route trong `(dashboard)` |
| Màn hình | Sidebar desktop · Drawer mobile · Header sticky · User menu · Notification bell · Footer · Skip link · Nav progress |
| Role/phạm vi | Cả 3 role |
| Source liên quan | `src/app/(dashboard)/layout.tsx` · `src/components/layout/{sidebar-nav,mobile-nav,nav-links,user-menu,site-footer}.tsx` · `src/components/shared/{logo,nav-progress,page-header,empty-state,status-badge}.tsx` · `src/app/globals.css` |
| Phụ thuộc | Không phụ thuộc module nào; **mọi module khác phụ thuộc nó** |
| Thứ tự ưu tiên | **1** |
| Trạng thái | NOT_STARTED |

### Super Admin (M01–M12)

| Order | Module ID | Tên module | Route chính | Màn hình | Source liên quan | Phụ thuộc shared | Trạng thái |
|---:|---|---|---|---|---|---|---|
| 18 | M01 | Tổng quan (Admin) | `/admin` | 1 — dashboard KPI + cảnh báo | `admin/page.tsx` (316 dòng), `features/dashboard` | Card, Badge, chart | NOT_STARTED |
| 19 | M02 | Học viên | `/admin/students` | 1 danh sách + form/dialog | `admin/students/page.tsx` (175), `features/students` (2 comp) | Table, Form, Dialog | NOT_STARTED |
| 20 | M03 | Giáo viên | `/admin/teachers` | 1 danh sách + form/dialog | `admin/teachers/page.tsx` (157), `features/teachers` (2 comp) | Table, Form, Dialog | NOT_STARTED |
| 21 | M04 | Khóa học | `/admin/courses` | 2 — danh sách, chi tiết `[id]` | `admin/courses/{page,[id]/page}.tsx` (201), `features/courses` (3 comp) | Table, Form, Tabs | NOT_STARTED |
| 22 | M05 | Lớp học | `/admin/classes` | 2 — danh sách, chi tiết `[id]` | `admin/classes/{page,[id]/page}.tsx` (184), `features/classes` (2), `features/enrollments` | Table, Form, Dialog | NOT_STARTED |
| 23 | M06 | Flashcard | `/admin/flashcards` | 1 — quản lý bộ/trang | `admin/flashcards/page.tsx` (41), `features/flashcards` (2 comp) | Dialog, upload, sắp thứ tự | NOT_STARTED |
| 24 | M07 | Lịch học | `/admin/schedule` | 1 — lịch tuần/tháng | `admin/schedule/page.tsx` (91), `features/schedules` (2 comp) | Calendar, date-picker | NOT_STARTED |
| 25 | M08 | Học phí | `/admin/tuition` | 1 — hóa đơn/thanh toán | `admin/tuition/page.tsx` (94), `features/tuition` (2 comp) | Table, Form, tiền tệ | NOT_STARTED |
| 26 | M09 | Báo cáo | `/admin/reports` | 1 — báo cáo + export | `admin/reports/page.tsx` (204), `features/reports` | Chart, Table, export | NOT_STARTED |
| 27 | M10 | Duyệt câu hỏi | `/admin/question-bank-review` | 1 — hàng đợi duyệt | `admin/question-bank-review/page.tsx` (10), `features/question-bank` (5 comp) | Table, Dialog | NOT_STARTED |
| 28 | M11 | Thông báo (Admin) | `/admin/notifications` | 1 — soạn/gửi thông báo | `admin/notifications/page.tsx` (47), `features/announcements` (2 comp) | Form, Table | NOT_STARTED |
| 29 | M12 | Quản trị & Audit | `/admin/system` | 1 — tài khoản + audit log | `admin/system/page.tsx` (38), `features/accounts` (3), `features/audit` (1) | Table, Dialog | NOT_STARTED |

### Giáo viên (M13–M19)

| Order | Module ID | Tên module | Route chính | Màn hình | Source liên quan | Phụ thuộc shared | Trạng thái |
|---:|---|---|---|---|---|---|---|
| 2 | M13 | Hôm nay (Teacher) | `/teacher` | 1 — dashboard buổi dạy hôm nay | `teacher/page.tsx`, `features/dashboard` | Card, Badge | NOT_STARTED |
| 3 | M15 | Điểm danh | `/teacher/attendance` | 1 — roster điểm danh | `teacher/attendance/page.tsx` (154), `features/attendance` (1 comp) | Nút trạng thái lớn, touch | NOT_STARTED |
| 4 | M14 | Lớp của tôi (Teacher) | `/teacher/classes` | 3 — danh sách, chi tiết `[id]`, buổi học `sessions/[id]` | `teacher/classes/{page,[id]/page}.tsx` (101), `teacher/sessions/[id]/page.tsx`, `features/sessions` | Table, Tabs | NOT_STARTED |
| 5 | M16 | Bài tập (Teacher) | `/teacher/exercises` | 4 — danh sách, chi tiết giao `[deliveryId]`, ngân hàng câu hỏi, bộ đề | `teacher/exercises/*` (21), `features/exercises`, `features/question-builder` (3 comp) | Tabs, Table, Form phức tạp | NOT_STARTED |
| 6 | M17 | Kiểm tra / Thi (Teacher) | `/teacher/exams` | 4 — danh sách, chi tiết `[deliveryId]`, ngân hàng câu hỏi, bộ đề | `teacher/exams/*` (21), `features/exams`, `features/assessments` | Tabs, Table, Form phức tạp | NOT_STARTED |
| 7 | M18 | Đánh giá & Ghi chú | `/teacher/evaluations` | 2 — danh sách, hồ sơ `[id]` | `teacher/evaluations/*` (152), `features/evaluations` (1 comp, 560+ dòng) | Form dài, Tabs | NOT_STARTED |
| 8 | M19 | Báo cáo lớp | `/teacher/progress` | 1 — tiến độ lớp | `teacher/progress/page.tsx` (297) | Chart, Table | NOT_STARTED |
| 30 | — | Thông báo (Teacher) | `/teacher/notifications` | 1 — **không có trong menu**, vào qua chuông | `teacher/notifications/page.tsx` (11) | Gộp vào M11 khi làm | NOT_STARTED |

### Học viên (M20–M27)

> `DS-026` thay thứ tự còn lại của `DS-002`: sau `P14-T12`, đợt redesign hiện tại chỉ đi M20→M27. M16–M19, M28 và M01–M12 tạm dừng; M00/M13/M15 giữ nguyên, M14 giữ `IMPLEMENTED — chờ đo`. Hướng hình ảnh riêng của học viên theo `DS-027`.

| Order | Module ID | Tên module | Route chính | Màn hình | Source liên quan | Phụ thuộc shared | Trạng thái |
|---:|---|---|---|---|---|---|---|
| 9 | M20 | Tổng quan (Student) | `/student` | 1 — dashboard học viên | `student/page.tsx`, `features/dashboard` | Card, Alert | NOT_STARTED |
| 10 | M21 | Lớp của tôi (Student) | `/student/class` | 1 màn hình gộp **7 tab** chỉ đọc (+ `/student/schedule` redirect) | `student/class/page.tsx` (**663 dòng — lớn nhất repo**), `features/student` (2 comp) | Tabs, Table, Calendar | NOT_STARTED |
| 11 | M22 | Bài tập (Student) | `/student/exercises` | 3 — danh sách, lượt làm `attempt`, kết quả `results` | `student/exercises/*` (33), `features/submissions`, `features/assessment-results` (3 comp) | Form làm bài, đồng hồ, audio nguồn `0.5×/0.75×/1×` (`P14-T12`) | NOT_STARTED |
| 12 | M23 | Kiểm tra / Thi (Student) | `/student/exams` | 3 — danh sách, lượt thi `attempt`, kết quả `results` | `student/exams/*` (83) | Chế độ thi (ẩn chrome), đồng hồ, fullscreen, audio nguồn `0.5×/0.75×/1×` (`P14-T12`) | NOT_STARTED |
| 13 | M24 | Ôn tập | `/student/review` | 1 — Flashcard + Ôn câu sai | `student/review/page.tsx` (47), `features/flashcards`, `features/wrong-answer-review` (1 comp) | Animation lật thẻ, audio nguồn `0.5×/0.75×/1×` (`P14-T12`) | NOT_STARTED |
| 14 | M25 | Kết quả | `/student/results` | 1 — tổng hợp điểm | `student/results/page.tsx` (296) | Table, Chart | NOT_STARTED |
| 15 | M26 | Học phí (Student) | `/student/tuition` | 1 — hóa đơn cá nhân | `student/tuition/page.tsx` (26) | Table, tiền tệ | NOT_STARTED |
| 16 | M27 | Hồ sơ | `/student/profile` | 1 — hồ sơ cá nhân | `student/profile/page.tsx` (80) | Form | NOT_STARTED |
| 31 | — | Thông báo / Đánh giá (Student) | `/student/notifications`, `/student/evaluations` | 2 — **không có trong menu**, vào qua chuông/liên kết | (11) và (12) dòng | Gộp vào M11/M18 khi làm | NOT_STARTED |

### Xác thực & công khai (M28)

| Order | Module ID | Tên module | Route chính | Màn hình | Source liên quan | Phụ thuộc shared | Trạng thái |
|---:|---|---|---|---|---|---|---|
| 17 | M28 | Xác thực & trang gốc | `/login` | 5 — đăng nhập, quên mật khẩu, đặt lại mật khẩu, nhận lời mời, trang gốc `/` | `src/app/(auth)/*` (4 page + `layout.tsx`), `src/app/page.tsx`, `features/auth` (3 comp) | Form, Logo, Footer | NOT_STARTED |

---

## Shared UI Foundation

Bảng này thuộc phạm vi **M00**. Cột "Module sử dụng" = phạm vi ảnh hưởng nếu sửa.

| Shared ID | Thành phần | Source | Module sử dụng | Ghi chú |
|---|---|---|---|---|
| SH01 | App shell / layout | `src/app/(dashboard)/layout.tsx` | M01–M27 (mọi trang đã đăng nhập) | Giữ `force-dynamic`; giữ `data-exam-active` ẩn chrome khi thi |
| SH02 | Sidebar / navigation | `layout/{sidebar-nav,mobile-nav,nav-links}.tsx` + `lib/permissions/navigation.ts` | M01–M27 | **Giữ nguyên route + danh sách menu** — đó là dữ liệu phân quyền, không phải trang trí |
| SH03 | Button primitives | `ui/button.tsx` | Toàn bộ | 8 size hiện đều 44px — xem `UX-M00-003` |
| SH04 | Form primitives | `ui/{form,input,label,select,checkbox,radio-group,switch,textarea,date-picker,date-time-picker}.tsx` | M02–M12, M14–M18, M22, M23, M27, M28 | **Giữ nguyên validation Zod** |
| SH05 | Table primitives | `ui/table.tsx` + `@tanstack/react-table` | M02, M03, M05, M08, M09, M10, M12, M19, M25 | Đã có `overflow-x-auto` bọc sẵn |
| SH06 | Modal / dialog | `ui/{dialog,alert-dialog,sheet,popover}.tsx` + `shared/confirmation-provider.tsx` | Toàn bộ module có mutation | Giữ focus trap của Radix |
| SH07 | Feedback states | `shared/{empty-state,status-badge,submit-button,page-loading-overlay,step-hint}.tsx`, `ui/{skeleton,alert,sonner}.tsx` | Toàn bộ | Dùng lại, không viết mới |
| SH08 | Design token | `src/app/globals.css` | **Toàn bộ** | Rủi ro cao nhất repo |

---

## Thứ tự ưu tiên — đã chốt

Nguyên tắc xếp thứ tự (theo `01_UIUX_GOVERNANCE.md` §5 và quyết định `DS-002`):

1. **M00 trước tiên** — nền tảng dùng chung, làm khi chưa có gì để phá.
2. **Nhóm Giáo viên (M13, M15, M14, M16, M17, M18, M19)** — người dùng thao tác dày đặc nhất, mỗi buổi dạy đều dùng; điểm danh và bài tập có rủi ro thao tác sai cao.
3. **Nhóm Học viên (M20–M27)** — số lượng người dùng lớn nhất, phần lớn dùng trên điện thoại nên rủi ro responsive cao.
4. **M28 Xác thực** — mọi người đều gặp, nhưng ít màn hình và ít thay đổi.
5. **Nhóm Quản trị (M01–M12)** — nhiều bảng và form nhất, nhưng chỉ một nhóm nhỏ người dùng thành thạo dùng.

Không tự đổi thứ tự này sau khi đã chốt nếu chưa ghi lý do vào `08_UIUX_DECISIONS.md`.
