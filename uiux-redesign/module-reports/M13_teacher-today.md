# [M13] Hôm nay (Teacher) — UI/UX Audit & Improvement

## 1. Scope

| Field | Value |
|---|---|
| Module ID | M13 |
| Module name | Hôm nay (Teacher) — dashboard buổi dạy trong ngày |
| Routes | `/teacher` |
| Roles/permissions | `teacher` — `requireRole("teacher")` tại `teacher/page.tsx:34`. RLS khoanh phạm vi qua `class_teachers`, **không** lọc ở tầng app |
| Screens | 1 màn hình, 5 khối: Lịch dạy hôm nay · Buổi chưa điểm danh · Bài chờ chấm · Lớp của tôi · Học viên cần chú ý |
| Source in scope | `src/app/(dashboard)/teacher/page.tsx` (313 dòng) |
| Shared component đụng tới | `src/components/ui/card.tsx` — chỉ **thêm** prop `asChild` cho `CardTitle` (xem §7) |
| Out of scope | Business logic, `features/dashboard/server/teacher-queries.ts`, database, API, route, permission, validation, nhãn/nội dung |

## 2. Existing Technology

Chép từ `02_UIUX_DESIGN_SYSTEM.md` §1 — **không khảo sát lại**.

| Item | Current usage | Source evidence |
|---|---|---|
| Framework | Next.js 16.2.10 App Router, React 19.2.4, RSC. Trang này là **server component** `async` | `teacher/page.tsx:31` |
| UI library | shadcn/ui `new-york` — `Card`, `Button`, `Badge` | `components.json` |
| CSS | Tailwind v4, token khai báo trong `globals.css` (không có `tailwind.config.js`) | `02` §1 |
| Icons | lucide-react — 7 icon dùng ở trang này | `teacher/page.tsx:3-11` |
| Tokens/theme | Sau `M00-S01`: có `--surface-page`, `--surface-sunken`, `--text-secondary`, `--border-strong`, thang `--primary-50…950`. Sau `M00-S08`: **chỉ còn Light** | `globals.css` |
| Shared component đã chuẩn hoá | `PageHeader` (dùng `--text-secondary`), `EmptyState`, `StatusBadge` | `M00-S05` |

## 3. Existing UI Audit

### Layout

- Grid 2 cột chỉ bật từ `xl` (1280px): `grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]` (`:49`). Dưới 1280px là một cột — hợp lý vì cột phải là thông tin tham chiếu.
- 5 `Card`, mỗi card `CardHeader` + `CardContent className="p-0"` bọc một `<ul className="divide-y border-t">`.
- **Lệch padding:** `CardHeader`/`CardContent` dùng `px-6` (`card.tsx:23,70`) nhưng hàng danh sách dùng `px-5` (`:74,147,193,247,293`). Mép trái tiêu đề và mép trái nội dung **không thẳng hàng** — lệch 4px trên mọi card.

### Navigation

- Không có điều hướng riêng của module; mọi lối đi là link/nút sang `/teacher/attendance`, `/teacher/sessions/[id]`, `/teacher/classes/[id]`, `/teacher/{exercises,exams}`.
- Hàng "Lớp của tôi" là link phủ cả hàng (`:245-264`) — đúng hướng, nhưng thiếu focus state (xem §4).

### Table

Không có `<Table>`. Toàn bộ là danh sách `<ul>/<li>` — phù hợp vì mỗi hàng có 3–4 mảnh thông tin, không phải ma trận cột. **Không đổi sang bảng.**

### Form

N/A — trang chỉ đọc, không có form, không có input.

### Modal

N/A — không có dialog nào.

### States

