# UI/UX Changelog

## Format

Mỗi thay đổi phải có:

- Ngày.
- Module ID.
- Màn hình/component.
- File thay đổi.
- Thay đổi UI/UX.
- Xác nhận không đổi nghiệp vụ.
- Responsive.
- Kết quả kiểm tra.

---

## Entries

### 2026-07-23/24 — Flashcard (Phase 16, `P16-T0`…`T9`) — đợt 12

**Màn hình:** `/admin/flashcards` (soạn thẻ Admin) · `/student/review` tab
Flashcard (thẻ học viên). Đóng cả `P15-T5b` (M24) và `P18-T7` (M06 Admin).

**File thay đổi:** 3 migration (`…070` mô hình cấu trúc, `…071` ★ thẻ khó,
`…072` nhập hàng loạt); `features/flashcards/**` (schema, actions, queries, 3
domain: `pinyin`/`sublists`/`bulk-import`, 4 component); `student/review/page.tsx`;
`seed.dev.sql`; `types/database.ts`.

**Thay đổi UI/UX:** Thẻ từ vựng chuyển từ **hai ảnh** sang **dựng bằng chữ**
theo §7ter — mặt trước pinyin căn thẳng trên từng chữ Hán, nghĩa màu cam, ảnh
tuỳ chọn; mặt sau 5 khối màu (đầu thẻ · nghĩa · tách nghĩa · câu ví dụ · cụm từ).
Chiều cao thẻ do khối sizer grid quyết định nên **chữ tự xuống dòng, không bị
`object-cover` cắt** — đây là lời than gốc của user. Thêm: ★ đánh dấu thẻ khó,
xáo trộn (chỉ buổi đang chọn, không bền qua đăng xuất), phát tự động, nhập hàng
loạt dán nhiều dòng.

**Xác nhận nghiệp vụ:** Đây là phần **có** đổi database/API (Phase 16 được duyệt
đổi mô hình, khác đợt redesign thuần). Quyền tạo **vẫn chỉ Super Admin** (`Q1`),
không đổi RLS deck/section. `DS-003` áp lại từ `P16-T8`.

**Responsive:** đo 6 bề rộng (360/390/430/768/1024/1280) × 2 project trong
`flashcard-responsive.spec.ts`.

**Kết quả kiểm tra:** Codex dựng lại độc lập trên DB sạch: pgTAP toàn bộ
**460/460**; media RLS/Storage, ★ IDOR, import idempotent, publish gate và
`@>` + GIN đều khớp. Phát hiện rồi sửa `BUG-P16-001` (seed/E2E ghim UUID Course);
sau sửa reset → seed exit 0, Chromium **16/16**, Pixel 7 **16/16**, lint ·
typecheck · build exit 0, Vitest **256/256**. Vì Codex là người sửa regression,
Phase 16 chờ agent khác xác minh fix trước khi ghi `Verified`; cloud dry-run còn
bị 403/thiếu `SUPABASE_DB_PASSWORD`.

### 2026-07-23 — M01–M12 (Quản trị) — `P18-T2`…`P18-T14` (đợt 9)

**Màn hình:** 13 bề mặt — `/admin` · `students` · `teachers` · `courses` ·
`courses/[id]` · `classes` · `classes/[id]` · `schedule` · `tuition` · `reports` ·
`question-bank-review` · `notifications` · `system`. M06 Flashcard **hoãn**.

**File mới:** `src/components/shared/data-table.tsx` ·
`src/components/shared/scrollable-nav.tsx` ·
`tests/e2e/admin-responsive.spec.ts` ·
`tests/unit/domain/format-date-only.test.ts` ·
`uiux-redesign/module-reports/P18_admin.md`

**File sửa:** 11 trang `app/(dashboard)/admin/**` ·
`src/components/ui/tabs.tsx` (**tầng dùng chung**) · `src/lib/dates/index.ts` ·
`src/features/accounts/components/accounts-view.tsx` ·
`src/features/enrollments/components/enrollment-panel.tsx` ·
`docs/08-phase-plan.md` · `uiux-redesign/{04,06,07,08}` · `WORKLOG.md`

**Thay đổi UI/UX:**

- **Gộp 6 bảng từ HAI giao diện về MỘT**, cuộn ngang trên máy nhỏ (`DS-044`).
  Trả lại **10 cột dữ liệu** mà bản điện thoại cũ bỏ hẳn (email, người giám hộ,
  điện thoại, chuyên môn, học phí, số buổi, khai giảng, mã tài khoản).
- **Ghim cột định danh** khi cuộn ngang — không ghim hàng tiêu đề, có lý do đo
  được (xem `DS-044`).
- Bảng có `<caption>` **bắt buộc trong kiểu dữ liệu**, `th[scope="col"]`,
  `tabular-nums` cho cột số, và vùng cuộn **nhận tiêu điểm chỉ khi thật sự cuộn**.
- `<h2>` thật cho mọi khối (trước: **0 trên 12/13 màn**); sửa nhảy cấp `h1→h3`.
- Chữ nghiệp vụ dưới 14px: **~200 → ~90** chỗ.
- Tab không được chọn đổi sang token thật — **4.07:1 → 6.89:1** (`DS-045`).
- Ngày cột `date` hiện đúng `dd/MM/yyyy` thay vì chuỗi ISO (`DS-046`).

**Xác nhận không đổi nghiệp vụ:** không migration; không đổi schema, query,
server action, RPC, RLS, Storage, route, phân quyền, validation hay nhãn nghiệp
vụ. Công thức KPI, quyền xem và luồng export giữ nguyên — bài kiểm mới xác nhận
nút Xuất CSV/XLSX **mang đúng `from`/`to`/`status` đang chọn** (`BUG_M16_01`).

**Responsive:** 360 · 390 · 430 · 768 · 1024 · 1280 trên Chromium + Pixel 7.
Tràn ngang: `/admin` 127→**0** · `classes/[id]` 193→**0** · `courses/[id]`
106→**0** · `reports` 93→**0**.

**Kiểm tra:** Lint ✅ · Typecheck ✅ · Vitest **226/226** (+6) ✅ · Build ✅ ·
`admin-responsive` **14/14** ✅ · spec liên quan **14/14** ✅ · ảnh chụp DPR2 6 màn ✅

### 2026-07-23 — M13/M14 + tầng test — `P17-T5` Quality gate liên module Giáo viên (đợt 7)

- **Module:** M13, M14 (sửa code); M10/M11/M16/M17 (chỉ thêm nhãn cho combobox); toàn bộ tầng test E2E.
- **Màn hình/component:** `/teacher`, `/teacher/classes`, `/teacher/classes/[id]`; dialog Chia sẻ câu hỏi; form Thông báo và Hóa đơn của Admin.
- **File thay đổi:**
  - **Mới:** `tests/e2e/teacher-cross-module.spec.ts`, `uiux-redesign/module-reports/P17-T5_teacher-quality-gate.md`.
  - **Sửa:** `src/app/(dashboard)/teacher/page.tsx`, `src/app/(dashboard)/teacher/classes/page.tsx`, `src/app/(dashboard)/teacher/classes/[id]/page.tsx`, `src/features/question-bank/components/question-actions.tsx`, `src/features/announcements/components/announcement-manager.tsx`, `src/features/tuition/components/invoice-manager.tsx`, và **9 spec E2E** ghim UUID hàng seed.
- **Thay đổi UI/UX:** 5 lỗi thật — (1)+(2) 🔴 `/teacher` tràn **31px** và `/teacher/classes` tràn **70px@360 / 40px@390**, **cùng một nguyên nhân gốc**: grid item mặc định `min-width: auto` nên không co được dưới min-content; đã kiểm chứng trong trình duyệt (đặt `min-width: 0` → tràn về 0) **trước khi** sửa code. (3) 🔴 dải **8 tab** `/teacher/classes/[id]` cuộn ngang mà không focus được — Radix dùng roving tabindex nên "bên trong có `<Link>`" không cứu được; đúng lỗi `UX-UIUX-M21-009` lặp lại ở phía giáo viên. (4) tên lớp bị `truncate` mất hậu tố phân biệt `(Lớp 02)`/`(Ban Giám đốc)` — E2E 14/14 xanh vẫn không bắt được, chỉ lộ khi **nhìn ảnh chụp**. (5) 🔴 **9 spec E2E ghim UUID của hàng seed** → vỡ sau mỗi `db reset`.
- **Xác nhận không đổi nghiệp vụ:** không đổi query · server action · RPC · RLS · Storage · route · phân quyền · validation · công thức · nhãn nghiệp vụ. Không migration. Bốn chỗ chạm Admin (M10/M11) **chỉ thêm `htmlFor`/`id`** theo quyết định user, **không** mở lại thiết kế hai module đang tạm dừng theo `D-27`.
- **Responsive:** 13 bề mặt × 6 bề rộng (360/390/430/768/1024/1280) trên Chromium + Pixel 7; axe ở 360/768/1280. M15/M16/M17/M18/M19 **không lộ lỗi bố cục mới** — kết luận thật, đã đo.
- **Kết quả kiểm tra:** xem `WORKLOG.md` entry 2026-07-23 (ghi đúng kết quả chạy thật). ⚠️ **Hai lần suýt báo động giả**, cả hai là lỗi ĐO chứ không phải lỗi sản phẩm: `h1=0` do đếm khi RSC còn đang stream, và contrast 4.45:1 do quét axe giữa lúc dialog fade-in. Chi tiết ở §4.1 báo cáo — nếu tin lượt đo đầu thì đã sửa nhầm token dùng chung ảnh hưởng toàn app.

### 2026-07-22 — M19 — `P17-T4` Báo cáo lớp (đợt 6)

- **Module:** M19. Không chạm tầng dùng chung — `ClassPicker` đã được sửa sẵn ở `P17-T3`.
- **Màn hình/component:** `/teacher/progress`; component mới `features/reports/components/attendance-bars.tsx`.
- **File thay đổi:**
  - **Mới:** `src/features/reports/components/attendance-bars.tsx`, `tests/e2e/teacher-progress-responsive.spec.ts`, `uiux-redesign/module-reports/M19_teacher-progress.md`.
  - **Sửa:** `src/app/(dashboard)/teacher/progress/page.tsx`.
