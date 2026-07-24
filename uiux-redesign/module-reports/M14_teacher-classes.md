# [M14] Lớp của tôi (Teacher) — UI/UX Audit & Improvement

> **Trạng thái: `IMPLEMENTED — chờ đo responsive + tốc độ đổi tab`** (2026-07-21, đợt 6). §1–§6 xong cho cả ba màn; §7 có đủ 5 subtask; §8 nêu rõ **hai thứ chưa đo được** nên module chưa đạt `DONE`.

## 1. Scope

| Field | Value |
|---|---|
| Module ID | M14 |
| Module name | Lớp của tôi — giáo viên xem lớp được phân công và mọi thứ thuộc về lớp đó |
| Routes | `/teacher/classes` · `/teacher/classes/[id]` · `/teacher/sessions/[id]` |
| Roles/permissions | `requireRole("teacher")` — **chỉ `teacher`**, khác M15 (`teacher`, `super_admin`). Phạm vi lớp do **RLS** trên `classes` quy về `class_teachers`; UUID ngoài phạm vi → `getClassById` trả `null` → `notFound()` (`[id]/page.tsx:63-66`). Không đụng tới |
| Screens | **3**: (A) lưới thẻ lớp · (B) chi tiết lớp **8 tab** · (C) nhật ký buổi |
| Source in scope | `teacher/classes/page.tsx` (101 dòng) · `teacher/classes/[id]/page.tsx` (**663 dòng**) · `teacher/sessions/[id]/page.tsx` (199 dòng) · **`features/sessions/components/session-log-form.tsx` (195 dòng)** — xem ghi chú phạm vi bên dưới |
| Shared component đụng tới | Dự kiến **không** sửa `src/components/`. `CardTitle` đã có sẵn prop `asChild` từ `M13-S01` (`ui/card.tsx:41-55`) nên `UX-M14-008` **không cần** chạm shared component |
| Out of scope | `features/classes/server/**`, `features/courses/**`, `features/schedules/**`, `features/sessions/server/**`, `MaterialsManager`, `SessionCalendar`, RLS, business logic, database, API, route, permission, validation |

**Ghi chú phạm vi — `session-log-form.tsx`:** đây là **giao diện duy nhất có thao tác ghi của cả module** và nó nằm ngay trong màn C, nên bỏ ra ngoài thì màn C chỉ còn phần chỉ-đọc. File nằm ở `features/sessions/components/`, **không phải** `features/*/server` — không thuộc danh sách cấm ở handoff. Đưa vào phạm vi ở mức **chỉ sửa trình bày** (`h-*`, `text-xs`, thuộc tính ARIA của lỗi); **không** đụng `saveSessionLogAction`, `useFormAction`, `name=`, `value=`, `maxLength`, nhãn hay hộp xác nhận.

**Bối cảnh sử dụng:** khác hẳn M15. Đây là màn **tra cứu**, mở trên desktop giữa giờ nghỉ hoặc lúc soạn bài, không phải màn thao tác gấp giữa lớp. Ưu tiên là **đọc đúng và tìm nhanh trong 8 tab**, không phải chống bấm nhầm.

**Điểm cần chú ý về quy mô:** `[id]/page.tsx` **663 dòng** — lớn nhất trong 3 module đã làm. Đúng mẫu `CandidateDetail.razor` mà `CLAUDE.md` cảnh báo, nhưng khác một điểm quan trọng: nó **không tự viết query**, chỉ gọi `features/*/server`. Tách file là refactor → **ngoài phạm vi UI/UX**, chỉ ghi nhận.

## 2. Existing Technology

Chép từ `02_UIUX_DESIGN_SYSTEM.md` §1 — **không khảo sát lại**.

| Item | Current usage | Source evidence |
|---|---|---|
| Framework | Next.js 16.2.10 App Router. Cả 3 màn là **server component** `async` | `page.tsx:21`, `[id]/page.tsx:55` |
| UI library | shadcn/ui `new-york` — `Card`, `Button`, **`Tabs`** (lần đầu trong đợt redesign), `StatusBadge`, `EmptyState` | `[id]/page.tsx:18-23` |
| Icons | lucide-react — 13 icon | `[id]/page.tsx:5-16` |
| Tokens/theme | Sau `M00-S01/S06/S08/S09` — chỉ Light | `globals.css` |
| Nhãn nghiệp vụ | `lib/domain/labels.ts` có sẵn `CLASS_STATUS_LABELS`, `DELIVERY_MODE_LABELS`, `ENROLLMENT_STATUS_LABELS`, **`ASSESSMENT_TYPE_LABELS`** | `labels.ts:36,44,58,89` |

## 3. Existing UI Audit

### Layout

**Màn A** (`page.tsx:43-97`): `PageHeader` + `grid gap-4 lg:grid-cols-2`, mỗi lớp là một `<Link>` bọc `Card`. Chỉ 1 và 2 cột — ở 1280px+ mỗi thẻ rộng ~600px cho 6 dòng thông tin, khá thoáng nhưng không sai.

**Màn B** (`[id]/page.tsx:100-621`): link quay lại → `PageHeader` → hàng badge trạng thái → **`Tabs` 8 tab** → 8 `TabsContent`. Tab `overview` dùng `grid xl:grid-cols-2`; các tab còn lại là `Card` + `<ul className="divide-y">`.

**Màn C** (`sessions/[id]/page.tsx:52-160`): link quay lại → `PageHeader` (có nút "Điểm danh") → **3 `SummaryCard`** (`grid sm:grid-cols-3`) → hàng badge trạng thái + chủ đề → **một trong ba nhánh theo `session.status`**:

| `session.status` | Hiển thị | Dòng |
|---|---|---|
| `scheduled` | `Card` bọc `SessionLogForm` — form duy nhất của cả module M14 | `:105-121` |
| `completed` | `Alert` "đã hoàn tất, nhật ký bị khóa" + `Card` chỉ-đọc 2 trường | `:122-148` |
| `cancelled` / `rescheduled` | `Alert` "không thể ghi nhật ký" | `:149-157` |

Ba nhánh này là **thiết kế đúng**: trạng thái quyết định cả nội dung lẫn khả năng thao tác, không phải khóa control rồi để nguyên form. Giữ nguyên cấu trúc, chỉ sửa trình bày.

### Navigation

- Màn A → B bằng route con `[id]` ✅.
- Màn B có link quay lại "Lớp của tôi" (`:102-108`).
- **8 tab không lưu vào URL.** `Tabs defaultValue="overview"` (`:127`) là state trong React. Chuyển sang tab "Tiến độ", bấm vào một link rồi Back → quay về "Tổng quan". Không share được link tới đúng tab, không bookmark được, refresh mất chỗ đang đứng.
- Tab "Bài tập"/"Kiểm tra" có nút thoát ra module khác (`/teacher/exercises`, `/teacher/exams`) — **không mang theo `classId`**, nên sang tới nơi là danh sách toàn bộ, phải lọc lại lớp bằng tay.
- **Màn C ngược lại, làm rất đúng:** link quay lại mang theo `session.class.id` chứ không dùng `history.back()` (`sessions/[id]:55`), và nút "Điểm danh" mang theo `?session=<id>` sang M15 (`:67`) — đúng thứ `UX-M14-011` đang thiếu ở màn B. **Mẫu để đối chiếu khi user quyết `UX-M14-011`: cùng repo, cùng module, một nơi mang ngữ cảnh đi, một nơi không.**
- Màn C **không có** vấn đề tab/URL của `UX-M14-003` — mọi trạng thái của trang đều suy ra từ `params.id` và `session.status` trên server.