- **Loading:** có, ở cấp shell — `(dashboard)/loading.tsx` → `PageLoadingOverlay`. Trang `await Promise.all` 5 query nên không có loading cục bộ từng card.
- **Empty:** ✅ đủ 5/5 khối, dùng `EmptyState` với icon + tiêu đề + mô tả (`:64,137,183,236,285`).
- **Error:** ❌ **không có** `error.tsx` ở bất kỳ đâu trong `src/app/`. 5 query đều `throw new Error(...)` khi lỗi (`teacher-queries.ts:105,127,152,170,185`) → rơi vào trang lỗi mặc định của Next, không có tiếng Việt và không có đường phục hồi. Xem `UX-M13-009`.
- **Disabled:** N/A — không có control nào có trạng thái disabled.
- **Success:** N/A — trang chỉ đọc, không có mutation.

### Accessibility

- **Heading:** trang chỉ có đúng **một** heading — `<h1>` trong `PageHeader`. 5 tiêu đề card render thành `<div>` (`card.tsx:31`), nên với trình đọc màn hình toàn bộ trang là một khối phẳng, không nhảy được giữa 5 khu vực.
- **Focus:** nút và link dạng `Button asChild` có `focus-visible:ring-[3px]` từ `button.tsx`. **Hàng link "Lớp của tôi" (`:245`) không có focus style riêng** — chỉ dựa outline mặc định của trình duyệt.
- **Icon:** tất cả icon trang trí đều có `aria-hidden` ✅ (`:55,94,100,113,128,177,276`).
- **Màu không phải tín hiệu duy nhất:** ✅ — "Đã điểm danh" có icon `CheckCircle2` + chữ; `StatusBadge` luôn kèm nhãn chữ.
- **Contrast:** `text-success` `#166534` trên trắng = 7.13:1 ✅. `text-muted-foreground` `#5B6B80` = 5.44:1 ✅ — nhưng đang bị dùng ở cỡ 12px cho nội dung thật.
- **Touch target:** nút đều dùng `Button` → ≥44px trên cảm ứng theo `globals.css` ✅.

### Responsive

- Mobile 360–430px: một cột; hàng dùng `flex-wrap` nên nút xuống dòng thay vì tràn. Không có phần tử nào có chiều rộng cố định vượt viewport (`w-24` = 96px là lớn nhất). Không scroll ngang.
- Tablet 768–1024px: vẫn một cột, card kéo hết chiều rộng.
- Desktop 1280px+: hai cột, cột phải tối thiểu `20rem`.

## 4. Problems with Evidence