- **Thay đổi UI/UX:** 7 lỗi — (1) 🔴 cả trang chỉ có **đúng một heading** (`CardTitle` là `<div>`). (2) 🔴 bảng 7 cột **vừa không cuộn được bằng bàn phím vừa không cuộn**: thiếu `tabIndex` và thiếu `min-width` nên bị bóp còn ~51px/cột ở 360px; sửa cả hai vế cùng lúc. (3) bảng thiếu `<caption>` và `scope="col"`. (4) số liệu quyết định can thiệp ở **12px**. (5) thêm biểu đồ `AttendanceBars` theo `DS-037` — xếp tăng dần để trả lời "ai đang đuối nhất", thứ mà bảng xếp theo tên không trả lời được. (6) nhiều nút "Ghi nhận xét" trùng tên. (7) 🔴 nhãn "Cần chú ý" **bị cắt cụt** — lỗi do chính đợt này gây ra, E2E xanh không bắt được, chỉ lộ khi nhìn ảnh chụp.
- **Xác nhận không đổi nghiệp vụ:** biểu đồ **chỉ vẽ lại** `attendance_rate` mà `getTeacherClassReport` đã trả về — không thêm query, không thêm công thức, ngưỡng "cần chú ý" lấy từ view `v_at_risk_assessment_students` của DB chứ không tự đặt. **Không** thêm export/date-range (`DS-037`); vế đó của DoD ghi **N/A** kèm bằng chứng. Không migration. Không dùng `recharts` — giữ trang là server component thuần.
- **Responsive:** 360/390/430/768/1024/1280 — không tràn ngang; axe sạch ở 360/768/1280 trên cả hai project. Bảng chuyển sang cuộn ngang có vòng focus thay vì bóp cột.
- **Kết quả kiểm tra:** baseline **6 đỏ/2 xanh** → **16/16**, và **32/32** với `--repeat-each=2`. Lượt chạy chung M18+M19+spec liên quan: **38/38**. lint/typecheck/build xanh. ⚠️ Vitest **218–220/220** — flaky timeout 5s ở file **không liên quan**, đổi mỗi lượt, chạy riêng đều xanh; đã ghi `UX-UIUX-M19-008` cho `P17-T5`.

### 2026-07-22 — M18 (+ M00, M19 dùng chung) — `P17-T3` Đánh giá & Ghi chú (đợt 6)

- **Module:** M18; chạm M00 (`class-picker`, `date-picker`) nên ảnh hưởng cả M19 và `/admin/schedule`.
- **Màn hình/component:** `/teacher/evaluations`, `/teacher/evaluations/[id]`, `ClassPicker`, `DatePicker`.
- **File thay đổi:**
  - **Mới:** `tests/e2e/teacher-evaluations-responsive.spec.ts`, `uiux-redesign/module-reports/M18_teacher-evaluations.md`.
  - **Sửa:** `src/app/(dashboard)/teacher/evaluations/page.tsx`, `src/features/evaluations/components/evaluation-profile.tsx`, `src/features/schedules/components/class-picker.tsx`, `src/components/ui/date-picker.tsx`, `tests/e2e/evaluation.smoke.spec.ts`.
- **Thay đổi UI/UX:** 7 lỗi có bằng chứng chạy được — (1) 🔴 `ClassPicker` là `role="combobox"` **không có tên gọi được** (axe `select-name`, critical): `combobox` không lấy tên từ nội dung nên chữ nhìn thấy bên trong không thành tên; sửa bằng `useId()` + `<Label htmlFor>` hiện hình. (2) 🔴 `FieldError` thiếu `role="alert"`/`id`, không ô nhập nào có `aria-invalid`/`aria-describedby` → lỗi từ server action không được đọc ra. (3) 🔴 mỗi bản đánh giá không có heading (`CardTitle` là `<div>`) và cụm nút icon **trùng tên nhau** giữa các bản, kể cả nút Gửi không thu hồi được. (4) 🔴 dialog nói **sai hậu quả**: sửa bản đã gửi thì học viên thấy ngay, nhưng UI vẫn ghi "Lưu form không gửi cho học viên". (5) thông tin nghiệp vụ ở 12px. (6) danh sách/nhãn–giá trị không đúng ngữ nghĩa → `<ul>/<li>`, `<dl>/<dt>/<dd>`. (7) 🔴 `evaluation.smoke` hỏng sẵn từ trước, che mất toàn bộ nhánh Gửi.
- **Xác nhận không đổi nghiệp vụ:** không đụng query/action/RPC/RLS/route/phân quyền/công thức. `UX-UIUX-M18-004` **chỉ sửa câu chữ**, giữ nguyên luật "sửa được bản đã gửi" — việc có nên chặn là quyết định của user. Không migration.
- **Responsive:** 360/390/430/768/1024/1280 — không tràn ngang; axe sạch ở 360/768/1280 trên cả Chromium và Pixel 7.
- **Kết quả kiểm tra:** baseline **5 đỏ/3 xanh** → `teacher-evaluations-responsive` **16/16**; `evaluation.smoke` **2/2** (trước đó đỏ, đã kiểm chứng bằng `git stash` là lỗi có sẵn); `report.smoke` **2/2**; `accessibility-responsive` **2/2**; Vitest **220/220**; lint/typecheck/build xanh.

### 2026-07-22 — M17 (+ M00, M16 dùng chung) — `P17-T2` Kiểm tra / Thi (Teacher) (đợt 5)

- **Module:** M17; chạm M16 và M00 vì dùng chung tầng dưới.
- **Màn hình/component:** `/teacher/exams`, `/teacher/exams/[deliveryId]` (màn chấm dùng chung), `ui/button.tsx` qua `globals.css`.
- **File thay đổi:**
  - **Mới:** `src/features/assessment-results/group-deliveries.ts`, `tests/e2e/teacher-exams-responsive.spec.ts`, `tests/unit/domain/group-deliveries.test.ts`, `uiux-redesign/module-reports/M17_teacher-exams.md`.
  - **Sửa:** `src/features/exams/teacher/exam-dashboard.tsx`, `src/features/assessment-results/components/grading-workspace.tsx`, `src/features/exercises/teacher/exercise-dashboard.tsx` (dùng helper chung), `src/app/globals.css`, `tests/e2e/accessibility-responsive.spec.ts`.
- **Thay đổi UI/UX:**
  - `UX-UIUX-M17-001` giờ đóng thi về `formatDateTime` — chỗ `D-12` **cuối cùng** trong `src/`.
  - `UX-UIUX-M17-002` gỡ `<main>` lồng trong `<main>` ở màn chấm dùng chung.
  - `UX-UIUX-M17-003` `aria-current` cho học viên đang chọn + `role="img"` cho icon trạng thái.
  - `UX-UIUX-M17-004` nhóm lớp thành `<fieldset>/<legend>`, ô tick có vòng focus.
  - `UX-UIUX-M17-005` bản chép thứ 6 của `<select>` → `NativeSelect`.
  - `UX-UIUX-M17-006` `<ul>/<li>`, `text-sm`, `EmptyState`, token `--success`/`--warning` thay màu thô.
  - `UX-UIUX-M17-007` gom logic nhóm theo lớp vào một chỗ + 5 unit test.
  - `UX-UIUX-M00-018` (user duyệt) luật 44px cho nút icon trên cảm ứng bắt theo `[data-size^="icon"]` — cặp selector cũ bị Radix `asChild` ghi đè `data-slot` nên chưa bao giờ áp được.
- **Xác nhận không đổi nghiệp vụ:** không đổi query/action/RPC/RLS/Storage/route/phân quyền/validation/công thức/nhãn. Không migration. `EX-12`, `EX-13`, integrity, chống lộ đáp án giữ nguyên.
- **Responsive:** 360/390/430/768/1024/1280 trên cả ba màn, không tràn ngang.
- **Kết quả kiểm tra:** M17 **12/12** · M16 chạy lại **16/16** · a11y toàn cục **2/2** · unit mới **5/5** · Vitest **220/220** · lint/typecheck/build ✅.

---

### 2026-07-22 — M16 · M22 · M23 · M25 — hai việc user duyệt riêng (đợt 4)

**Screen/Component:** form giao bài tập (`M16`) · danh sách + lượt làm Bài tập (`M22`) · danh sách + lượt thi (`M23`) · khối kết quả dùng chung (`M25`).

**Files changed:** **mới** `tests/unit/domain/delivery-error-message.test.ts`. **Sửa** `src/features/exercises/server/actions.ts`, `src/app/(dashboard)/student/exams/page.tsx`, `src/features/assessment-results/components/result-view.tsx`, `src/features/exams/student/exam-attempt.tsx`, `src/features/exercises/student/exercise-attempt.tsx`, `src/features/exercises/student/exercise-list.tsx`, `tests/e2e/teacher-exercises-responsive.spec.ts`.

**1. `UX-UIUX-M16-007` — user duyệt (`DS-003`).** Đọc `pg_get_constraintdef` của bảng `exercise_deliveries` để **dịch đúng cái DB đang cưỡng chế**, không đặt luật mới: `due_at > available_from` → "Hạn nộp phải sau thời điểm mở bài."; cùng đó dịch nốt 3 CHECK còn lại (`attempt_limit` 1–20, `late_penalty_percent` 0–100, `max_score > 0`). Constraint nào chưa dịch mà vẫn là `violates check constraint` thì trả câu tiếng Việt chung — **không bao giờ** đẩy nguyên văn tiếng Anh ra giao diện (`EX-21`). Không sửa constraint, không migration, không validate thêm ở client.