### Table

Không có `<Table>` ở đâu. Mọi danh sách là `<ul>/<li>` — nhất quán với M15, giữ nguyên.

### Form

Không có form ở màn A/B. `MaterialsManager` (tab Tài liệu) là client component thuộc `features/courses` — **ngoài phạm vi**.

**Màn C có form duy nhất của module** — `SessionLogForm` (`session-log-form.tsx`). Đối chiếu checklist form:

| Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|
| Nhãn nhìn thấy được, không phải placeholder | ✅ đủ 3 trường, có `htmlFor`/`id` khớp | `:71,85` · `:110,112` · `:124,126` |
| Đánh dấu trường bắt buộc | ✅ `*` trong nhãn | `:71`, `:110` |
| `maxLength` khớp server | ✅ 5000 / 2000 | `:116`, `:129` |
| Nút khoá khi đang gửi | ✅ `useFormStatus` + `disabled={pending}` + `Loader2` | `:142,152,166` |
| Phân cấp hành động | ✅ "Lưu nhật ký" `outline`, "Hoàn tất buổi" `default` — đúng một CTA chính | `:151`, `:162` |
| Xác nhận trước hành động không hoàn tác được | ✅ dùng lại `useConfirmation()`, đúng `DS-020` | `:168-178` |
| Trạng thái rỗng của dữ liệu nguồn | ✅ khóa học chưa có bài học → `Alert` giải thích + `disabled` nút | `:72-79`, `:136` |
| **Lỗi từng trường được trình đọc màn hình đọc lên** | ❌ **không** — `FieldError` là `<p>` trần, không `role="alert"`, không `aria-live`, input không `aria-invalid`/`aria-describedby` | `:191-193`, `:102`, `:120`, `:133` |
| **Chiều cao nút theo thang `DS-013`** | ❌ **không** — `className="h-11"` chép cứng ở cả hai nút | `:153`, `:167` |

Bảy trên chín tiêu chí đã đạt — form này **được viết cẩn thận hơn hẳn `attendance-roster.tsx` của M15**. Hai chỗ hỏng đều là mẫu lỗi đã gặp: `h-11` chép cứng lặp lại `UX-M15-004`, lỗi không được announce là mẫu mới chưa gặp ở M13/M15 vì hai module đó không có `fieldErrors`.

### States

| State | Hiện trạng |
|---|---|
| **Loading** | Cấp shell (`(dashboard)/loading.tsx`). Đủ |
| **Empty** | ✅ **7 empty state** — màn A, lịch lặp, buổi học, học viên, điểm danh, bài tập, kiểm tra, tiến độ. Đây là module xử lý empty tốt nhất từ đầu đợt |
| **Error** | `(dashboard)/error.tsx` sau `M00-S10` ✅. Lớp ngoài phạm vi → `notFound()` ✅ |
| **Disabled** | Màn A/B N/A. **Màn C có**: hai nút submit `disabled` khi `pending` hoặc khi khóa học chưa có bài học (`session-log-form.tsx:152,166,136`) — dùng thuộc tính `disabled` thật, không phải class giả ✅ |
| **Success** | Màn A/B N/A (chỉ đọc). **Màn C**: lưu xong → `router.refresh()` (`session-log-form.tsx:45`), trang vẽ lại và trạng thái buổi đổi → phản hồi thành công **là chính nội dung trang đổi**, không cần toast riêng ✅ |

### Accessibility

- **Heading:** `<h1>` từ `PageHeader`; thẻ lớp màn A dùng `<h2>` (`page.tsx:64`) ✅. Nhưng `CardTitle` trong màn B render `<div>`, nên **8 khối nội dung không có heading thật** — trình đọc màn hình không nhảy được giữa các khối.
- **Progress bar:** có `role="progressbar"` + `aria-label` theo tên học viên + `aria-valuemin/max/now` (`:567-574`) ✅ — làm rất đúng.
- **Focus:** `Link` bọc `Card` màn A (`page.tsx:50`) **không có focus style**; link quay lại (`[id]:102`) cũng không. Đây là **lần thứ tư** đúng mẫu này (M00 nav item, M13 hàng lớp, M15 hàng buổi).
- **Màu không phải tín hiệu duy nhất:** `StatusBadge` có chữ ✅.
- **Link ra ngoài:** `target="_blank"` + `rel="noreferrer"` cho phòng học trực tuyến (`:193-200`) nhưng **không báo trước là mở tab mới**.

Bổ sung màn C:

- **Enum thô: không có.** `SESSION_STATUS_LABELS` + `SESSION_STATUS_TONE` được dùng đúng (`sessions/[id]:95-96`) — **màn C sạch mẫu lỗi đang chặn `UX-M14-001`**.
- **Icon trang trí:** cả 6 icon đều `aria-hidden` (`:58,68,125,151,175`) ✅.
- **Heading:** thêm 2 `CardTitle` là `<div>` (`:108`, `:133`) → tổng toàn module thành **10 khối** không có heading thật.
- **Focus:** link "Về lớp …" (`:54-57`) **không có focus style** — lần thứ **năm** đúng mẫu này trong 4 module.
- **Lỗi form không được announce:** `FieldError` (`session-log-form.tsx:191-193`) chỉ đổi màu chữ. Người dùng trình đọc màn hình bấm "Hoàn tất buổi", server trả `fieldErrors`, trang **không thông báo gì** — họ chỉ biết là không có gì xảy ra. `state.error` cấp form thì đỡ hơn (nằm trong `Alert` của shadcn, có `role="alert"` sẵn) nhưng lỗi từng trường thì không.

### Responsive

- Màn A: `grid gap-4 lg:grid-cols-2` — 1 cột dưới 1024px ✅.
- Màn B: `TabsList` bọc `overflow-x-auto pb-1` + `min-w-max` (`:128-129`) — 8 tab cuộn ngang **trong vùng riêng**, đúng governance §4. Nhưng ở 360px chỉ thấy ~2,5 tab, và **không có dấu hiệu nào cho biết còn tab bên phải** (không gradient mép, không mũi tên).
- Tab Tiến độ: `grid text-xs sm:grid-cols-4` (`:580`) — 4 chỉ số **xếp dọc thành 4 dòng 12px** ở mobile.
- Màn C: `grid gap-4 sm:grid-cols-3` (`sessions/[id]:75`) — 1 cột dưới 640px ✅. **Nhưng đúng ở 640–768px là chỗ vỡ:** 3 thẻ chia đôi một hàng hẹp, mỗi thẻ còn ~200px mà đã mất 40px cho icon + 12px gap, chuỗi giờ `21/07/2026 18:00–19:30` không đủ chỗ → `truncate` (`:179`) cắt mất **giờ kết thúc**, và không có `title` để xem lại. Cắt đúng phần thông tin quan trọng nhất của thẻ.
- Màn C: form dùng `Textarea rows={7}` (`session-log-form.tsx:114`) — cao ~180px, không `resize-none`, không tràn ngang ✅.
- Chưa đo thực tế ở 3 tầng — sẽ làm khi triển khai.