| Issue ID | Screen/Component | Problem | Evidence | Severity | Proposed fix |
|---|---|---|---|---|---|
| `UX-M13-001` | Lịch dạy hôm nay · Buổi chưa điểm danh · Lớp của tôi | **Mã lớp — thứ nhận dạng hàng — là chữ nhỏ nhất trên hàng.** Nó nằm ở `text-xs` (12px) trong khi "Buổi N" ngay cạnh là 16px | `page.tsx:82-85` (`font-mono text-xs` trong `<p className="truncate font-medium">`), `:151`, `:251` | **Medium** | Mã lớp về `text-sm`, giữ `font-mono` và `font-medium`. Phân cấp bằng màu/độ đậm, không bằng thu nhỏ |
| `UX-M13-002` | Cả 5 khối | **Nội dung thật bị nén xuống cấp chữ nhỏ nhất.** Chủ đề buổi học, ngày nộp bài, tên bài, mã học viên, tên lớp — đều là dữ liệu người dùng cần đọc, không phải chú thích | `:87` (topic), `:156` (ngày + tiến độ điểm danh), `:199` (tên bài + ngày nộp), `:295` (mã HV + tên lớp), `:93` (đã điểm danh x/y), `:261` (sĩ số) | **Medium** | Nâng lên `text-sm` + `text-text-secondary` (7.81:1). Đây đúng là lý do `--text-secondary` được thêm ở `M00-S01`. Thuộc `UX-M00-004` |
| `UX-M13-003` | Cả 5 card | **Mép trái nội dung không thẳng mép trái tiêu đề** — card dùng `px-6`, hàng dùng `px-5` | `card.tsx:23,70` vs `page.tsx:74,147,193,247,293` | **Low** | `px-5` → `px-6` |
| `UX-M13-004` | Lớp của tôi | **Hàng link không có focus nhìn thấy được** khi đi bằng bàn phím; hover dùng alpha ngẫu hứng `bg-muted/40` thay vì token | `:247` `className="hover:bg-muted/40 flex items-center justify-between gap-3 px-5 py-3"` | **High** | `hover:bg-primary-50` (token `M00-S01`) + `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none`. Cùng cách đã làm cho nav item ở `M00-S02` |
| `UX-M13-005` | Lớp của tôi | **Nền hover của hàng cuối phủ vuông ra ngoài góc bo của card**: `Card` có `rounded-xl` nhưng không `overflow-hidden`, còn hàng cuối có nền hover chạy sát mép | `card.tsx:10` (`rounded-xl`, không có overflow) + `page.tsx:245` | **Low** | Thêm `overflow-hidden` cho đúng card đó. An toàn vì focus ring dùng `ring-inset` nên không bị cắt (`02` §8) |
| `UX-M13-006` | Cả 5 card | **Trang không có cấu trúc heading.** `CardTitle` render `<div>` nên 5 khu vực lớn không phải heading — trình đọc màn hình không nhảy khối được, vi phạm `heading-hierarchy` | `card.tsx:31` (`function CardTitle` → `<div>`); `page.tsx:54,127,176,230,275` | **Medium** | Thêm prop **tuỳ chọn** `asChild` cho `CardTitle` (mặc định vẫn `<div>`, 68 chỗ dùng hiện tại không đổi gì), rồi truyền `<h2>` ở 5 tiêu đề của trang này |
| `UX-M13-007` | Lịch dạy hôm nay | Hai nút trong một hàng đều ở cấp cao ("Điểm danh" `default` + "Nhật ký" `outline`), trong khi `02` §8 xếp hành động phụ trong hàng danh sách vào cấp **ghost** | `:98-116` | **Low** | "Nhật ký" → `variant="ghost"`. Giữ nguyên nhãn, icon và đích đến |
| `UX-M13-008` | Lịch dạy · Bài chờ chấm · Lớp của tôi | Chữ bị `truncate` không có cách nào xem đầy đủ | `:81,87,150,196,199,259` | **Low** | Thêm `title` cho phần tử bị cắt (`truncation-strategy`). Không đổi nội dung, chỉ thêm cách đọc |
| `UX-M13-009` | Toàn ứng dụng (phát hiện tại M13) | **Không có `error.tsx` ở bất kỳ đâu trong `src/app/`.** 5 query của trang đều `throw` khi lỗi → người dùng thấy trang lỗi mặc định của Next, không tiếng Việt, không đường phục hồi | `teacher-queries.ts:105,127,152,170,185`; `find src/app -name "error.tsx"` → không có kết quả | **Medium** | **Chỉ ghi nhận.** Thêm error boundary là thêm hành vi mới ở tầng shell (M00), ảnh hưởng cả 29 module → cần user quyết phạm vi, không tự làm trong M13 |

## 5. Proposal Before Code

### Overall style

Giữ nguyên ngôn ngữ hiện tại: card trắng trên nền `--surface-page`, danh sách phân cách bằng `divide-y`, không thêm hiệu ứng trang trí. Đây là màn hình giáo viên mở giữa buổi dạy — mục tiêu là **quét nhanh**, không phải đẹp mắt. Toàn bộ thay đổi nằm ở **phân cấp thị giác** và **khả năng tiếp cận**, không đụng bố cục.

### Current primary color and continued usage

`#1A5FA8` giữ nguyên (`DS-001`). Nút "Điểm danh" vẫn là `Button` variant `default` → nền primary, hover cam thương hiệu. Không thêm màu mới ở module này.

### Extended palette

Chỉ dùng token đã có sau `M00-S01`, không tự đặt màu:

| Token | Dùng ở đâu trong M13 |
|---|---|
| `text-text-secondary` `#43536B` (7.81:1) | Chủ đề buổi học, ngày nộp, mã HV, tên lớp, tiến độ điểm danh — thay `text-muted-foreground` cỡ 12px |
| `bg-primary-50` `#F5F9FD` | Nền hover hàng "Lớp của tôi", thay `bg-muted/40` |
| `ring-ring` `#1A5FA8` | Focus ring hàng link |
| `text-success` `#166534` | Giữ nguyên cho "Đã điểm danh" |

### Typography

Áp thang ở `02` §4. Cụ thể cho trang này:

| Vai trò | Hiện tại | Sau |
|---|---|---|
| Tiêu đề card | `text-base` 600 | giữ nguyên, nhưng render thành `<h2>` |
| Mã lớp | `text-xs` mono | `text-sm` mono |
| Chủ đề buổi / tên lớp | `text-xs` muted | `text-sm` `text-secondary` |
| Meta thật (ngày, sĩ số, tiến độ) | `text-xs` muted | `text-sm` `text-secondary` |
| Nhãn giờ | `text-sm` `tabular-nums` | giữ nguyên |

Không thêm cấp chữ mới. Không còn `text-xs` nào trong trang sau khi sửa — vì trang này **không có** meta cấp ba thật sự.

### Spacing

Giữ thang 4px. Chỉ đồng bộ `px-5` → `px-6` cho khớp padding card. `gap-5` giữa các card giữ nguyên (`space-5` = 20px, hợp mật độ trung bình-cao của app quản lý).

### Radius and shadow

Không đổi. `Card` giữ `rounded-xl` + `shadow-sm`. Thêm `overflow-hidden` cho một card duy nhất ("Lớp của tôi") vì đó là card duy nhất có hàng nền-hover chạm mép.

### Button/action hierarchy

Theo `02` §8, mỗi hàng:

| Cấp | Nút | Variant |
|---|---|---|
| Primary | "Điểm danh" (buổi hôm nay chưa điểm danh) | `default` — giữ |
| Secondary | "Điểm danh" ở khối tồn đọng, "Chấm bài" | `outline` — giữ |
| Tertiary | "Nhật ký" | `outline` → **`ghost`** |

Không thêm variant mới (`DS-007`). Không đổi size — sau `M00-S06`, `size="sm"` = 36px trên chuột / 44px trên cảm ứng.

### Table

N/A — không có bảng. Danh sách giữ nguyên dạng `<ul>`.

### Form

N/A — trang chỉ đọc.

### Modal

N/A.

### Navigation

Không đổi route, không đổi đích đến của bất kỳ link nào. Chỉ thêm focus state cho hàng link.

### Responsive behavior

Không đổi breakpoint, không đổi grid. Việc nâng cỡ chữ từ 12px lên 14px làm hàng cao thêm ~2px trên mobile — chấp nhận được và đúng hướng (dễ đọc hơn khi cầm điện thoại giữa buổi dạy). Kiểm lại cả 3 tầng sau khi sửa.

### Loading/empty/error/disabled/success

| State | Xử lý |
|---|---|
| Loading | Giữ nguyên overlay cấp shell. Không thêm skeleton từng card — trang `await Promise.all` một lần, thêm skeleton sẽ là thay đổi cách render (chia Suspense), tức đổi hành vi |
| Empty | Đã đủ 5/5, giữ nguyên `EmptyState` |
| Error | **Ghi nhận `UX-M13-009`, không tự sửa** — thuộc tầng shell, cần user quyết |
| Disabled | N/A — không có control disabled |
| Success | N/A — trang chỉ đọc |

## 6. Screen Plan