**2. `D-12` — user duyệt sửa gọn một lượt 5 file thuộc module đã đóng.** `toLocaleString("vi-VN")` chỉ đổi **ngôn ngữ**, không đổi **múi giờ**: nó vẫn lấy giờ của máy người dùng. Đổi hết sang `formatDateTime`/`formatTime` của `@/lib/dates`. Sau đợt này toàn `src/` chỉ còn **1 chỗ** (`exam-dashboard.tsx:245`, thuộc M17 — để đúng `P17-T2` sửa).

**Xác nhận không đổi nghiệp vụ:** không đổi schema, RPC, RLS, route, phân quyền, công thức hay nhãn nghiệp vụ. Không migration. Ràng buộc vẫn nằm nguyên ở DB — chỉ thêm lớp diễn giải **sau khi** DB đã từ chối.

**Kết quả kiểm tra:** E2E M16 **16/16** (Chromium 8 + Pixel 7 8) — trong đó **một bài dựng lại đúng kịch bản lỗi**: đảo ngược ngày, bấm Giao, khẳng định thấy câu tiếng Việt ở **cả** `Alert` trong dialog **lẫn** toast, quét toàn `body` chắc chắn không còn `violates check constraint` / `exercise_deliveries_check` / `new row for relation`, rồi **đọc DB** xác nhận đếm được `0` bản ghi. Unit mới **6/6** (khoá cả định dạng `dd/MM/yyyy HH:mm` giờ VN lẫn việc `toLocaleString` cho ra `15:05` ở Berlin). Lint ✅ typecheck ✅ Vitest **215/215** ✅ build ✅.

### 2026-07-22 — M00 / Chữ ký thương hiệu — logo to hơn ở mọi bề mặt

**Screen/Component:** `components/shared/logo.tsx` + cả 4 chỗ gọi nó — sidebar desktop, header di động, drawer điều hướng, trang đăng nhập.

**Files changed:** **mới** `public/polymind-lockup.png`, `tests/e2e/brand-logo-responsive.spec.ts`. **Sửa** `src/components/shared/logo.tsx`, `src/components/layout/sidebar-nav.tsx`, `src/components/layout/mobile-nav.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(auth)/layout.tsx`.

**Nguyên nhân gốc (đo được, không phải cảm tính):** file `polymind-logo.png` là ảnh **1254×1254 vuông**, nhưng phần có nội dung chỉ là dải ngang `bbox (50,298)–(1212,829)` = **1162×531**, tức **tỉ lệ 2,19:1 và chỉ lấp 42,3% chiều cao khung**. Component cũ nhận `size` rồi dựng một ô **vuông** `size × size`, nên `object-contain` co chữ ký về đúng `size / 2,19`: ô `size={40}` của sidebar chỉ vẽ ra chữ **cao ~16px** (còn ~15px sau `p-[6%]`). Đó là toàn bộ lý do logo khó nhìn — **tăng số `size` không sửa được**, vì mỗi 1px thêm vào chỉ đổi 0,46px chiều cao chữ và làm ô vuông phình ngang vô ích.

**Thay đổi UI/UX:**

1. **Asset:** cắt hết lề trắng thừa → `public/polymind-lockup.png` 640×292 (đúng tỉ lệ nội dung). Nền được ép về **trắng tuyệt đối `#ffffff`** để trùng khít `--card`/`--background`; file gốc là `#fefdfd` nên trên nền trắng sẽ hiện một ô mờ. Kích thước file **899 KB → 50 KB**.
2. **API component:** `size` (ô vuông) → **`height`** (chiều cao THẬT của chữ ký), bề rộng tự sinh theo `LOGO_ASPECT`. Gọi theo chiều cao vì đó là chiều mắt đem so với chữ đứng cạnh.
3. **`variant`:** `bare` cho nền sáng (bỏ tile trắng + ring vốn thừa khi nền vốn đã trắng) · `plate` giữ tile trắng bo góc cho nền **tối** (trang đăng nhập).
4. **Bỏ chữ "POLYMIND" rời** ở sidebar / drawer / header di động — bản thân logo **đã là** chữ đó, để cả hai là lặp cả về thị giác lẫn với trình đọc màn hình.
5. **Bố cục sidebar + drawer xếp dọc:** logo nằm ngang, đặt cạnh nhãn vai trò thì 216px lọt lòng buộc phải bóp logo lại — đúng thứ đang gây lỗi. Xếp dọc cho logo trọn bề ngang, gạch nhấn cam chuyển thành dấu phân cách trước nhãn vai trò.
6. **`alt`:** thêm prop; trang đăng nhập truyền `alt=""` vì `<h1>POLYMIND CHINESE</h1>` ngay dưới đã đọc tên thương hiệu.

**Chiều cao chữ ký thật (trước → sau):** sidebar **~16px → 36px** · drawer **~16px → 36px** · header di động **~13px → 28px** · đăng nhập **~30px → 52px**.

**Xác nhận không đổi nghiệp vụ:** không đụng query, server action, RPC, RLS, Storage, route, phân quyền, validation, công thức hay nhãn nghiệp vụ. Không migration. Chỉ trình bày.

**Responsive:** đo thật ở 360 / 412 / 1280. Không tràn ngang (`scrollWidth - innerWidth ≤ 1`); ở 360px nhóm trái (hamburger + logo) kết thúc tại 125px trong khi nhóm phải bắt đầu ở 252px — còn dư 127px, không có chèn ép.

**Kết quả kiểm tra:** `brand-logo-responsive.spec.ts` **4/4** (Chromium 2 + Pixel 7 2) — đo `getBoundingClientRect()` của chính thẻ `<img>` chứ không đo ô bọc, kèm `naturalWidth > 0` để bắt trường hợp 404, kèm chốt đúng **một** logo **nhìn thấy được** trên màn. Lint ✅ typecheck ✅ Vitest **209/209** (không đổi baseline) ✅ build ✅. 4 ảnh chụp DPR3 kiểm bằng mắt.

### 2026-07-22 — M16 / P17-T1 — Bài tập (Teacher)

**Screen/Component:** `/teacher/exercises` (giao bài + form giao) · `/teacher/exercises/sets` · `/teacher/exercises/question-bank`.

**Files changed:** **mới** `src/components/ui/native-select.tsx`, `tests/e2e/teacher-exercises-responsive.spec.ts`. **Sửa** `src/features/exercises/teacher/exercise-dashboard.tsx`, `src/features/question-bank/components/question-bank-page.tsx` (**dùng chung với M17**).

**UI/UX changes:** 6 lỗi có bằng chứng chạy được. (1) `UX-UIUX-M16-001` — hạn nộp dùng `toLocaleString("vi-VN")` nên lấy **múi giờ của máy giáo viên**: đo thật, cùng một hạn thì máy Berlin hiện `15:05` còn máy VN hiện `20:05`; đổi sang `formatDateTime` theo `D-12`. (2) `UX-UIUX-M16-002` — ngân hàng câu hỏi **tràn ngang 67px** ở 360px, truy ra `div.flex.shrink-0` rộng 398px trong khung 360px. (3)(4) 11 control không có nhãn gọi được (8 ở form giao bài, 3 ở bộ lọc) + nhóm lớp thành `<fieldset>/<legend>`. (5) gom chuỗi class `<select>` bị chép **6 chỗ** thành `NativeSelect` với `border-input` (1.27:1 → **3.39:1**) và `id` bắt buộc. (6) danh sách thành `<ul>/<li>` thật, meta `text-xs` → `text-sm`, empty state dùng `EmptyState`.

**Behavior preserved:** không đổi query · action · RPC · RLS · Storage · route · phân quyền · validation · công thức · nhãn. Không migration. **Cố ý giữ `<input type="checkbox">` gốc** cho `class_ids`/`allow_late`: gửi nhiều giá trị cùng tên là hành vi nghiệp vụ ("giao một lúc cho nhiều lớp"), không phải trình bày — đổi sang input ẩn của Radix là đổi thứ `DS-003` cấm đổi.

**Responsive:** 360 / 390 / 430 / 768 / 1024 / 1280 trên Chromium và Pixel 7.

**Verification:** E2E **14/14** (Chromium 7/7 + Pixel 7 7/7) · Lint ✅ · Type-check ✅ · Vitest **209/209** ✅ · Build ✅ · fixture tự dọn, 5 bảng đếm cuối đều 0. Claude viết code → **không tự ghi Verified**.

> **Còn mở, cần user quyết:** `UX-UIUX-M16-007` — chọn "Mở từ" muộn hơn "Hạn nộp" thì giáo viên nhận nguyên văn `new row for relation "exercise_deliveries" violates check constraint "exercise_deliveries_check"`. Sửa phải đụng `actions.ts` nên **không tự làm** (`DS-003`, tiền lệ `DS-022`).

> **Ghi nhận trung thực:** có một lượt `/teacher/exercises/sets` trả 404 rồi lượt sau xanh lại mà không đổi dòng code nào — lỗi biên dịch nhất thời của `next dev`. Ghi ra thay vì im lặng, và không dùng nó để bỏ qua test đỏ nào khác.

---

### 2026-07-22 — M20→M27 / P15-T9 — Quality gate liên module học viên

**Screen/Component:** cả 8 bề mặt học viên; `components/shared/student-stat-card.tsx` (mới, dùng chung trong khu vực học viên).

**Files changed:** **mới** `src/components/shared/student-stat-card.tsx`, `tests/unit/components/student-stat-card.test.tsx`, `tests/e2e/student-cross-module.spec.ts`. **Sửa** `src/app/(dashboard)/student/page.tsx`, `src/app/(dashboard)/student/results/page.tsx`, `src/features/tuition/components/student-tuition-overview.tsx`, `src/app/(dashboard)/student/class/page.tsx`.

**UI/UX changes:** hai lỗi thật, không phải soát lấy lệ. (1) `UX-UIUX-M21-009` — dải 7 tab của `/student/class` cuộn ngang ở 360px nhưng **không focus được**, bàn phím không tới được ba tab cuối; ba dải tab học viên còn lại đã có `tabIndex={0}` từ trước nên đây là **sót một chỗ**, sửa đúng bằng cách ba màn kia làm. (2) `UX-UIUX-M25-010` — ô số liệu bento bị chép **ba bản** và ba bản đã trôi khác nhau: chỉ bản Học phí có `tabular-nums`; gom vào `StudentStatCard` lấy **hợp** của cả ba nên không màn nào mất tính năng.