## 4. Problems with Evidence

| Issue ID | Screen | Problem | Evidence | Severity | Proposed fix |
|---|---|---|---|---|---|
| `UX-M14-001` | B — tab Bài tập & Kiểm tra | **Enum thô lọt ra giao diện.** `StatusBadge label={assignment.status}` in thẳng giá trị enum của DB (`draft` / `assigned` / `results_published`); `{assessment.exam_type}` in thẳng `quiz`/`midterm`/`mock_hsk` — **trong khi `ASSESSMENT_TYPE_LABELS` đã có sẵn tiếng Việt và file này đã import 5 map nhãn khác** | `[id]/page.tsx:452` — `label={assignment.status}`; `:491` — `{assessment.exam_type}`; đối chiếu `labels.ts:89-97` | **High** | Dùng `ASSESSMENT_TYPE_LABELS[assessment.exam_type]`. Với `assignment.status` thì **chưa có map** → cần thêm map mới = thêm nhãn. **Cần user quyết** |
| ~~`UX-M14-002`~~ | B — Đội ngũ giảng dạy | ⛔ **RÚT LẠI — BÁO ĐỘNG GIẢ. Code hiện tại đúng, không có bug.** Xem "Đính chính" ngay dưới bảng | — | ~~High~~ → **INVALID** | **Không sửa gì.** User đã duyệt cho sửa dựa trên bằng chứng sai; bằng chứng đó đã bị bác bỏ trước khi viết dòng code nào |
| `UX-M14-003` | B — 8 tab | **Tab không nằm trong URL.** `Tabs defaultValue="overview"` là state React: chuyển sang "Tiến độ", bấm một link rồi Back → về "Tổng quan"; không share/bookmark được tab; refresh mất chỗ | `[id]/page.tsx:127` | **High** | Chuyển sang tab đồng bộ query param (`?tab=`). Đây là **đổi hành vi navigation** — `DS-012` cấm tự đổi. **Cần user quyết** |
| `UX-M14-004` | A — thẻ lớp | **Link bọc `Card` không có focus nhìn thấy được**; hover dùng alpha ngẫu hứng `hover:border-primary/40 hover:bg-muted/20` thay vì token. **Lần thứ tư** đúng mẫu này (M00 → M13 → M15 → M14) | `page.tsx:50-51` | **High** | `<Link className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">`; hover → `hover:border-primary-300 hover:bg-primary-50` |
| `UX-M14-005` | A + B | **11 chỗ `text-xs` cho nội dung thật** ở màn B, 1 ở màn A: mã lớp, mã giáo viên, mã học viên, ngày ghi danh, tiến độ %, hạn nộp, số bài nộp, nhãn của `Field`, khoảng hiệu lực lịch, 4 chỉ số tiến độ | `grep -c text-xs`: `[id]/page.tsx` = **11**, `page.tsx` = **1**. Ví dụ `:225`, `:333`, `:338`, `:389`, `:446`, `:490`, `:580`, `:634` | **Medium** | `text-sm` + `text-text-secondary` (7.81:1). Thuộc `UX-M00-004` |
| `UX-M14-006` | B — 8 tab | **Không có dấu hiệu còn tab bên phải.** Ở 360px chỉ thấy ~2,5/8 tab; vùng cuộn không gradient mép, không mũi tên → 5 tab cuối gần như vô hình trên điện thoại | `[id]/page.tsx:128-138` | **Medium** | Thêm gradient mờ ở mép phải khi còn nội dung cuộn (thuần CSS, không thêm JS) |
| `UX-M14-007` | B — tab Tiến độ | **4 chỉ số ở `text-xs` xếp thành 4 dòng ở mobile.** Chuyên cần / bài học / bài tập / điểm TB là dữ liệu đọc-để-ra-quyết-định, lại nhỏ nhất màn hình | `[id]/page.tsx:580` — `grid gap-1 text-xs sm:grid-cols-4` | **Medium** | `text-sm`, và `grid-cols-2 sm:grid-cols-4` để mobile thành 2×2 thay vì 4×1 |
| `UX-M14-008` | B + C — CardTitle | **10 khối nội dung không có heading thật.** `CardTitle` mặc định render `<div data-slot="card-title">` nên trình đọc màn hình không có mốc nào để nhảy giữa các khối trong một trang 663 dòng | `[id]/page.tsx:145,175,208,244,287,308,357,525` + `sessions/[id]/page.tsx:108,133`; `ui/card.tsx:41-55` | **Medium** | ✅ **Đã gỡ chặn — không cần đụng shared component.** `CardTitle` đã có sẵn prop tuỳ chọn `asChild` từ `M13-S01` (`card.tsx:43-46`). Chỉ cần truyền `asChild` + `<h2>` tại 10 chỗ dùng. Câu hỏi Q5 trong checkpoint **đóng lại**, không cần user quyết |
| `UX-M14-009` | B — link phòng học trực tuyến | Mở tab mới bằng `target="_blank"` mà **không báo trước** — người dùng bàn phím và trình đọc màn hình bị đổi ngữ cảnh không báo | `[id]/page.tsx:193-200` | **Low** | Thêm icon `ExternalLink` + `aria-label` nêu rõ "mở tab mới". `rel="noreferrer"` đã đúng |
| `UX-M14-010` | B — link quay lại | Link "Lớp của tôi" không có focus style — **giống hệt `UX-M15-011`** đã sửa ở M15 | `[id]/page.tsx:102-108` | **Low** | `rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` |
| `UX-M14-011` | B — tab Bài tập/Kiểm tra | Nút "Quản lý bài tập"/"Quản lý bài kiểm tra" nhảy sang module khác **không mang theo lớp đang xem** → sang tới nơi phải lọc lại bằng tay | `[id]/page.tsx:422`, `:466` | **Low** | Thêm `?class=<id>` là **đổi hành vi navigation** (`DS-012`). **Chỉ ghi nhận** |
| `UX-M14-012` | B — toàn trang | **663 dòng trong một page** — đúng mẫu `CandidateDetail.razor` mà `CLAUDE.md` cảnh báo. Khác biệt quan trọng: file này **không tự viết query**, chỉ gọi `features/*/server`, nên rủi ro thấp hơn nhiều | `[id]/page.tsx` (663 dòng) | **Low** | **Chỉ ghi nhận** — tách file là refactor, ngoài phạm vi UI/UX |
| `UX-M14-013` | C — form nhật ký | **Lỗi từng trường không được trình đọc màn hình đọc lên.** `FieldError` chỉ là `<p className="text-destructive text-xs">`: không `role="alert"`, không `aria-live`; `Textarea`/`SelectTrigger` không `aria-invalid`, không `aria-describedby` trỏ tới lỗi. Người dùng bàn phím bấm "Hoàn tất buổi", server trả `fieldErrors` → **họ chỉ thấy như không có gì xảy ra**. Không có `focus-management`: focus không nhảy về trường sai | `session-log-form.tsx:191-193` (`FieldError`) · `:102,120,133` (3 chỗ gọi) · `:85,112,126` (3 control, không control nào có `aria-invalid`) | **High** | `FieldError` → `role="alert"` + `id={\`${field}-error\`}`; control thêm `aria-invalid={!!message}` + `aria-describedby`. Thuần thuộc tính ARIA, **không đổi** schema, thông báo hay luồng submit |
| `UX-M14-014` | C — form nhật ký | **`h-11` chép cứng ở cả hai nút submit** — đúng thứ `DS-013` vừa gỡ khỏi toàn repo, lặp lại nguyên si `UX-M15-004`. Nút không hưởng thang mật độ mới trên chuột và không đổi theo nếu thang đổi | `session-log-form.tsx:153`, `:167` | **High** | Bỏ `className="h-11"`. Cảm ứng vẫn đủ 44px do `globals.css` ép trong `@media (pointer: coarse)`. Nếu muốn 44px cả trên chuột thì dùng `size="lg"` — **đúng bài học M15 đã ghi ở checkpoint** |
| `UX-M14-015` | C | **4 chỗ `text-xs` cho nội dung thật:** nhãn của 3 thẻ tóm tắt, nhãn 2 trường chỉ-đọc, chú thích "bài học này được đánh dấu hoàn thành…" (câu giải thích **hệ quả nghiệp vụ** của nút, không phải meta), và **thông báo lỗi** | `sessions/[id]/page.tsx:178,195` · `session-log-form.tsx:103,193` | **Medium** | `text-sm` + `text-text-secondary` (7.81:1). Riêng `FieldError` giữ `text-destructive` nhưng lên `text-sm` — thông báo lỗi không được là chữ nhỏ nhất màn hình. Thuộc `UX-M00-004` |
| `UX-M14-016` | C — 3 thẻ tóm tắt | **`truncate` cắt mất giờ kết thúc ở 640–768px** và không có cách nào xem đầy đủ. `sm:grid-cols-3` bật ngay tại 640px: mỗi thẻ ~200px, trừ icon 40px + gap 12px còn ~148px cho chuỗi `21/07/2026 18:00–19:30`. Cùng mẫu `UX-M13-008` (chữ bị cắt không xem lại được) nhưng ở đây cắt đúng dữ liệu chính của thẻ | `sessions/[id]/page.tsx:79` (giá trị) · `:179` (`truncate text-sm font-medium`) | **Medium** | Bỏ `truncate`, cho xuống dòng (`grid` kéo các thẻ cùng hàng bằng nhau nên không vỡ layout); thêm `title={value}`. Đúng `truncation-strategy`: ưu tiên xuống dòng hơn cắt |
| `UX-M14-017` | C — link quay lại | Link "Về lớp …" không có focus style — **lần thứ năm** đúng mẫu này (M00 nav item → M13 hàng lớp → M15 hàng buổi → M14 thẻ lớp + link màn B → nay màn C) | `sessions/[id]/page.tsx:54-57` | **Low** | `rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` — y hệt `UX-M14-010` |
| `UX-M14-018` | C — thẻ tóm tắt | Ô icon dùng `bg-primary/10 text-primary` — alpha ngẫu hứng thay vì token, cùng loại `UX-M13-004` và `UX-M14-004`. `primary/10` cũng **không bằng** `primary-50` trong thang màu đã dựng ở `02` §3.2 | `sessions/[id]/page.tsx:174` | **Low** | `bg-primary-50 text-primary-700` |
| `UX-M14-019` | C — form nhật ký | Form tự dựng lại `useFormStatus` + `Loader2` + `disabled` thay vì dùng `SubmitButton` dùng chung ở `components/shared/submit-button.tsx` | `session-log-form.tsx:141-161` vs `components/shared/submit-button.tsx` | **Low** | **Chỉ ghi nhận.** Hai nút ở đây mang `name="intent"` với `value` khác nhau và nút thứ hai chặn submit để hỏi xác nhận — gộp vào component chung là đổi hành vi submit, rủi ro cao hơn lợi ích. Hành vi hiển thị hiện tại **đã đúng** |