| Subtask ID | Screen/Component group | Source files | Risk | Status |
|---|---|---|---|---|
| `M13-S01` | `CardTitle asChild` — mở đường cho heading thật | `src/components/ui/card.tsx` | Trung bình (shared, nhưng chỉ **thêm** prop tuỳ chọn) | ✅ DONE |
| `M13-S02` | Cột trái — Lịch dạy hôm nay · Buổi chưa điểm danh · Bài chờ chấm | `teacher/page.tsx` | Thấp | ✅ DONE |
| `M13-S03` | Cột phải — Lớp của tôi · Học viên cần chú ý | `teacher/page.tsx` | Thấp | ✅ DONE |

## 7. Implementation Log

### [M13-S01] `CardTitle` nhận `asChild`

**Status:** DONE — 2026-07-21

**Files changed:** `src/components/ui/card.tsx`

**Components changed:** `CardTitle` — thêm prop `asChild?: boolean`, mặc định `false`.

**UI/UX problems resolved:** mở đường cho `UX-M13-006`.

**Impacted modules:** `CardTitle` đang được dùng **68 lần / 34 file**. Thay đổi này **không đổi hành vi của một chỗ nào**: khi không truyền `asChild`, component vẫn render đúng `<div data-slot="card-title">` với đúng class như trước. Dùng `Slot.Root` của `radix-ui` — đúng cách `badge.tsx:36` và `button.tsx:53` đã làm, không thêm phụ thuộc mới.

**Vì sao không sửa cứng thành `<h3>`:** đổi thẳng element sẽ áp heading cho cả 68 chỗ, trong đó có những card nằm trong tab/dialog mà cấp heading phải khác. Prop tuỳ chọn để mỗi module tự chọn đúng cấp.

**Behavior preserved:**

- [x] Business logic unchanged
- [x] Database/migration unchanged
- [x] API contract unchanged
- [x] Route unchanged
- [x] Permission unchanged
- [x] Validation unchanged
- [x] Labels/content unchanged

### [M13-S02] Cột trái — Lịch dạy hôm nay · Buổi chưa điểm danh · Bài chờ chấm

**Status:** DONE — 2026-07-21

**Files changed:** `src/app/(dashboard)/teacher/page.tsx`

**UI/UX problems resolved:** `UX-M13-001`, `-002`, `-003`, `-006`, `-007`, `-008` (phần cột trái).

**Chi tiết:**

- 3 `CardTitle` thành `<h2>` thật qua `asChild`.
- Mã lớp `text-xs` → `text-sm`; chủ đề buổi, ngày nộp, tên bài, tiến độ điểm danh `text-muted-foreground text-xs` → `text-text-secondary text-sm`.
- `px-5` → `px-6` cho khớp mép trái tiêu đề card.
- "Nhật ký" `outline` → `ghost`.
- Thêm `title` cho các phần tử `truncate`.

**Behavior preserved:**

- [x] Business logic unchanged — không đụng `teacher-queries.ts`
- [x] Database/migration unchanged
- [x] API contract unchanged
- [x] Route unchanged — mọi `href` giữ nguyên từng ký tự
- [x] Permission unchanged
- [x] Validation unchanged
- [x] Labels/content unchanged — không đổi một chữ tiếng Việt nào

**Responsive result:**

- Mobile 360–430px: một cột; hàng vẫn `flex-wrap`, nút xuống dòng khi hết chỗ. Chữ 14px thay 12px làm hàng cao thêm ~2px. Không scroll ngang cấp trang.
- Tablet 768–1024px: một cột, không đổi bố cục.
- Desktop 1280px+: hai cột như cũ; mép trái tiêu đề và nội dung nay thẳng hàng.
- Horizontal page scroll: **None**.

**States checked:**

- [x] Hover — nút theo `button.tsx`, không đổi
- [x] Focus — nút có `ring-[3px]` sẵn
- [x] Active
- [x] Loading — overlay cấp shell, không đổi
- [x] Empty — 3/3 khối vẫn dùng `EmptyState`
- [ ] Error — **chưa xử lý**, xem `UX-M13-009` (ngoài phạm vi module)
- [x] Success — N/A, trang chỉ đọc
- [x] Disabled — N/A