**Behavior preserved:** không đổi query · action · RPC · RLS · Storage · route · phân quyền · validation · công thức · nhãn. Không migration, không đụng dữ liệu production. Thay đổi thị giác duy nhất: cột số ở `/student` và `/student/results` nay thẳng hàng như ở `/student/tuition`.

**Responsive:** **360 / 390 / 430 / 768 / 1024 / 1280** — bậc thang đầy đủ theo Definition of Done, trên Chromium và Pixel 7. Hai mốc mới 390/430 và 1024 **không lộ thêm lỗi bố cục nào**.

**Verification:** E2E liên module **10/10** (Chromium 5/5 + Pixel 7 5/5) · Unit `StudentStatCard` **5/5** · Lint ✅ · Type-check ✅ · Vitest **209/209** (60 file, baseline 204 → **+5**, không sửa/nới/skip test cũ nào) ✅ · Build ✅. Claude viết code → **không tự ghi Verified**.

> **Bài học ghi lại:** chạy riêng file spec thì test axe **xanh**, chạy cả file thì **đỏ**. Nguyên nhân là `next dev` biên dịch route theo yêu cầu, nên lần đầu vào `/student/class` dải tab chưa dựng xong lúc axe đo — tức **lượt chạy riêng mới là lượt sai**, không phải flake của lượt đỏ. Gặp lại kiểu này thì phải truy nguyên nhân, không được kết luận flake rồi bỏ qua.

---

### 2026-07-22 — M27 / P15-T8 — Hồ sơ học viên

**Screen/Component:** `/student/profile` — thông tin học viên (chỉ đọc), form liên hệ, form đổi mật khẩu.

**Files changed:** `src/app/(dashboard)/student/profile/page.tsx`; `src/features/student/components/profile-panel.tsx`; **mới** `tests/unit/components/student-profile-panel.test.tsx`, `tests/e2e/student-profile-responsive.spec.ts`. `student/server/profile-actions.ts` **không sửa**.

**UI/UX changes:** đây là màn **duy nhất trong M20–M27 có thao tác ghi của học viên**, nên trọng tâm là ARIA chứ không phải trang trí. `FieldError` nay có `role="alert"` + `id`; cả 4 ô nhập có `aria-invalid` và `aria-describedby` — **chỉ khi thật sự có lỗi**, để không ô nào bị đọc là "không hợp lệ" ngay lúc mở trang. Yêu cầu mật khẩu **nói ra thành chữ** ("Tối thiểu 8 ký tự.") và ô mật khẩu luôn `aria-describedby` tới nó, khi có lỗi thì trỏ tới cả hai. Lỗi từ `text-xs` → `text-sm`. `CardTitle asChild` → `<h2>` cho cả ba khối. Khối thông tin học viên thành `<dl>`/`<dt>`/`<dd>`. Icon có nền semantic sky/cyan/amber.

**Behavior preserved:** `maxLength` thêm vào **phản chiếu đúng** `contactSchema`/`passwordSchema` (120 · 20 · 72) — không đặt số khác, không tạo luật validation mới, theo nguyên tắc `DS-021`. Không sửa action/schema/route/RLS; không đổi chữ của bất kỳ thông báo nào. Không có migration / API / RLS / Storage / dữ liệu production impact.

**Responsive:** 360 / 768 / 1280 trên Chromium và Pixel 7.

**Verification:** Component **5/5** · E2E **6/6** (gồm kịch bản trạng thái lỗi vẫn sạch axe, và thứ tự Tab) · Lint ✅ · Type-check ✅ · Vitest **204/204** (59 file) ✅ · Build ✅. Claude là người viết code → **không tự ghi Verified**.

---

### 2026-07-22 — M26 / P15-T7 — Học phí học viên (+ `DS-030` sửa contrast dùng chung)

**Screen/Component:** `/student/tuition` — tóm tắt, danh sách hóa đơn, phiếu thu.

**Files changed:** `src/features/tuition/components/student-tuition-overview.tsx`; **dùng chung theo `DS-030`:** `src/components/ui/alert.tsx`, `src/components/shared/status-badge.tsx`, `src/app/globals.css`; **mới** `tests/unit/components/student-tuition-overview.test.tsx`, `tests/e2e/student-tuition-responsive.spec.ts`. `tuition/server/queries.ts` và `student/tuition/page.tsx` **không sửa**.

**UI/UX changes:** bento tóm tắt 4 ô có icon + semantic palette; ô "Hóa đơn quá hạn" nay **nói bằng chữ** ("Không có hóa đơn quá hạn." / "Cần xử lý sớm.") nên màu không còn là kênh thông tin duy nhất. Thêm **thanh tiến độ đóng học phí** với `aria-valuetext` đọc bằng tiền thật, chặn chia cho 0. **Hiện `Tạm tính` và `Giảm trừ`** khi có giảm trừ — hai trường này vốn được truy vấn nhưng không hiển thị ở đâu, học viên được giảm mà không thấy giảm bao nhiêu; chữ lấy nguyên từ màn quản trị (`invoice-manager.tsx:244-245`), không đặt từ mới. `<h2>`/`<h3>`/`<h4>` thật, hết nhảy cấp heading. Gỡ toàn bộ `text-xs` cho thông tin tài chính (hạn đóng, mã phiếu thu, tham chiếu…). Khối tiền thành `<dl>`. `bg-muted/30` → `bg-surface-sunken`. Gỡ icon trang trí bị xuống dòng lạc lõng ở 360px.

**`DS-030` — hai lỗi contrast AA có thật ở tầng dùng chung, user duyệt trước khi sửa:** `alert.tsx` bỏ `text-destructive/90` (`#E03C3C` trên trắng = **4.30:1**) → `text-destructive` (**4.83:1**); thêm token `--danger-ink: #B91C1C` và `StatusBadge` tone `danger` dùng nó (`#DC2626` trên `#FBE5E5` = **4.01:1** → **5.37:1**), nền/viền giữ nguyên. Đã đo cả 5 tone — `success` 5.95, `warning` 5.88, `info` 5.58 đều đạt, chỉ `danger` hỏng. Lỗi **có sẵn từ trước**; fixture hóa đơn quá hạn chỉ làm lộ ra. Impact map đầy đủ trong `DS-030`.

**Behavior preserved:** Route, query, action, RPC, RLS, công thức số dư, nhãn nghiệp vụ, chữ của mọi cảnh báo — không đổi. `--destructive` giữ nguyên; ba tone badge còn lại giữ nguyên. Không có migration / API / RLS / Storage / dữ liệu production impact.

**Responsive:** 360 / 768 / 1280 trên Chromium và Pixel 7.

**Verification:** Component **8/8** · E2E **4/4** · Lint ✅ · Type-check ✅ · Vitest **199/199** (58 file) ✅ · Build ✅. Claude là người viết code → **không tự ghi Verified**.

---

### 2026-07-22 — M25 / P15-T6 — Kết quả học viên

**Screen/Component:** `/student/results` — ba tab Điểm · Đánh giá · Tiến độ.

**Files changed:** `src/app/(dashboard)/student/results/page.tsx`; **mới** `tests/unit/components/student-results-page.test.tsx`; **mới** `tests/e2e/student-results-responsive.spec.ts`. `src/features/student/server/result-queries.ts` **không sửa một dòng nào** — chỉ đọc để đối chiếu ngữ nghĩa dữ liệu.

**UI/UX changes:** thêm bento tổng quan bốn ô ở đầu trang (Điểm trung bình · Tiến độ khóa học · **Chuyên cần** · Bài đã nộp) — `attendance_rate` trước đây được truy vấn rồi bỏ không, trong khi trang lại nhắc "điều kiện gồm chuyên cần". Thanh tab thành `nav` có nhãn/focus ring nền `student-sky`, ba tab có icon và badge tròn đếm số, theo đúng mẫu M21/M24. Mọi khu vực có `<h2>` thật, mỗi thẻ có `<h3>` qua `CardTitle asChild` — trước đó cả trang **không có một heading cấp 2 nào**. Mỗi kết quả có thanh tỉ lệ điểm với `aria-valuenow`/`aria-valuetext`, **chặn chia cho 0** khi `max_score ≤ 0`. Tab Tiến độ có thanh tiến độ thật (trước chỉ in phần trăm thành chữ) và bỏ hai ô trùng với bento. Gỡ đủ **7 chỗ** `text-xs` cho nội dung thật. Link "Xem chi tiết…" có focus ring. Empty state điểm có lối đi tiếp.

**Hai lỗi nội dung tự gây ra, bắt được bằng ảnh chụp, đã sửa trước khi đóng:** (1) chú thích khẳng định `progress_percent` là tỉ lệ bài học — thực tế `pg_get_viewdef` cho thấy nó là **tổng hợp có trọng số** `0.40×bài học + 0.30×chuyên cần + 0.15×bài nộp + 0.15×điểm`; (2) in `avg_score` thành "80" trần trong khi view **đã quy về thang 100**, đứng ngay trên các thẻ điểm dạng `8/10`. Nay hiển thị `80/100` và có test khoá lại. Chi tiết ở §3 báo cáo M25.

**Behavior preserved:** Route, query, action, RPC, RLS, công thức tiến độ, nhãn nghiệp vụ — không đổi. Không thêm/bớt trường dữ liệu nào. `?tab=` vẫn chỉ đọc chứ không ghi (`DS-012`; `DS-024` chỉ mở ngoại lệ cho M14). Không có migration / API / RLS / Storage / dữ liệu production impact.

**Responsive:** 360 / 768 / 1280 trên Chromium và Pixel 7.

**Verification:** Component **7/7** · E2E **4/4** (`--repeat-each=2` → **8/8**, không flake) · Lint ✅ · Type-check ✅ · Vitest **191/191** (57 file) ✅ · Build ✅. Claude là người viết code → **không tự ghi Verified**.