### Đính chính `UX-M14-002` (2026-07-21, đợt 5)

**Kết luận: code đúng, audit sai. Không sửa gì.**

Audit đợt 4 kết luận "thẻ Đội ngũ giảng dạy không bao giờ hiện quá một người và gán sai vai trò" dựa trên migration `20260713000003_classes_schedules.sql:56-71`. **Migration đó đã bị một migration sau ghi đè.**

`supabase/migrations/20260716000037_remove_assistant_teacher_role.sql` — tiêu đề dòng 1: *"Mỗi lớp đúng tối đa một giáo viên phụ trách; bỏ hoàn toàn trợ giảng"*:

| Dòng | Lệnh | Hệ quả |
|---|---|---|
| `:46` | `delete from public.class_teachers where assignment_role = 'assistant'` | Xoá sạch trợ giảng (có snapshot vào `audit_logs` trước, `:31-44`) |
| `:52-54` | `drop constraint uq_class_teachers` → `add constraint uq_class_teachers_one_teacher unique (class_id)` | **Một lớp = đúng một dòng `class_teachers`**, ràng buộc ở DB |
| `:55` | `alter table public.class_teachers drop column assignment_role` | Cột **không còn tồn tại** |
| `:56` | `drop type public.assignment_role` | Kiểu enum cũng bị xoá khỏi DB |

Ba bằng chứng độc lập xác nhận:

1. `src/types/database.ts:402-423` — `class_teachers.Row` **không có** `assignment_role`. Nếu cột còn thì typegen phải sinh ra.
2. `src/types/database.ts:426-431` — FK `class_teachers_class_id_fkey` là `isOneToOne: true`, nên `supabase-js` trả `class_teachers` là **object**, không phải mảng. Vì vậy `[classRecord.class_teachers].map(...)` (`[id]/page.tsx:215`) **là cách đúng** để duyệt một quan hệ to-one, không phải lỗi bọc mảng.
3. `docs/09-ke-hoach-trien-khai-module-bai-tap-kiem-tra-thi.md:94` — *"Hệ thống chỉ có một giáo viên phụ trách mỗi lớp theo **D-22**"*. Đây là quyết định sản phẩm, không phải thiếu sót.

Suy ra badge chép cứng `label="Giáo viên phụ trách"` (`:232`) **cũng đúng**: chỉ còn đúng một vai trò, không có gì để phân biệt. Thêm `assignment_role` vào câu select như đề xuất cũ sẽ làm **hỏng query** — select một cột không tồn tại.