### [M13-S03] Cột phải — Lớp của tôi · Học viên cần chú ý

**Status:** DONE — 2026-07-21

**Files changed:** `src/app/(dashboard)/teacher/page.tsx`

**UI/UX problems resolved:** `UX-M13-001`, `-002`, `-003`, `-004`, `-005`, `-006`, `-008` (phần cột phải).

**Chi tiết:**

- 2 `CardTitle` thành `<h2>`.
- Hàng "Lớp của tôi": `hover:bg-muted/40` → `hover:bg-primary-50`; thêm `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none` — trước đó đi bàn phím qua danh sách lớp **không thấy mình đang ở đâu**.
- Card "Lớp của tôi" thêm `overflow-hidden` để nền hover hàng cuối không phủ vuông ra ngoài góc bo. Focus ring dùng `ring-inset` nên không bị `overflow-hidden` cắt.
- Mã lớp và tên lớp lên `text-sm`; sĩ số và mã học viên dùng `text-text-secondary`.

**Behavior preserved:**

- [x] Business logic unchanged
- [x] Database/migration unchanged
- [x] API contract unchanged
- [x] Route unchanged
- [x] Permission unchanged
- [x] Validation unchanged
- [x] Labels/content unchanged

**Responsive result:**

- Mobile 360–430px: hàng lớp vẫn `justify-between`, sĩ số không bị đẩy xuống. Không scroll ngang.
- Tablet 768–1024px: không đổi.
- Desktop 1280px+: cột phải rộng tối thiểu `20rem`, không đổi.
- Horizontal page scroll: **None**.

**States checked:**

- [x] Hover — nền `primary-50`
- [x] Focus — ring 2px inset, nhìn rõ trên nền trắng (6.47:1)
- [x] Active
- [x] Loading — overlay cấp shell
- [x] Empty — 2/2 khối
- [ ] Error — xem `UX-M13-009`
- [x] Success — N/A
- [x] Disabled — N/A

## 8. Final Module Verification

| Check | Result | Evidence |
|---|---|---|
| Scope respected | ✅ | Không đổi logic/API/route/permission/validation/nhãn. `teacher-queries.ts` không đụng một dòng |
| Shared component impact | ✅ Đã rà | `card.tsx` — 68 chỗ dùng / 34 file; chỉ **thêm** prop tuỳ chọn, mặc định giữ nguyên `<div>` |
| Responsive complete | ✅ | 3 tầng, ghi ở S02 và S03 |
| Accessibility reviewed | ✅ | Thêm cấu trúc heading (1 `h1` + 5 `h2`); thêm focus nhìn thấy được cho hàng link; nâng nội dung từ 12px lên 14px |
| Lint | ✅ Pass | `npm run lint` |
| Type-check | ✅ Pass | `npm run typecheck` |
| Test | ✅ 162/162 | `npm test -- --maxWorkers=4` |
| Build | ✅ Pass | `npm run build` |

## 9. Remaining Issues

- `UX-M13-009` — **không có error boundary trong toàn bộ `src/app/`**. Ghi nhận, chưa sửa: thêm `error.tsx` là thêm hành vi ở tầng shell, ảnh hưởng cả 29 module. **Cần user quyết** có mở rộng phạm vi hay không.
- `UX-M00-005` (radius ngoài thang) — trang này không có `rounded-2xl`/`rounded-none` nên không áp dụng.

## 10. Final Status

`DONE`

> Người sửa là Claude nên **không tự ghi Verified**. Cần Codex hoặc user xác minh độc lập: mở `/teacher` bằng tài khoản giáo viên, tab bàn phím qua danh sách "Lớp của tôi" để thấy focus ring, kiểm mép trái tiêu đề/nội dung thẳng hàng, và kiểm mobile 360px không scroll ngang.