---

### 2026-07-22 — M24 / P15-T5a — Ôn tập học viên (nửa Ôn câu sai)

**Screen/Component:** khung `/student/review` + tab Ôn câu sai. ⏸ Tab Flashcard **không đụng tới**, hoãn theo `DS-028`.

**Files changed:** `src/app/(dashboard)/student/review/page.tsx`; `src/features/wrong-answer-review/components/wrong-answer-review.tsx`; `tests/unit/components/wrong-answer-review.test.tsx`; `tests/unit/components/student-review-page.test.tsx`; **mới** `tests/e2e/student-review-responsive.spec.ts`. `student-flashcard-reader.tsx`, `QuestionRenderer`, `StudentAudioPlayer` **không sửa**.

**UI/UX changes:** thanh tab thành `nav` có nhãn/focus ring nền `student-sky`, hai tab có icon và tab Ôn câu sai mang số câu còn lại. Thêm bento tổng quan bốn ô (còn cần ôn · từ Bài tập · từ Bài thi · sai nhiều lần) tính từ dữ liệu đã tải, kèm `role="progressbar"` đo tiến độ phiên ôn. Thẻ câu hỏi có `<h2>` thật, header semantic và dòng "Sai gần nhất ngày …" lấy từ `last_seen_at` vốn bị bỏ không. **Vùng `aria-live` nay thường trú trong DOM** — trước đó nó nằm trong `<Alert>` chỉ render khi đã có thông báo nên trình đọc màn hình bỏ qua kết quả chấm. Tách tone "chưa đúng, làm lại" (amber) khỏi tone lỗi hệ thống (destructive). Gỡ ba `min-h-11` chép cứng theo `DS-013`. Empty state có hai lối đi tiếp.

**Behavior preserved:** `submitWrongAnswerReviewAction` và mọi tham số gọi nó, `hasAnswer`, luật câu đúng rời hàng đợi, chỉ số sau khi rời, `audioPlayback="student-source"`, toàn bộ chữ của nhãn tab, `toast` và thông báo server — không đổi một chữ. Không có migration / API / RLS / Storage / dữ liệu production impact.

**Responsive:** 360 / 768 / 1280 trên Chromium và Pixel 7.

**Verification:** `wrong-answer-review` **5/5** (2 test cũ chạy nguyên, không sửa không nới; +3 mới) · `student-review-page` **2/2** (assertion nhãn tab chặt hơn: khớp mẫu **kèm** kiểm số đếm) · full Vitest **184/184** (56 file) · Playwright Chromium **1/1** + Pixel 7 **1/1**, axe `wcag2a/2aa/21a/21aa` sạch, không overflow, fixture tự dọn (queue/question/set cuối đều 0) · lint/typecheck/build xanh. Ảnh 360 và 1280 kiểm bằng mắt — ảnh desktop lộ khoảng trắng thừa ~64px giữa header và câu hỏi, đã gỡ `pt-5`. Pixel 7 ở 768 từng báo contrast `2.31:1`; truy ra là axe đo trúng lúc `TabsTrigger` còn transition (màu pha `#5b82ab`/`#aac8e4` không tồn tại trong hệ màu) — sửa bằng cách đợi màu ổn định rồi mới đo, **không nới ngưỡng axe**; chạy lại 3 lần cả hai project đều xanh.

**Trạng thái:** `PARTIAL — chờ xác minh độc lập`. **Không** nâng `DONE` cho tới khi `P15-T5b` Flashcard hoàn tất. Claude viết code này nên không tự ghi Verified.

---

### 2026-07-22 — M23 / P15-T4 — Kiểm tra / Thi học viên

**Screen/Component:** `/student/exams` + phòng chờ + lượt thi + kết quả.

**Files changed:** route danh sách/kết quả M23; `exam-waiting-room.tsx`, `exam-attempt.tsx`; component test waiting/attempt và E2E responsive có fixture tự dọn. `ExamIntegrityBoundary` và shared result foundation không sửa.

**UI/UX changes:** thêm summary bento từ dữ liệu thật; card/status/empty semantic; phòng chờ ba bước; lượt thi có hero ngữ cảnh, timer semantics, live save/error và heading từng câu; wrapper kết quả đồng nhất M22. E2E bắt và sửa KPI tính trùng lượt đang thi vào “sẵn sàng”.

**Behavior preserved:** giữ nguyên precedence/href, AudioContext/micro, cam kết, fullscreen, timer/save/submit/upload/scoring/answer release/anti-leak/player, query/action/RPC/RLS. Không có migration hoặc dữ liệu production impact.

**Verification:** target component **11/11**; full Vitest **180/180** (56 file); Playwright Chromium + Pixel 7 xanh cho list/waiting/attempt/result tại 360/768/1280, axe A/AA và không overflow; 9 ảnh kiểm bằng mắt; fixture question/version/delivery/attempt/integrity cuối đều 0; lint/typecheck/build xanh.

> Codex vừa thiết kế vừa sửa nên M23 ở trạng thái `DONE — chờ xác minh độc lập`. Theo yêu cầu user, dừng sau P15-T4 và chưa claim P15-T5.

---

### 2026-07-22 — M22 / P15-T3 — Bài tập học viên

**Screen/Component:** `/student/exercises` + lượt làm + kết quả; shared result foundation cho M22/M23.

**Files changed:** route list/result M22; `exercise-list.tsx`, `exercise-attempt.tsx`, `result-view.tsx`; 3 component test mục tiêu và E2E responsive có fixture tự dọn.

**UI/UX changes:** danh sách có 4 summary bento thật và 5 tab icon/count; mobile dùng lưới KPI 2×2 để CTA xuất hiện sớm. Card có `<h2>`, metadata ≥14px, status không giả thành disabled action. Lượt làm có hero xanh, `<h1>`, hướng dẫn/hạn/thang điểm/số câu, saved live region/error alert và `<h2>` từng câu. Kết quả bỏ gradient/raw color, dùng hero xanh + semantic block và progressbar ARIA.

**Behavior preserved:** giữ nguyên cách phân nhóm, tab URL khởi tạo, start/resume/result href, auto-save, upload Nói, confirmation, submit/redirect, scoring, answer release/anti-leak, player P14-T12, query/action/RPC/RLS. `QuestionRenderer`, `SpeakingRecorder`, `MicrophoneCheck` không sửa. `result-view.tsx` có hai consumer đều là kết quả học viên M22/M23; M23 được hưởng visual foundation nhưng vẫn audit riêng.

**Responsive/a11y:** Chromium + Pixel 7 đều **1/1**; list/attempt/result ở 360/768/1280, axe A/AA không violation, không overflow, keyboard manual activation xanh. Axe vòng hai phát hiện vùng tab cuộn tablet thiếu focus; thêm `tabIndex` + focus ring rồi chạy lại xanh. 9 ảnh cuối đã xem trực tiếp.

**Fixture:** local-only, tạo đủ 5 trạng thái + attempt/result bằng `docker exec`, dọn con→cha sau test; xác minh question/version/delivery count đều 0. Không tác động cloud/production.

**Kết quả kiểm tra:** target **6/6** · lint ✅ · typecheck ✅ · Vitest **179/179** (55 file) · production build ✅ · diff check không có whitespace error.

> Codex vừa thiết kế vừa sửa nên M22 ở trạng thái `DONE — chờ xác minh độc lập`, không tự ghi Verified.

---

### 2026-07-22 — M21 / P15-T2 — Lớp của tôi (Học viên)

**Screen/Component:** `/student/class` — đủ 7 tab read-only.

**Files changed:** `src/app/(dashboard)/student/class/page.tsx`, component test M21 và E2E responsive M21. Không sửa `SessionCalendar`, `MaterialList` hoặc query/server.

**UI/UX changes:** thêm class identity banner và tab journey có icon; mỗi khu vực dùng section card với `<h2>` thật và tone sky/cyan/amber/coral hỗ trợ. Bài tập, kiểm tra và lịch sử chuyên cần chuyển sang mobile stack; metadata tối thiểu 14px; bỏ `truncate` cho tên/URL/nội dung chính. Xanh thương hiệu vẫn là màu điều hướng/hành động chủ đạo, amber/coral chỉ phân nhóm nội dung.

**Behavior preserved:** giữ nguyên 7 tab/value/defaultValue, keyboard Radix, route redirect cũ, mọi query/href/nhãn/badge, công thức tiến độ/chuyên cần, read-only/RLS và không hiện roster. Không có migration, data/API/Storage impact.

**Responsive/a11y:** Chromium + Pixel 7 đều xanh. Đã đo/chụp 360/768/1280, không page overflow, axe WCAG A/AA không có violation. Lần đầu axe bắt tab chưa chọn chỉ đạt 4.11:1 trên nền sky; sửa bằng semantic ink 8.04:1 rồi chạy lại xanh. Ảnh thật xác nhận mobile một cột, tablet hai cột, desktop đủ 7 tab.

**Kết quả kiểm tra:** component M21 **2/2** · E2E Chromium **1/1** · E2E Pixel 7 **1/1** · lint ✅ · typecheck ✅ · Vitest đầy đủ **176/176** (54 file) · production build ✅ · `git diff --check` không có whitespace error.

> Codex vừa thiết kế vừa sửa nên M21 ở trạng thái `DONE — chờ xác minh độc lập`, không tự ghi Verified.

---

### 2026-07-22 — M20 / P15-T1 — Tổng quan học viên

**Screen/Component:** `/student` + semantic palette student-only.

**Files changed:** `src/app/(dashboard)/student/page.tsx`, `src/app/globals.css`, component test M20 và E2E responsive M20.

**UI/UX changes:** dashboard thành Learning Journey Bento. Hero xanh thương hiệu ưu tiên buổi học kế tiếp; ba KPI dùng amber/cyan/coral gần màu gốc; cam/đỏ vẫn là điểm nhấn thương hiệu. Các section có `<h2>` thật, metadata lên `text-sm`, tên dài không bị truncate; empty/error/loading vẫn dùng shared state hiện có.