**Bài học — ghi vào `Current Findings` của checkpoint:** audit đợt 4 đọc migration theo tên bảng rồi dừng ở file khớp đầu tiên. Cùng loại sai lầm với `UX-M00-002` (đánh `FIXED` cho token chưa ai dùng): **kết luận từ một dòng source mà chưa kiểm dòng đó còn hiệu lực không.** Với schema, luật mới là **`grep` toàn bộ migration theo tên bảng và đọc từ file mới nhất về cũ**, vì migration sau ghi đè migration trước.

**Đây là lý do một issue `Business` phải mặc định "chỉ ghi nhận".** Nếu module này giữ đúng governance §1 thì bằng chứng sai đã bị Codex bác khi verify. Lần này user duyệt cho sửa ngay, và thứ chặn được nó là bước đọc lại schema **trước** khi viết code — không phải quy trình.

## 5. Proposal Before Code

**Nguyên tắc chung cho M14:** đây là màn **tra cứu** trên desktop, không phải màn thao tác gấp. Ưu tiên theo thứ tự: (1) đọc đúng — hết enum thô, hết chữ 12px cho dữ liệu thật; (2) tìm nhanh trong 8 tab — tab vào URL, có dấu hiệu còn tab bên phải; (3) bàn phím và trình đọc màn hình đi được — focus ring, heading thật, lỗi form được announce. **Không** đổi bố cục lớn, **không** tách file 663 dòng, **không** đổi một chữ nhãn nào ngoài phần user đã duyệt ở `DS-023`.

### 5.1 Bốn quyết định user chốt trong đợt 5

| Mã | Nội dung | Gỡ chặn |
|---|---|---|
| `DS-023` | Thêm `EXERCISE_DELIVERY_STATUS_LABELS` đủ 8 giá trị vào `lib/domain/labels.ts` | `UX-M14-001` (nửa sau) |
| `DS-024` | Đồng bộ tab màn B vào `?tab=` — ngoại lệ có chủ đích của `DS-012`, chỉ cho M14 | `UX-M14-003` |
| `DS-025` | `session-log-form.tsx` vào phạm vi M14 ở **mức trình bày** | `UX-M14-013`, `-014`, `-015` |
| ~~`DS-026`~~ | ~~Claude sửa `UX-M14-002`~~ — **không tạo**, issue là báo động giả | — |

### 5.2 Tám nhãn đề xuất cho `DS-023` — chờ user duyệt từng chữ

`Record<Enums["exercise_delivery_status"], string>` bắt buộc phủ đủ 8 giá trị (`database.ts:3858-3866`), thiếu một cái là TypeScript báo lỗi:

| Enum | Nhãn đề xuất | Lý do chọn chữ này |
|---|---|---|
| `draft` | **Nháp** | Khớp `COURSE_STATUS_LABELS.draft` và `INVOICE_STATUS_LABELS.draft` đã có trong cùng file |
| `scheduled` | **Đã lên lịch** | Khớp `SESSION_STATUS_LABELS.scheduled` |
| `open` | **Đang mở** | Khớp `COURSE_STATUS_LABELS.active`; "Đang mở" nói đúng việc học viên nộp được |
| `closed` | **Đã đóng** | Hết hạn nộp, chưa chấm |
| `grading` | **Đang chấm** | — |
| `results_published` | **Đã công bố kết quả** | Khớp chữ đã dùng ở `exercises/server/actions.ts:200` (`"Đã công bố … kết quả."`) |
| `cancelled` | **Đã hủy** | Khớp 3 map khác đã có |
| `archived` | **Lưu trữ** | Khớp `COURSE_STATUS_LABELS.archived` |

Sáu trên tám chữ **lấy nguyên từ nhãn đã tồn tại trong repo**, nên không sinh ra giọng điệu thứ hai. Hai chữ mới hoàn toàn là `closed` và `grading`.

Kèm theo `EXERCISE_DELIVERY_STATUS_TONE`: `results_published` → `success`; `open` → `info`; `grading`, `closed` → `warning`; `cancelled` → `danger`; `draft`, `scheduled`, `archived` → `neutral`. Giữ đúng luật màu-không-bao-giờ-là-tín-hiệu-duy-nhất — badge luôn kèm chữ.

> ⛔ **Không viết dòng code nào của `UX-M14-001` trước khi user duyệt bảng chữ này.** `DS-023` mới duyệt *việc thêm map*, chưa duyệt *nội dung chữ*.

### 5.3 Cách làm `DS-024` (tab vào URL) — và ranh giới không được vượt

`[id]/page.tsx` đang là server component `async`. Cách rẻ nhất và không thêm client component:

1. `page.tsx` nhận thêm `searchParams: Promise<{ tab?: string }>`.
2. Đối chiếu giá trị với **danh sách 8 tab đã có sẵn trong file**; không khớp → rơi về `"overview"`. Đây là fail-closed, đúng tinh thần `AGENTS.md`.
3. `<Tabs value={activeTab}>` thay `defaultValue`, mỗi `TabsTrigger` bọc `asChild` quanh `<Link href={?tab=...} scroll={false}>`.

**Ranh giới:** không đổi `NAVIGATION` (`DS-012` vẫn nguyên hiệu lực cho sidebar), không đổi route, không đổi `requireRole`, không thêm `"use client"`, **không** động tới `UX-M14-011` (mang `classId` sang module khác) — cái đó vẫn `OPEN — ghi nhận`, `DS-024` chỉ mở đúng phần tab của chính trang này.

**Rủi ro phải đo khi triển khai:** đổi tab thành 8 lần điều hướng server. `getClassById` là một query `select *` kèm 6 quan hệ lồng nhau, chạy lại mỗi lần đổi tab. Nếu đo thấy chậm rõ rệt thì **dừng, ghi vào báo cáo, hỏi lại user** — không tự chuyển sang client component để chữa cháy, vì đó là đổi kiến trúc trang.

### 5.4 Những thứ dứt khoát KHÔNG làm trong M14

| Không làm | Vì sao |
|---|---|
| Sửa `features/classes/server/queries.ts` | Handoff cấm; và sau đính chính `UX-M14-002` thì cũng **không còn lý do** nào để sửa |
| Tách `[id]/page.tsx` 663 dòng | `UX-M14-012` — refactor, ngoài phạm vi UI/UX |
| Gộp `SessionSubmitActions` vào `SubmitButton` chung | `UX-M14-019` — đổi hành vi submit, rủi ro > lợi ích |
| Thêm `?class=` cho nút sang M16/M17 | `UX-M14-011` — `DS-012`, user chưa duyệt |
| Sửa `src/components/ui/card.tsx` | Không cần: `asChild` đã có sẵn từ `M13-S01` |
| Đổi bất kỳ chữ nào ngoài 8 nhãn của `DS-023` | Governance §1 |

## 6. Screen Plan

Chia theo **màn hình**, không theo issue — đúng governance §5 Phase 1 bước 5. Mỗi subtask kết thúc bằng: cập nhật báo cáo + board + checkpoint + changelog, rồi mới sang subtask sau.