**Behavior preserved:** không sửa `student-queries.ts`, route, `requireRole`, RLS, dữ liệu, công thức, nhãn hoặc href. 12 token mới chỉ có consumer trong student page; không đổi token cũ hay giao diện Admin/Teacher.

**Responsive/a11y:** Playwright Chromium **1/1** ở 360/768/1280, không overflow, axe WCAG A/AA không có violation. Ảnh đầu phát hiện KPI quá hẹp ở 768; sửa 3→2 cột, thêm assertion card ≥180px rồi chụp lại đạt. Mobile một cột; desktop hero 7/12 + KPI 5/12.

**Kết quả kiểm tra:** component M20 **2/2** · lint ✅ · typecheck ✅ · Vitest đầy đủ **175/175** (54 file) · production build ✅. Build sandbox đầu chỉ lỗi tải Be Vietnam Pro do mạng; chạy lại với quyền mạng thành công.

> Codex vừa thiết kế vừa sửa nên M20 ở trạng thái `DONE — chờ xác minh độc lập`, không tự ghi Verified.

---

### 2026-07-22 — P14-T12 / M22–M24 — Tốc độ audio nguồn cho học viên

**Screen/Component:** player audio học viên dùng chung ở lượt làm và kết quả Bài tập/Thi, Flashcard và Ôn câu sai.

**Files changed:**

- `src/components/shared/student-audio-player.tsx` — component mới, hai presentation `controls`/`button`
- `src/features/question-builder/renderers/question-renderer.tsx`
- `src/features/{exercises,exams}/student/*-attempt.tsx`
- `src/features/assessment-results/components/result-view.tsx`
- `src/features/flashcards/components/student-flashcard-reader.tsx`
- `src/features/wrong-answer-review/components/wrong-answer-review.tsx`
- 4 file component test liên quan

**UI/UX changes:** mọi audio nguồn do giáo viên/Super Admin tải lên ở M22–M24 có đúng `0.5× · 0.75× · 1×`, mặc định `1×`; nút đang chọn có `aria-pressed`, group có tên truy cập, hỗ trợ bàn phím/touch và giữ cao độ qua `preservesPitch` khi browser hỗ trợ. Đổi signed URL reset về `1×`. Flashcard giữ giao diện một nút phát/dừng gọn; bộ chọn tốc độ nằm cạnh nút.

**Boundary preserved:** bản ghi Nói do học viên tự thu vẫn dùng player riêng và **không có** bộ chọn tốc độ. Không đổi API, DB, RLS, Storage, pipeline upload/signed URL, cách chấm hay dữ liệu nghiệp vụ.

**Responsive:** bộ chọn dùng `flex-wrap` + `gap-2`; touch target hưởng luật coarse-pointer 44px dùng chung. Không thêm breakpoint hoặc chiều cao chép cứng.

**Kết quả kiểm tra:** component test mục tiêu ✅ **8/8** · lint ✅ · typecheck ✅ · Vitest đầy đủ ✅ **173/173** (53 file) · production build ✅. Build sandbox đầu tiên chỉ lỗi tải Google Font do chặn mạng; chạy lại với quyền mạng thành công.

> Codex là người sửa nên không tự ghi Verified. Cần Claude/user smoke media thật trên desktop/mobile, gồm reset `1×` khi đổi câu và xác nhận bản ghi Nói không có tốc độ.

---

### 2026-07-21 (đợt 6) — M14 — Lớp của tôi (Teacher)

**Screen/Component:** 5 subtask. `S01` màn A lưới thẻ lớp · `S02` màn C trang nhật ký · `S03` màn C form nhật ký (`DS-025`) · `S04` màn B khung trang + 8 tab (`DS-024`) · `S05` màn B nội dung trong tab (`DS-023`).

**Files changed (5):**

- `src/app/(dashboard)/teacher/classes/page.tsx`
- `src/app/(dashboard)/teacher/classes/[id]/page.tsx`
- `src/app/(dashboard)/teacher/sessions/[id]/page.tsx`
- `src/features/sessions/components/session-log-form.tsx` — `DS-025`, chỉ trình bày + ARIA
- `src/lib/domain/labels.ts` — `DS-023`, **thêm** `EXERCISE_DELIVERY_STATUS_LABELS` + `_TONE`; không sửa map nào đã có

**UI/UX changes:**

- **Tab nằm trong URL rồi.** 8 tab của màn B chuyển từ state React sang `?tab=`: chia sẻ được link tới đúng tab, Back quay về đúng tab, F5 không mất chỗ đang đứng. `?tab=` lạ rơi về "Tổng quan" (fail-closed). `activationMode="manual"` để mũi tên dời focus mà chưa đổi tab — `Tabs` là controlled, `automatic` sẽ làm `aria-selected` lệch khỏi focus.
- **Hết enum thô lọt ra giao diện.** Tab Bài tập không còn in `results_published`, tab Kiểm tra không còn in `mock_hsk`. Map mới bắt được một bug thầm lặng: code cũ gộp **7 trạng thái** — kể cả `cancelled` — vào chung màu xám.
- **10/10 khối nội dung nay có heading thật.** `CardTitle asChild` + `<h2>` cho cả màn B và C — trình đọc màn hình nhảy được giữa các khối trong một trang ~700 dòng. **Không sửa `ui/card.tsx`**: `asChild` đã có sẵn từ `M13-S01`.
- **Lỗi form được đọc lên.** `FieldError` thêm `role="alert"` + `id`; 3 control thêm `aria-invalid` + `aria-describedby` — **chỉ khi thật sự có lỗi**. Trước đây bấm "Hoàn tất buổi" mà thiếu trường thì người dùng trình đọc màn hình chỉ thấy như không có gì xảy ra.
- **Giờ kết thúc buổi không bị cắt nữa.** Bỏ `truncate` ở 3 thẻ tóm tắt màn C — ở 640–768px mỗi thẻ chỉ còn ~148px và `truncate` đang cắt đúng dữ liệu chính của thẻ.
- **Focus ring cho 3 link còn thiếu** (thẻ lớp màn A, link quay lại màn B và C) — mẫu lỗi này nay đã lặp **lần thứ năm và thứ sáu** qua 4 module.
- **Vùng cuộn 8 tab có bóng mép** báo còn tab bên phải; bóng tắt khi cuộn hết và không hiện khi tab đủ chỗ. Thuần CSS `background-attachment: local/scroll`, **không thêm một dòng JS**.
- **Hết `text-xs` cho nội dung thật** ở cả 4 file (`grep` trả về 0); hết `h-11` chép cứng ở 2 nút submit (`DS-013`); hết alpha ngẫu hứng `primary/40`, `muted/20`, `primary/10` → dùng token `primary-50`/`primary-300`/`primary-700`.
- **4 chỉ số tiến độ ở mobile** từ 4 dòng 12px thành lưới 2×2 cỡ `text-sm`.
- **Link phòng học trực tuyến** thêm icon `ExternalLink` + `aria-label` nói rõ là mở tab mới.

**Problems resolved:** `UX-M14-001`, `-003` … `-010`, `-013` … `-018` — **15/19 FIXED**. Còn `-011`, `-012`, `-019` ở trạng thái "chỉ ghi nhận" (lý do ở §9 báo cáo M14); `-002` đã rút lại từ đợt 5.

**Behavior preserved:** không đổi route, `requireRole`, RLS, query, database, đích của link nào, `name`/`value` của field, `maxLength`, `saveSessionLogAction`, hộp xác nhận, `NAVIGATION` sidebar. Không thêm `"use client"` vào page nào. Không sửa file nào trong `src/components/`. Ngoại lệ duy nhất chạm nhãn là `DS-023` — **thêm** map mới, user duyệt từng chữ trong phiên; không sửa map nào đã tồn tại.

**Responsive:** ⚠️ **CHƯA ĐO BẰNG TRÌNH DUYỆT THẬT** — phiên này không có Docker/`supabase start` nên không dựng được trang có dữ liệu. §8 báo cáo M14 ghi rõ 4 tầng cần kiểm và ca dễ sai nhất (1280px: tab đủ chỗ thì bóng mép **không được** hiện). Đây là lý do module dừng ở `IMPLEMENTED`, không phải `DONE`.

**Kết quả kiểm tra:** lint ✅ · typecheck ✅ · test ✅ **170/170** (52 file, 122.5s — bằng đúng số trước phiên, không thêm/sửa/nới/skip test nào) · build ✅ `Compiled successfully in 24.4s`.

> ⚠️ Claude vừa audit vừa sửa nên **không tự ghi Verified**. Ưu tiên xác minh: `?tab=` (Back/F5/share/giá trị lạ), bàn phím trên tab strip, lỗi form màn C đọc bằng trình đọc màn hình. Danh sách đầy đủ ở §8 báo cáo M14.

---

### 2026-07-21 (đợt 4) — M15 — Điểm danh

**Screen/Component:** 4 subtask + 1 sửa nghiệp vụ có duyệt. `M15-S01` màn A chọn buổi · `M15-S02` hàng học viên · `M15-S03` thanh Lưu · `M15-S04` hộp xác nhận "Đánh dấu nhanh" (phát sinh từ `DS-020`) · `UX-M15-014` bug nghiệp vụ (`DS-022`).

**Files changed (5):**

- `src/app/(dashboard)/teacher/attendance/page.tsx`
- `src/features/attendance/components/attendance-roster.tsx`
- `src/features/attendance/server/actions.ts` — **ngoài phạm vi UI/UX**, user duyệt `DS-022`
- `tests/unit/components/attendance-roster.test.tsx` — bọc `ConfirmationProvider` + 4 test mới
- `tests/unit/server/attendance-actions.test.ts` — **file mới**, 4 test

**UI/UX changes:**

- **Hết `<button>` lồng trong `<a>`.** Nút "Điểm danh" ở màn A thành `<span className={buttonVariants(…)}>` — thị giác giống hệt, nhưng mỗi hàng còn **một** điểm dừng Tab thay vì hai trỏ cùng một đích.
- **Bấm nhầm khó hơn.** Khoảng cách 4 nút trạng thái 4px → 8px. Đây là bề mặt dễ bấm nhầm nhất ứng dụng: bấm bằng ngón cái, giữa buổi dạy, bấm nhầm là ghi sai trạng thái học viên.
- **Không còn mất trắng lựa chọn đã bấm.** "Tất cả có mặt" nay hỏi lại — nhưng **chỉ khi thật sự có dữ liệu sẽ mất**. Bấm trên danh sách trắng hoặc bấm lại đúng nút vừa bấm vẫn đi thẳng, không thêm thao tác.
- **20 ô ghi chú hết giống hệt nhau** với trình đọc màn hình: `aria-label="Ghi chú cho <tên>"`. Không đổi gì trên màn hình, không đổi `name` → FormData y nguyên.
- **Footer đọc được trở lại.** Thanh Lưu `fixed` → `sticky`: vẫn dính đáy suốt lúc cuộn danh sách, nhả ra khi tới cuối form → `SiteFooter` hiện đủ, trả lại `D-17`. Bỏ luôn `md:left-64` chép cứng chiều rộng sidebar, và `backdrop-blur` trang trí (governance §3).
- **Hết `text-xs` cho nội dung thật** trong cả hai file (`UX-M00-004`); hết `h-11` chép cứng (`DS-013`) — `min-w-22` thay `min-w-[5.5rem]`, `SubmitButton size="lg"` thay `className="h-11 px-6"`.
- **Ghi chú không còn bốc hơi.** Gõ ghi chú mà quên chọn trạng thái thì trước đây toast báo **thành công** trong khi chữ đã mất. Nay chặn cả lượt lưu, nêu số học viên và hai cách xử lý; form không reload nên chữ vừa gõ còn nguyên.

**Problems resolved:** `UX-M15-001` … `UX-M15-014` — **14/14**.

**Behavior preserved:** không đổi route, query param, đích link, nhãn hiển thị, `name` của field, `recordSchema`, RPC `bulk_mark_attendance`, bảng, RLS. Không sửa file nào trong `src/components/` — `ConfirmationProvider` chỉ được **dùng lại**. Hai ngoại lệ **có user duyệt trong phiên**: `maxLength={300}` (`DS-021`, chạm validation) và sửa `actions.ts` (`DS-022`, chạm nghiệp vụ).

**Responsive:** 360px — 4 nút vẫn xếp 2×2 sau khi giãn gap (2×88 + 8 = 184px trong ~328px khả dụng), không scroll ngang. 768–1024px — 4 nút một hàng. 1280px+ — thanh Lưu nằm gọn trong vùng main, không tràn sidebar. Cả 3 tầng: `sticky` nhả ra để lộ footer ở cuối form (đã kiểm không tổ tiên nào `overflow: hidden`).

**Kết quả kiểm tra:** lint ✅ · typecheck ✅ · test ✅ **170/170** (52 file; trước phiên 162 → +8 test mới, không sửa/nới/skip test cũ) · build ✅ `Compiled successfully in 16.1s`.

> ⚠️ Claude vừa audit vừa sửa nên **không tự ghi Verified**. `UX-M15-014` đặc biệt cần Codex dựng lại kịch bản: gõ ghi chú cho một học viên, **không** chọn trạng thái, bấm Lưu → phải thấy lỗi nêu số người, và chữ vừa gõ còn nguyên trong ô.

---

### 2026-07-21 (đợt 3) — M00 — Shared Foundation

**Screen/Component:** 2 subtask — `M00-S09` viền control · `M00-S10` error boundary. Mở lại M00 lần 3 sau khi audit M15 phát hiện `--border-strong` chưa từng có consumer; user duyệt `DS-017` và `DS-018`.

**Files changed (3):**

- `src/app/globals.css` — `--input: #dde5ee` → `#7c8da4`
- `src/app/(dashboard)/error.tsx` — **file mới**
- `src/app/global-error.tsx` — **file mới**

**UI/UX changes:**

- **Viền ô nhập nhìn thấy được.** `input`, `textarea`, `checkbox`, `radio`, `select`, `calendar` đi từ **1.27:1** lên **3.39:1** — đạt WCAG 1.4.11. Trước đó `--border-strong` được thêm ở S01 nhưng **không component nào dùng**, nên `UX-M00-002` thực chất vẫn còn nguyên. Viền **bảng** cố ý không đổi (kẻ phân cách không thuộc phạm vi 1.4.11).
- **Hết trang lỗi tiếng Anh.** Query lỗi giờ ra card tiếng Việt "Không tải được nội dung" **giữ nguyên sidebar/header**, có "Thử lại" (`reset()`) và "Về trang chủ". Chỉ hiện `error.digest`, không hiện `error.message` — tránh lộ tên bảng/chi tiết RLS (`EX-21`, `EX-22`).

**Problems resolved:** `UX-M00-002` (lần này là thật), `UX-M13-009`.

**Behavior preserved:** không đụng một dòng query/action/route/permission/validation nào. `error.tsx` không tạo URL mới; `requireUser()` ở layout vẫn chạy trước.

**Responsive:** S09 chỉ đổi màu, không đổi kích thước. S10 card `max-w-lg`, nút `flex-wrap`; không scroll ngang ở 360/768/1280.

**Kết quả kiểm tra:** lint ✅ · typecheck ✅ · test ✅ 162/162 (`--maxWorkers=4`, 68.38s) · build ✅ `✓ Compiled successfully in 14.5s`.

### 2026-07-21 — M13 — Hôm nay (Teacher)

**Screen/Component:** 3 subtask — `M13-S01` `CardTitle asChild` · `M13-S02` cột trái (Lịch dạy · Buổi chưa điểm danh · Bài chờ chấm) · `M13-S03` cột phải (Lớp của tôi · Học viên cần chú ý).

**Files changed (2):**

- `src/components/ui/card.tsx` — `CardTitle` nhận prop **tuỳ chọn** `asChild` (dùng `Slot.Root` của radix-ui, đúng cách `button.tsx`/`badge.tsx` đã làm)
- `src/app/(dashboard)/teacher/page.tsx` — toàn bộ 5 khối

**UI/UX changes:**

- **Cấu trúc heading:** trang từ chỗ chỉ có 1 `<h1>` nay có 1 `<h1>` + 5 `<h2>` — trình đọc màn hình nhảy được giữa 5 khu vực.
- **Focus nhìn thấy được** cho hàng "Lớp của tôi": trước đây tab bàn phím qua danh sách lớp không có dấu hiệu gì.
- **Hết `text-xs` trong trang:** mã lớp, chủ đề buổi, ngày nộp, sĩ số, mã học viên — tất cả lên `text-sm` + `--text-secondary` (7.81:1). Mã lớp không còn là chữ nhỏ nhất trên hàng nó dùng để nhận dạng.
- Mép trái tiêu đề và nội dung thẳng hàng (`px-5` → `px-6`).
- "Nhật ký" hạ xuống `ghost` để không cạnh tranh với "Điểm danh".
- `title` cho chữ bị cắt; `overflow-hidden` cho card có hàng nền-hover chạm mép.

**Problems resolved:** `UX-M13-001` … `UX-M13-008`. `UX-M13-009` (không có error boundary trong `src/app/`) **ghi nhận, chưa sửa** — chờ user quyết phạm vi.

**Behavior preserved:**

- Route: unchanged — mọi `href` giữ nguyên từng ký tự
- Permission: unchanged — `requireRole("teacher")` không đụng
- API contract: unchanged — `teacher-queries.ts` không sửa một dòng
- Validation / Business logic / Database: unchanged
- Nhãn, nội dung tiếng Việt: unchanged

**Responsive:**

- Mobile 360–430px: một cột, hàng vẫn `flex-wrap`; chữ 14px thay 12px làm hàng cao thêm ~2px. Không scroll ngang cấp trang.
- Tablet 768–1024px: một cột, bố cục không đổi.
- Desktop 1280px+: hai cột như cũ.

**Verification:**

- Lint: ✅ Pass
- Type-check: ✅ Pass
- Test: ✅ **162/162** (`npm test -- --maxWorkers=4`, 55.93s)
- Build: ✅ Pass — `✓ Compiled successfully in 18.6s`
- `grep "text-xs|px-5|text-muted-foreground|bg-muted" teacher/page.tsx` → **0**

> Người sửa là Claude → **chưa Verified**. Cần xác minh độc lập: đăng nhập giáo viên, tab bàn phím qua "Lớp của tôi" để thấy focus ring, kiểm mép trái thẳng hàng, kiểm 360px không scroll ngang.

---

### 2026-07-21 (đợt 2) — M00 — Shared Foundation: thang kích thước control + xoá dark mode

**Screen/Component:** 3 subtask — `M00-S06` thang kích thước control · `M00-S07` luật 44px cho link · `M00-S08` xoá dark mode.

Mở lại M00 sau khi user duyệt 4 quyết định treo: `DS-013` (gỡ chặn `DS-010`), `DS-014`, `DS-015`, `DS-016` (thay `DS-009`).

**Files changed (15):**

- `src/components/ui/button.tsx` — 8 size hết đồng loạt 44px: `xs` 32 / `sm` 36 / `default` 40 / `lg` 44; `icon-xs` 32 / `icon-sm` 36 / `icon` 40 / `icon-lg` 44
- `src/components/ui/input.tsx`, `src/components/ui/select.tsx` — `h-11` → `h-10` cho khớp `Button default`
- `src/app/globals.css` — `@media (pointer: coarse)` thành nơi duy nhất ép 44px (thêm `input`/`textarea`/`select`, thêm `min-width` cho nút icon, thêm `p a[href] { min-height: 0 }`); gỡ `@custom-variant dark` và khối `.dark` (38 dòng)
- `src/components/ui/{badge,calendar,checkbox,dropdown-menu,radio-group,switch,tabs,textarea}.tsx` + `button`/`input`/`select` — gỡ 35 class `dark:`
- `src/features/question-builder/components/question-picker.tsx` — gỡ 1 class `dark:`
- `src/components/ui/sonner.tsx` — bỏ `useTheme()`, khoá `theme="light"`