| Subtask | Phạm vi | Issue đóng | File đụng tới | Ghi chú |
|---|---|---|---|---|
| **`S01`** | Màn A — lưới thẻ lớp | `UX-M14-004`, phần màn A của `-005` | `teacher/classes/page.tsx` | Nhỏ nhất, 101 dòng. Làm trước để chốt lại mẫu focus ring + token hover cho 3 subtask sau |
| **`S02`** | Màn C — trang nhật ký buổi | `-008` (2/10 khối), `-015` (2/4 chỗ), `-016`, `-017`, `-018` | `teacher/sessions/[id]/page.tsx` | Không phụ thuộc `DS-023`/`DS-024` → chạy được ngay cả khi user chưa duyệt bảng nhãn |
| **`S03`** | Màn C — form nhật ký (`DS-025`) | `-013`, `-014`, `-015` (2/4 chỗ) | `features/sessions/components/session-log-form.tsx` | **Chỉ trình bày + ARIA.** Đây là subtask duy nhất chạm form → phải kiểm tay bằng bàn phím trước khi đóng |
| **`S04`** | Màn B — khung trang + 8 tab (`DS-024`) | `-003`, `-006`, `-008` (8/10 khối), `-010` | `teacher/classes/[id]/page.tsx` | Rủi ro cao nhất. Đo lại tốc độ đổi tab; chậm rõ rệt thì `BLOCKED` + hỏi user |
| **`S05`** | Màn B — nội dung trong tab | `-001` (cần `DS-023` duyệt chữ), `-005` (11 chỗ), `-007`, `-009` | `teacher/classes/[id]/page.tsx`, `lib/domain/labels.ts` | **Chặn bởi bảng nhãn §5.2.** Nếu user chưa duyệt kịp thì làm phần `exam_type` + `text-xs` + tiến độ trước, để lại đúng `assignment.status` |

**Thứ tự này cố ý đặt hai subtask không-bị-chặn (`S01`, `S02`) lên trước** để module vẫn tiến được trong lúc chờ user duyệt 8 nhãn. `S03` tách khỏi `S02` dù cùng màn C vì nó chạm file ở `features/` — tách ra thì diff dễ review và dễ hoàn tác riêng.

**Kiểm tra sau mỗi subtask:** `npm run lint && npm run typecheck`. Chạy `npm test -- --maxWorkers=4` sau `S03` (subtask duy nhất chạm hành vi form) và một lần nữa ở cuối. `npm run build` chỉ ở cuối module.

**Responsive phải đo ở cả 3 tầng** cho từng subtask: 360 / 768 / 1280. Riêng `S02` bắt buộc đo thêm **640px** — đó đúng là điểm `sm:grid-cols-3` bật và là chỗ `UX-M14-016` xảy ra.

## 7. Implementation Log

### `S01` — Màn A, lưới thẻ lớp ✅

**File:** `src/app/(dashboard)/teacher/classes/page.tsx` (101 → 105 dòng).

| Issue | Trước | Sau |
|---|---|---|
| `UX-M14-004` focus | `<Link>` không có class nào → bấm Tab tới thẻ lớp **không thấy gì đổi** | `className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"` — đúng thứ tự class đã dùng ở `teacher/attendance/page.tsx:119`, không phát minh mẫu thứ hai |
| `UX-M14-004` hover | `hover:border-primary/40 hover:bg-muted/20` — alpha ngẫu hứng | `hover:border-primary-300 hover:bg-primary-50` — token của thang màu `02` §3.2 |
| `UX-M14-005` (màn A) | `font-mono text-xs font-semibold` cho **mã lớp** | `text-sm` — mã lớp là dữ liệu để đối chiếu, không phải meta trang trí |

**Vì sao `block`:** `<Link>` mặc định là `inline`, ring của phần tử inline bị vỡ khi nội dung xuống dòng. `block` + `rounded-xl` (khớp `Card` ở `ui/card.tsx:11`) cho ring ôm sát viền thẻ.

**Không đụng:** đích link, `getClasses()`, `isOpenEnrollment`, thứ tự thẻ, cấu trúc `<h2>` đã đúng từ trước.

**Kiểm tra:** lint ✅ · typecheck ✅.

### `S02` — Màn C, trang nhật ký buổi ✅

**File:** `src/app/(dashboard)/teacher/sessions/[id]/page.tsx` (199 → 205 dòng).

| Issue | Trước | Sau |
|---|---|---|
| `UX-M14-017` focus | Link "Về lớp …" không có focus style — **lần thứ năm** đúng mẫu này | `rounded-md focus-visible:ring-2` — chép nguyên chuỗi class của `teacher/attendance/page.tsx:119` |
| `UX-M14-008` (2/10) | 2 `CardTitle` render `<div>` | `<CardTitle asChild><h2>…</h2></CardTitle>` — `asChild` có sẵn từ `M13-S01`, **không sửa `ui/card.tsx`** |
| `UX-M14-016` | `truncate` trên giá trị thẻ tóm tắt | Bỏ `truncate`, thêm `title={value}`. Chuỗi giờ xuống dòng thay vì bị cắt |
| `UX-M14-018` | `bg-primary/10 text-primary` | `bg-primary-50 text-primary-700` — token thật, `primary/10` không bằng `primary-50` |
| `UX-M14-015` (2/4) | `text-muted-foreground text-xs` ở nhãn `SummaryCard` và `ReadOnlyField` | `text-text-secondary text-sm` (7.81:1) |

**Vì sao bỏ `truncate` không vỡ layout:** 3 thẻ nằm trong `grid gap-4 sm:grid-cols-3`, mà grid item mặc định `align-items: stretch` → thẻ nào cao nhất kéo cả hàng bằng nhau. Chuỗi giờ xuống 2 dòng chỉ làm cả hàng cao thêm một dòng, không đẩy thẻ nào lệch. Đúng `truncation-strategy`: ưu tiên xuống dòng hơn cắt.

**`title={value}` là bổ sung, không phải thay thế** — đây là tooltip chuột, không đọc được bằng bàn phím. Nó chỉ có ý nghĩa vì nội dung đã hiện đủ; nếu vẫn cắt thì `title` một mình không đủ.

**Không đụng:** 3 nhánh theo `session.status`, `getSessionLog`, `getCourseCurriculum`, `?session=` của nút Điểm danh, `SESSION_STATUS_LABELS`.

**Kiểm tra:** lint ✅ · typecheck ✅.

### `S03` — Màn C, form nhật ký (`DS-025`) ✅

**File:** `src/features/sessions/components/session-log-form.tsx` (195 → 219 dòng).

| Issue | Trước | Sau |
|---|---|---|
| `UX-M14-013` | `FieldError` là `<p>` trần | `role="alert"` + `id` — trình đọc màn hình đọc lỗi lên ngay khi server trả `fieldErrors` |
| `UX-M14-013` | 3 control không có `aria-invalid` | `aria-invalid={Boolean(fieldErrors[…])}` + `aria-describedby` trỏ về `<id>-error`, **chỉ khi thật sự có lỗi** (`undefined` thì React bỏ hẳn thuộc tính, không sinh `aria-describedby=""` trỏ vào hư không) |
| `UX-M14-014` | `className="h-11"` ở **cả hai** nút submit | Bỏ hẳn. Cảm ứng vẫn đủ 44px do `globals.css` ép trong `@media (pointer: coarse)` — đúng `DS-013`, lặp lại cách xử lý của `M15-S03` |
| `UX-M14-015` (2/4) | `text-xs` ở chú thích hệ quả nghiệp vụ và ở **thông báo lỗi** | `text-sm`. Lỗi giữ `text-destructive` nhưng không còn là chữ nhỏ nhất màn hình |