**UI/UX changes:**

- Desktop có phân cấp kích thước thật: hành động chính, hành động phụ và nút icon trong hàng bảng không còn cùng một chiều cao 44px.
- Cảm ứng **không đổi**: vẫn ≥44px, và nút icon nay bảo đảm 44px cả chiều ngang (trước chỉ đúng nhờ tình cờ dùng `size-11`).
- Link chữ chạy trong đoạn văn không còn bị luật touch target đụng tới.
- Ứng dụng chỉ còn một bộ màu Light. Hết một tầng token chết mà mọi module sau phải né.

**Problems resolved:** `UX-M00-003`, `UX-M00-006`, `UX-M00-007`, `UX-M00-014` (mới). `UX-M00-013` đóng `WONTFIX` theo `DS-015`.

**Behavior preserved:**

- Route / Permission / API contract / Validation / Business logic / Database: unchanged
- Nhãn, nội dung, thứ tự field: unchanged
- Không thêm variant nút mới (`DS-007`), không thêm thư viện (`DS-008`)
- Không thêm ignore/disable rule nào

**Responsive:**

- Mobile 360–430px: không đổi — nhánh `(pointer: coarse)` giữ nguyên 44px.
- Tablet 768–1024px: cảm ứng theo nhánh `coarse`; tablet dùng chuột theo nhánh `fine`.
- Desktop 1280px+: control thấp hơn 4–12px, mật độ tăng. Không có chiều rộng nào tăng ⇒ không phát sinh scroll ngang.

**Verification:**

- Lint: ✅ Pass
- Type-check: ✅ Pass
- Test: ✅ **162/162** (`npm test -- --maxWorkers=4`, 51 file, 69.38s) — không sửa/nới/skip test nào
- Build: ✅ Pass — `✓ Compiled successfully in 18.2s`
- `grep -rn "dark:" src` → 0 class; `grep -rn "next-themes" src` → 0

> Người sửa là Claude → **chưa Verified**. Cần xác minh độc lập: đo chiều cao nút trên desktop, mở DevTools chế độ cảm ứng kiểm 44px, và bật dark mode ở cấp hệ điều hành để xác nhận toast không còn tối.

---

### 2026-07-21 — M00 — Shared Foundation

**Screen/Component:** 5 subtask — Design token · Sidebar+drawer · Header/user menu/chuông · Nền trang · Shared feedback.

**Files changed:**

- `src/app/globals.css` — thêm thang `--primary-50…950`, `--border-strong`, `--surface-page`, `--surface-sunken`, `--text-secondary`, `--text-disabled`; sửa `--info`; đổi `--muted`
- `src/app/(dashboard)/layout.tsx` — `bg-muted/30` → `bg-surface-page`
- `src/components/layout/nav-links.tsx` — thêm focus-visible ring
- `src/components/layout/mobile-nav.tsx` — thêm gạch nhấn cam
- `src/components/ui/sheet.tsx` — animation 500/300ms → 300/200ms
- `src/components/layout/user-menu.tsx` — nút Đăng xuất thành `DropdownMenuItem`
- `src/features/notifications/components/notification-bell.tsx` — badge dùng `--brand-red`
- `src/components/shared/page-header.tsx` — mô tả dùng `--text-secondary`

**UI/UX changes:**

- Sửa 2 lỗi contrast thật: `--info` 4.10:1 → **5.93:1**; thêm `--border-strong` **3.39:1** cho viền control (WCAG 1.4.11).
- Nav item và nút Đăng xuất nay có focus bàn phím nhìn thấy được.
- Badge thông báo dùng đúng token ngữ nghĩa và nằm gọn trong viền nút.
- Bổ sung cấp chữ trung gian để module sau phân cấp bằng màu thay vì thu nhỏ chữ.

**Problems resolved:** `UX-M00-001`, `-002`, `-009`, `-010`, `-011`, `-012`, và một phần `-004`. `UX-M00-008` đóng dạng `WONTFIX` có lý do.

**Behavior preserved:**

- Route: unchanged
- Permission: unchanged (`NAVIGATION` không đụng — `DS-012`)
- API contract: unchanged
- Validation: unchanged
- Business logic: unchanged
- Database/migration: unchanged
- Nhãn/nội dung: unchanged
- Khối `.dark`: **không đụng** (`DS-009`)
- `button.tsx`: **không đụng** (`DS-010`)

**Responsive:**

- Mobile 360–430px: drawer đúng, badge gọn trong nút, không scroll ngang cấp trang.
- Tablet 768–1024px: sidebar hiện đúng từ `md`, bố cục không đổi.
- Desktop 1280px+: bố cục không đổi; chỉ thêm focus ring và đổi màu nền/chữ mô tả.

**Verification:**

- Lint: ✅ Pass
- Type-check: ✅ Pass
- Test: ✅ **162/162** (lần chạy song song đầu có 2 timeout ở `wrong-answer-review` + `student-review-page` — flaky đã biết; chạy `--maxWorkers=4` và chạy riêng đều xanh; **không sửa/nới test nào**)
- Build: ✅ Pass — `✓ Compiled successfully in 15.9s`, exit 0

> Người sửa là Claude → **chưa Verified**. Cần Codex/user xác minh độc lập bằng mắt và bàn phím.

---

### 2026-07-21 — Phase 0 — Khởi tạo (không có thay đổi UI)

**Screen/Component:** Không có. Phase 0 cấm sửa UI.

**Files changed:** chỉ tài liệu quản lý, không có file code.

- `UIUX_Redesign_Management_Pack/uiux-redesign/**` → `uiux-redesign/**` (13 file, `git mv`, giữ lịch sử)
- `uiux-redesign/02_UIUX_DESIGN_SYSTEM.md` — điền đầy đủ từ source
- `uiux-redesign/03_UIUX_MODULE_INVENTORY.md` — 29 module + 8 shared component
- `uiux-redesign/04_UIUX_MODULE_BOARD.md` — thứ tự thi công đã chốt
- `uiux-redesign/05_UIUX_SESSION_CHECKPOINT.md` — điểm tiếp tục
- `uiux-redesign/07_UIUX_ISSUES_LOG.md` — 9 issue có bằng chứng
- `uiux-redesign/08_UIUX_DECISIONS.md` — 12 quyết định `DS-001`…`DS-012`

**UI/UX changes:** **Không có.** Không một file nào trong `src/` bị sửa.

**Problems resolved:** Chưa cái nào. 9 issue mới chỉ ở trạng thái `OPEN`/`FROZEN`.

**Behavior preserved:**

- Route: unchanged
- Permission: unchanged
- API contract: unchanged
- Validation: unchanged
- Business logic: unchanged
- Database/migration: unchanged

**Responsive:** N/A — chưa sửa giao diện.

**Verification:**

- Lint: NOT_RUN — không có thay đổi code để lint
- Type-check: NOT_RUN — như trên
- Test: NOT_RUN — như trên
- Build: NOT_RUN — như trên

> Ghi rõ: đây là "chưa chạy vì chưa có thay đổi code", **không phải** "pass".

---

## 2026-07-23 (đợt 8) — `P18-T1` / M28 Xác thực & trang gốc

**Mở phạm vi mới:** user chốt đảo nốt phần "tạm dừng Auth và Admin" của `D-27` → `DS-043`. Thêm **Phase 18** (`P18-T1`…`P18-T14`) vào phase plan.

**M28 — 7 lỗi thật, tất cả có số đo baseline:**
1. 🔴 Không màn nào có `<main>` (`main: 0` ở cả 4 màn).
2. 🔴 Cả 4 màn dùng chung một `<h1>` "POLYMIND CHINESE" → điều hướng bằng heading không phân biệt được trang.
3. 🔴 Tiêu điểm biến mất sau khi submit lỗi: `INPUT#password` → `BODY`, phải bấm **5 lần Tab** mới quay lại.
4. 🟡 Form xoá sạch tên đăng nhập sau mỗi lần sai (React 19 tự `form.reset()`) — **`git stash` xác nhận lỗi có sẵn**.
5. 🟡 Link "Quên mật khẩu?" cao 20px trên chuột (cần 24px).
6. 🟡 "Ít nhất 8 ký tự." 12px và không ô nào `aria-describedby` trỏ tới.
7. 🟡 Thiếu `aria-invalid` và `autoCapitalize="none"`.

**Suýt báo động giả lần thứ ba:** tương phản `text-white/70` tính từ hai đầu gradient ra **4.05:1** (hụt AA). Đo **điểm ảnh thật sau chữ** thì nền là `rgb(18,75,138)` chứ không phải `#1a5fa8` → **5.18:1, đạt**. Không sửa gì.

**Hai lỗi do chính đợt này gây ra, test bắt trước khi giao:** nhãn nút hiện/ẩn trùng nhau trên màn có 2 ô mật khẩu; và `min-h-6` làm hụt touch target trên cảm ứng vì `@layer utilities` thắng `@layer base`.

**Đóng kèm:** `UX-UIUX-M19-008` (`maxWorkers: 4` → Vitest 220/220 ở cả 3 lượt) và `UX-UIUX-M00-020` (`assessment-engine.smoke` 2/2 — mọi assertion nay mới thật sự chạy).

**Quyết định mới:** `DS-041` (locator test dùng `exact`), `DS-042` (`<h1>` auth là tên màn), `DS-043` (mở M28 + Admin).

**Kiểm tra:** Lint ✅ · Typecheck ✅ · Vitest **220/220** ✅ · Build ✅ · E2E M28 **32/32** ✅ · spec liên quan chạy lại **74/74** ✅

---

<!-- Entry mới thêm lên trên dòng này, mới nhất ở trên cùng. -->