**Vì sao `role="alert"` chứ không phải `aria-live="polite"`:** lỗi này xuất hiện **sau một hành động người dùng vừa chủ động làm** (bấm submit) và chặn họ đi tiếp — đúng ngữ cảnh của `assertive`. `polite` sẽ đợi hàng đợi rỗng, có thể im lặng vài giây sau khi trang đã vẽ lại.

**Không mở rộng `aria-describedby` sang chú thích:** `DS-025` chỉ mở "ARIA của lỗi". Gắn thêm chú thích vào `describedby` là quyết định nội dung, để module sau.

**Không đụng:** `saveSessionLogAction`, `useFormAction`, `name=`/`value=` của 2 nút, `maxLength` 5000/2000, `defaultValue`, hộp xác nhận "Hoàn tất buổi", `SessionSubmitActions` (giữ nguyên theo `UX-M14-019`).

**Kiểm tra:** lint ✅ · typecheck ✅ · test ✅ **170/170** (52 file, 111.8s) — bằng đúng số trước phiên, không test nào đỏ và không thêm/sửa/nới test nào.

### `S04` — Màn B, khung trang + 8 tab (`DS-024`) ✅

**File:** `src/app/(dashboard)/teacher/classes/[id]/page.tsx`.

| Issue | Trước | Sau |
|---|---|---|
| `UX-M14-003` | `Tabs defaultValue="overview"` — state React, mất khi Back/refresh/share link | `Tabs value={activeTab}` + mỗi `TabsTrigger asChild` bọc `<Link href="?tab=…" scroll={false}>` |
| `UX-M14-006` | Vùng cuộn 8 tab không có dấu hiệu còn tab bên phải | Bóng mép thuần CSS bằng `background-attachment: local, local, scroll, scroll` |
| `UX-M14-008` (8/10) | 8 `CardTitle` render `<div>` | `asChild` + `<h2>` — **10/10 khối của module nay có heading thật** |
| `UX-M14-010` | Link "Lớp của tôi" không focus style | `rounded-md focus-visible:ring-2` |

**Cách `?tab=` được làm — 3 điểm đáng ghi:**

1. **`CLASS_TABS` là nguồn sự thật duy nhất.** Danh sách 8 tab dùng cho **cả** `TabsTrigger` **lẫn** việc kiểm `?tab=`, nên không thể xảy ra cảnh thêm tab mới mà quên cho vào danh sách hợp lệ.
2. **Fail-closed:** `?tab=xyz` không khớp → rơi về `"overview"`, không bao giờ render khung rỗng. Đúng tinh thần `AGENTS.md`.
3. **`activationMode="manual"`.** Mặc định Radix là `automatic`: mũi tên trái/phải vừa dời focus vừa kích hoạt tab. Ở đây `Tabs` là **controlled** và không có `onValueChange` — `automatic` sẽ làm focus nhảy sang tab 2 trong khi tab 1 vẫn `aria-selected="true"`, tức trình đọc màn hình đọc sai. `manual` cho mũi tên dời focus, `Enter` mới điều hướng — và `Enter` trên `<a href>` là hành vi gốc của trình duyệt, không cần thêm gì.

**Vì sao bóng mép hoạt động (và vì sao phải chuyển `bg-muted` ra ngoài):** kỹ thuật này vẽ 4 gradient lên **nền của phần tử cuộn**. Trước đây `TabsList` mang `bg-muted` và `min-w-max`, tức nó **phủ kín** toàn bộ bề rộng cuộn — gradient vẽ ở dưới sẽ bị che hoàn toàn. Nên `bg-muted` chuyển ra div cuộn, `TabsList` thành `bg-transparent`; trigger không active vốn đã trong suốt nên bóng lộ ra đúng chỗ. Thị giác không đổi: vẫn đúng một dải muted bo góc.

Hai lớp `local` mang màu `var(--muted)` cuộn **theo** nội dung, che hai lớp `rgb(0 0 0 / 0.14)` đứng yên. Hệ quả: cuộn hết sang phải thì lớp che tới nơi và bóng phải **tắt** — không có tín hiệu giả. Tab đủ chỗ (desktop rộng) thì không cuộn được, cả hai bóng đều bị che → không hiện. Không một dòng JS nào.

⚠️ **Rủi ro `DS-024` chưa đo được — xem §8.**

**Không đụng:** `NAVIGATION` (`DS-012` còn nguyên cho sidebar), route, `requireRole`, `getClassById`, không thêm `"use client"`, không động `UX-M14-011`.

**Kiểm tra:** lint ✅ · typecheck ✅.

### `S05` — Màn B, nội dung trong tab ✅

**File:** `src/app/(dashboard)/teacher/classes/[id]/page.tsx` · `src/lib/domain/labels.ts`.

| Issue | Trước | Sau |
|---|---|---|
| `UX-M14-001` | `label={assignment.status}` in thẳng `results_published` ra giao diện | `EXERCISE_DELIVERY_STATUS_LABELS[…]` + `EXERCISE_DELIVERY_STATUS_TONE[…]` |
| `UX-M14-001` | `{assessment.exam_type}` in thẳng `mock_hsk` | `ASSESSMENT_TYPE_LABELS[…]` — map đã có sẵn từ trước, chỉ là chưa ai dùng |
| `UX-M14-005` | **11 chỗ** `text-xs` cho nội dung thật | `text-text-secondary text-sm` (7.81:1). `grep text-xs` trên file nay trả về **0** |
| `UX-M14-007` | `grid gap-1 text-xs sm:grid-cols-4` → 4 chỉ số xếp 4 dòng 12px ở mobile | `grid-cols-2 sm:grid-cols-4` + `text-sm` → mobile thành 2×2, thêm `gap-x-4` cho hai cột không dính nhau |
| `UX-M14-009` | `target="_blank"` không báo trước | Icon `ExternalLink` + `aria-label="Mở phòng học trực tuyến trong tab mới: …"` |

**8 nhãn `EXERCISE_DELIVERY_STATUS_LABELS` — user duyệt nguyên bảng §5.2 trong phiên này**, `Q6` đóng. `tone` kèm theo: `results_published`→`success`, `open`→`info`, `closed`/`grading`→`warning`, `cancelled`→`danger`, còn lại `neutral`. Badge luôn kèm chữ nên màu không phải tín hiệu duy nhất.

**Cái này bắt được bug thầm lặng:** `Record<Enums["exercise_delivery_status"], string>` buộc phủ đủ 8 giá trị. Code cũ `tone={status === "results_published" ? "success" : "neutral"}` gộp **7 trạng thái rất khác nhau** — kể cả `cancelled` — vào chung một màu xám.

**`aria-label` trên link ngoài thay luôn nội dung đọc lên:** trước đây trình đọc màn hình đọc cả chuỗi URL thô mà không biết nó mở tab mới. Nay đọc rõ mục đích trước, URL sau. Icon `aria-hidden` để không đọc thành hai lần.

**Không đụng:** `getClassProgress`, `formatPercent`/`formatScore`/`formatAttendanceScore`, `MaterialsManager`, `SessionCalendar`, đích của 2 nút sang M16/M17 (`UX-M14-011` vẫn `OPEN — ghi nhận`).

**Kiểm tra:** lint ✅ · typecheck ✅ · test ✅ **170/170** · build ✅ `Compiled successfully in 24.4s`.

## 8. Final Module Verification

### Đã chạy

| Check | Command | Result | Ghi chú |
|---|---|---|---|
| Lint | `npm run lint` | ✅ **PASS** | Chạy sau **cả 5** subtask, không lần nào có output |
| Type-check | `npm run typecheck` | ✅ **PASS** | Như trên |
| Test | `npm test -- --maxWorkers=4` | ✅ **170/170** | 52 file, 122.5s. Chạy 2 lần: sau `S03` và ở cuối. **Bằng đúng số trước phiên** — không thêm/sửa/nới/skip test nào |
| Build | `npm run build` | ✅ **PASS** | `✓ Compiled successfully in 24.4s` |

Không dùng một `eslint-disable`, `@ts-ignore` hay nới cấu hình nào.

### ⚠️ Hai thứ CHƯA kiểm được trong phiên này — không được ghi là đã đo

**1. Responsive 360 / 640 / 768 / 1280 — chưa mở trình duyệt thật.** Phiên này chạy không có Docker/`supabase start` nên không dựng được trang có dữ liệu. Những gì làm được là suy luận từ code, và **suy luận không thay thế được phép đo**:

| Tầng | Suy luận | Vẫn phải kiểm tay |
|---|---|---|
| 360px | Màn A 1 cột; 4 chỉ số tiến độ nay 2×2 thay vì 4×1; tab strip cuộn ngang, bóng mép phải hiện ở mép phải | Bóng mép có hiện thật không, và có **tắt** khi cuộn hết sang phải không |
| 640px | Điểm `sm:grid-cols-3` của màn C bật — chỗ `UX-M14-016` xảy ra. Đã bỏ `truncate` nên chuỗi giờ xuống dòng | Chuỗi `21/07/2026 18:00–19:30` phải hiện **đủ giờ kết thúc**, 3 thẻ vẫn cao bằng nhau |
| 768px | Sidebar hiện, main hẹp lại — 8 tab vẫn tràn | Tab strip không đẩy trang scroll ngang |
| 1280px | 8 tab đủ chỗ → không cuộn được → **cả hai bóng phải bị che, không hiện** | Đây là ca dễ sai nhất của kỹ thuật bóng mép |

**2. Tốc độ đổi tab sau `DS-024` — chưa đo, và §5.3 bắt buộc phải đo.** Mỗi lần đổi tab nay là một lần điều hướng server, chạy lại `getClassById` (`select *` + 6 quan hệ lồng) cùng `getClassProgress`, `getCourseCurriculum`, `getCourseMaterials`. Đây là **đánh đổi có chủ đích** của `DS-024`: URL chia sẻ được, Back hoạt động đúng, refresh không mất chỗ — trả giá bằng một round-trip mỗi lần đổi tab.

§5.3 đã ghi sẵn ranh giới: **chậm rõ rệt thì ghi `BLOCKED` và hỏi user, không tự chuyển sang client component.** Ranh giới đó vẫn nguyên hiệu lực và người đo phải theo.

> Vì hai mục này chưa đo, **module KHÔNG được đánh `DONE`.** Trạng thái đúng là `IMPLEMENTED — chờ đo`.

### Người sửa là Claude → không tự ghi Verified

Cần Codex hoặc user dựng lại, theo thứ tự ưu tiên:

1. **`?tab=` (`S04`, rủi ro cao nhất):** mở tab "Tiến độ" → URL phải thành `?tab=progress`; bấm một link rồi Back → phải **quay lại đúng tab Tiến độ**; F5 → vẫn ở Tiến độ; dán URL sang cửa sổ khác → mở đúng tab. Gõ tay `?tab=xyz` → phải rơi về "Tổng quan", **không** khung rỗng.
2. **Bàn phím trên tab strip:** Tab tới tab strip, mũi tên trái/phải **dời focus mà chưa đổi tab** (`activationMode="manual"`), `Enter` mới đổi.
3. **Lỗi form màn C (`S03`):** bật trình đọc màn hình, xóa trắng "Nội dung thực dạy", bấm "Hoàn tất buổi" → lỗi phải **được đọc lên**, không im lặng.
4. **Bóng mép tab (`S04`):** xem bảng responsive ở trên — đặc biệt ca 1280px không được hiện bóng.
5. **Nhãn bài tập (`S05`):** tab "Bài tập" không còn chữ `results_published`/`draft` tiếng Anh nào lọt ra.

## 9. Remaining Issues

| Issue | Trạng thái | Vì sao chưa đóng |
|---|---|---|
| `UX-M14-011` | **OPEN — ghi nhận** | Thêm `?class=<id>` cho nút sang M16/M17 là đổi hành vi navigation, `DS-012` cấm. `DS-024` cố ý **chỉ** mở phần tab của chính trang này, không mở rộng sang đây. Cần user duyệt riêng |
| `UX-M14-012` | **OPEN — ghi nhận** | `[id]/page.tsx` vẫn ~700 dòng (dài thêm vì `CLASS_TABS` + 8 `<h2>`). Tách file là refactor, ngoài phạm vi UI/UX |
| `UX-M14-019` | **OPEN — ghi nhận** | `SessionSubmitActions` không gộp vào `SubmitButton` chung: hai nút mang `name="intent"` khác `value` và nút thứ hai chặn submit để hỏi xác nhận. Gộp = đổi hành vi submit, rủi ro > lợi ích. Hành vi hiển thị hiện tại đã đúng |
| ~~`UX-M14-002`~~ | **INVALID** | Báo động giả, có đính chính đầy đủ ở §4. Không sửa gì |

**15/19 issue đã FIXED.** Ba issue còn lại đều là "chỉ ghi nhận" đã quyết từ lúc audit, không phải việc bỏ dở.

## 10. Final Status

**`IMPLEMENTED — chờ đo responsive + tốc độ đổi tab`.**

5/5 subtask xong, 15/19 issue FIXED, lint/typecheck/test/build đều xanh. **Chưa đủ điều kiện `DONE`** vì completion gate còn 2 ô trống: responsive 3 tầng và tốc độ đổi tab — cả hai cần trình duyệt thật, xem §8.

Toàn bộ thay đổi nằm trong 3 page + 1 component + 1 file nhãn. **Không sửa file nào trong `src/components/`** — `CardTitle asChild` chỉ được **dùng**, đúng như dự kiến ở §1.
