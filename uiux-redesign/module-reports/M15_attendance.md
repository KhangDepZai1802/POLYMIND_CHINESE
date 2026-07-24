# [M15] Điểm danh — UI/UX Audit & Improvement

## 1. Scope

| Field | Value |
|---|---|
| Module ID | M15 |
| Module name | Điểm danh — giáo viên đánh dấu trạng thái từng học viên của một buổi |
| Routes | `/teacher/attendance` và `/teacher/attendance?session=<id>` (cùng một page, hai nhánh render) |
| Roles/permissions | `requireRole("teacher", "super_admin")` tại `attendance/page.tsx:31`. Phạm vi buổi học do **RLS** khoanh: `getAttendanceSheet` trả `null` khi không được đọc → `notFound()` (`:103-104`). Không có lớp kiểm quyền nào ở tầng app — **không đụng tới** |
| Screens | **2 màn hình** trong một route: (A) chọn buổi cần điểm danh · (B) roster điểm danh một buổi |
| Source in scope | `src/app/(dashboard)/teacher/attendance/page.tsx` (154 dòng) · `src/features/attendance/components/attendance-roster.tsx` (206 dòng) |
| Shared component đụng tới | **Không** — dự kiến không sửa file nào trong `src/components/` |
| Out of scope | `features/attendance/server/{queries,actions}.ts`, RPC `bulk_mark_attendance`, business logic, database, API, route, permission, validation, nhãn/nội dung |

**Bối cảnh sử dụng** (quyết định thứ tự ưu tiên của module này): màn hình được mở **giữa buổi dạy, trên điện thoại, giáo viên đang đứng trong lớp**. Ưu tiên số một là **bấm không nhầm** và **không mất dữ liệu đã bấm**. Thẩm mỹ xếp sau.

## 2. Existing Technology

Chép từ `02_UIUX_DESIGN_SYSTEM.md` §1 — **không khảo sát lại**.

| Item | Current usage | Source evidence |
|---|---|---|
| Framework | Next.js 16.2.10 App Router, React 19.2.4. Màn A/B là **server component** `async`; roster là **client component** (`"use client"`) | `attendance/page.tsx:26`, `attendance-roster.tsx:1` |
| UI library | shadcn/ui `new-york` — `Card`, `Button`, `Input`, `Alert` | `components.json` |
| CSS | Tailwind v4, token trong `globals.css` (không có `tailwind.config.js`) | `02` §1 |
| Icons | lucide-react — 9 icon (`ArrowLeft`, `BookOpenCheck`, `CalendarClock`, `CheckCircle2`, `AlertCircle`, `Check`, `Clock`, `ShieldCheck`, `X`) | `page.tsx:4-9`, `roster:4` |
| Tokens/theme | Sau `M00-S01`/`S06`/`S08`/`S09`: có `--surface-page`, `--text-secondary`, thang `--primary-50…950`, thang kích thước control 32/36/40/44, viền control `#7C8DA4`, **chỉ Light** | `globals.css` |
| Form | Server Action + `useFormAction` (toast success, `Alert` cho error) + `SubmitButton` khoá khi `pending` | `roster:76`, `lib/use-form-action.ts` |

## 3. Existing UI Audit

### Layout

**Màn A — chọn buổi** (`page.tsx:48-95`): `PageHeader` + một `Card` chứa `<ul className="divide-y">`. Mỗi `<li>` là một `<Link>` phủ cả hàng, `p-4`, `flex-wrap justify-between`. Card không có `CardHeader` nên không có vấn đề lệch mép trái như `UX-M13-003`.

**Màn B — roster** (`page.tsx:106-153`): link "Về Hôm nay" → `PageHeader` (có `action` là nút "Nhật ký buổi") → một `Card` hiển thị ngày/giờ buổi → `AttendanceRoster`. Roster là `<form>` gồm: thanh "Đánh dấu nhanh", `<ul className="divide-y rounded-lg border">` mỗi `<li>` là một học viên (tên + mã + 4 nút trạng thái + 1 ô ghi chú), và **thanh Lưu `fixed` ở đáy màn hình**.

Không có grid nhiều cột ở cả hai màn — đúng, vì đây là danh sách thao tác tuần tự.

### Navigation

- Vào màn B bằng query param `?session=<id>`, không phải route con — bookmark và back đều hoạt động, không cần đổi (`DS-012` cấm đụng navigation).
- Có **hai** đường quay lại ở màn B: link "Về Hôm nay" (`:108`) và nút "Nhật ký buổi" trong `PageHeader` (`:120`). Không mâu thuẫn: một cái lùi, một cái sang ngang.
- Màn A không có đường quay lại riêng — dùng sidebar. Chấp nhận được vì đây là mục cấp một trong `NAVIGATION`.

### Table

Không có `<Table>`. Roster là `<ul>/<li>` — **đúng lựa chọn**: mỗi hàng có 4 nút bấm + 1 ô nhập, nhét vào ô bảng sẽ chật và hỏng trên điện thoại. **Không đổi sang bảng.**

### Form

Một form duy nhất, gửi bằng Server Action:

- Trạng thái mỗi học viên đi kèm bằng **hidden input**, chỉ render khi đã chọn (`roster:126-132`) — học viên chưa chọn thì không gửi field, server bỏ qua, **không** âm thầm đánh vắng. Thiết kế đúng, giữ nguyên.
- Ô ghi chú: `Input` với **placeholder làm nhãn duy nhất**, không `label`, không `aria-label` (`:176-181`). 20 học viên = 20 ô nhập giống hệt nhau với trình đọc màn hình.
- Nút Lưu khoá khi `markedCount === 0` (`:199`) và khi `pending` (`SubmitButton`).

### Modal

N/A — không có dialog nào. "Đánh dấu nhanh" ghi đè trực tiếp, không hỏi lại.

### States

| State | Hiện trạng |
|---|---|
| **Loading** | Cấp shell (`(dashboard)/loading.tsx`) + `SubmitButton` có spinner khi `pending`. Đủ. |
| **Empty** | ✅ 2/2 — màn A "Không còn buổi nào cần điểm danh" (`:58`); màn B "Lớp chưa có học viên nào đang học" (`:142`). Cả hai dùng `EmptyState` có icon + tiêu đề + mô tả. |
| **Error** | Lỗi submit: `Alert variant="destructive"` có icon + chữ ở đầu form (`:89-94`) ✅. Lỗi query: **nay đã có** `(dashboard)/error.tsx` sau `M00-S10` ✅ (trước phiên này thì không). Buổi không được phép đọc → `notFound()` ✅. |
| **Disabled** | Nút Lưu disabled khi chưa chọn ai; có chữ giải thích ngay cạnh ("còn N người chưa điểm danh") ✅. |
| **Success** | `toast.success("Đã lưu điểm danh cho N học viên.")` qua `useFormAction` ✅. |

### Accessibility

- **Heading:** mỗi màn có đúng một `<h1>` từ `PageHeader`. Roster không có heading khu vực, nhưng thêm chữ mới = thêm nội dung → không làm.
- **Nhóm nút trạng thái:** có `role="group"` + `aria-label="Điểm danh <tên học viên>"` (`:145-146`) và `aria-pressed` trên từng nút ✅ — đây là phần làm tốt nhất của module.
- **Ô ghi chú:** ❌ không có nhãn nào ngoài placeholder.
- **Màu không phải tín hiệu duy nhất:** ✅ mỗi nút trạng thái đều có icon + chữ.
- **Contrast** (đo lại bằng công thức WCAG 2.1, nền là màu nút khi active, chữ trắng): `success #166534` **6.56:1** ✅ · `warning #92400e` **7.09:1** ✅ · `destructive #DC2626` **4.83:1** ✅ · `primary #1A5FA8` **6.47:1** ✅. Không có cặp nào fail.
- **Focus:** nút dùng `Button` nên có `ring-[3px]` ✅. **Link hàng ở màn A** (`:69`) và **link "Về Hôm nay"** (`:110`) không có focus style riêng ❌.
- **Touch target:** nút trạng thái 44px ✅ nhưng **khoảng cách giữa chúng chỉ `gap-1` = 4px** ❌ (yêu cầu ≥8px).

### Responsive

- Mobile 360–430px: hàng roster `flex-wrap` — khối tên xuống một dòng, 4 nút trạng thái xếp 2×2 (mỗi nút `min-w-[5.5rem]` = 88px; 2×88 + gap vừa đủ trong 328px khả dụng). Không scroll ngang.
- Tablet 768–1024px: 4 nút nằm một hàng.
- Desktop 1280px+: thanh Lưu bù trừ sidebar bằng `md:left-64` chép cứng.
- **Vấn đề riêng của tầng nào cũng gặp:** thanh Lưu `fixed bottom-0` nằm đè lên `SiteFooter` khi cuộn tới đáy.

## 4. Problems with Evidence

| Issue ID | Screen/Component | Problem | Evidence | Severity | Proposed fix |
|---|---|---|---|---|---|
| `UX-M15-001` | A — hàng chọn buổi | **`<button>` lồng trong `<a>`.** `Button` render ra `<button>` thật, đặt bên trong `<Link>` phủ cả hàng. HTML cấm interactive content bên trong `<a>`; hệ quả thực tế: mỗi hàng có **hai điểm dừng Tab** trỏ về cùng một đích, trình đọc màn hình đọc "link … button" cho một hành động duy nhất | `page.tsx:67-87` — `<Link className="...">` bọc `<Button size="sm" variant="outline">Điểm danh</Button>` | **High** | Đổi nút thành `<span className={buttonVariants({ variant: "outline", size: "sm" })}>` — **giống hệt về thị giác**, giữ nguyên chữ "Điểm danh", nhưng chỉ còn một điểm dừng Tab và HTML hợp lệ |
| `UX-M15-002` | A — hàng chọn buổi | **Link phủ cả hàng không có focus nhìn thấy được**; hover dùng alpha ngẫu hứng `bg-muted/40` thay vì token | `page.tsx:69` — `className="hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 p-4"` | **High** | `hover:bg-primary-50` + `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none`; thêm `overflow-hidden` cho `Card`. Đúng cách đã áp ở `M00-S02` và `M13-S03` |
| `UX-M15-003` | A — hàng chọn buổi | **Mã lớp và toàn bộ dòng meta ở `text-xs` (12px)**: ngày, giờ bắt đầu–kết thúc, tiến độ "đã điểm danh x/y" — đều là thứ giáo viên đọc để chọn đúng buổi | `page.tsx:73` (`font-mono text-xs`), `:78` (`text-muted-foreground text-xs`) | **Medium** | `text-sm` + `text-text-secondary` (7.81:1). Thuộc `UX-M00-004` |
| `UX-M15-004` | B — nút trạng thái | **`h-11` chép cứng trong class**, đúng thứ `DS-013` vừa gỡ bỏ khỏi toàn repo. Trên chuột nút giữ nguyên 44px nên không hưởng thang mật độ mới; và nếu sau này thang đổi thì 4 nút này không đổi theo | `attendance-roster.tsx:158` — `className={\`h-11 min-w-[5.5rem] ...\`}` | **High** | Bỏ `h-11`, giữ `min-w-[5.5rem]`. Size mặc định = 40px trên chuột, `globals.css` vẫn ép **44px trên cảm ứng** — không mất một pixel touch target nào ở đúng thiết bị mà module này phục vụ |
| `UX-M15-005` | B — nút trạng thái | **Khoảng cách giữa 4 nút chỉ 4px** (`gap-1`), dưới mức tối thiểu 8px. Đây là bề mặt dễ bấm nhầm nhất trong toàn ứng dụng: 4 nút cạnh nhau, bấm bằng ngón cái, đang vừa dạy vừa bấm, và bấm nhầm thì học viên bị ghi sai trạng thái | `attendance-roster.tsx:144` — `className="flex flex-wrap gap-1"` | **Medium** | `gap-1` → `gap-2` (8px) |
| `UX-M15-006` | B — ô ghi chú | **Ô nhập không có nhãn**, chỉ có placeholder. Với trình đọc màn hình, 20 học viên cho ra 20 ô nhập giống hệt nhau tên "Ghi chú (không bắt buộc)" — không biết ô nào của ai | `attendance-roster.tsx:176-181` — `<Input name={...} placeholder="Ghi chú (không bắt buộc)" />`, không `label`, không `aria-label` | **High** | Thêm `aria-label={\`Ghi chú cho \${r.studentName}\`}`. **Không đổi gì trên màn hình**, không thêm chữ hiển thị, không đổi `name` nên form data giữ nguyên |
| `UX-M15-007` | B — thanh Lưu | **Thanh `fixed bottom-0` đè lên footer bản quyền.** `D-17` bắt buộc footer có mặt ở **mọi** trang; ở trang này cuộn tới đáy vẫn không đọc được nó vì thanh Lưu luôn nằm đè. Kèm theo: `md:left-64` chép cứng chiều rộng sidebar từ `sidebar-nav.tsx:16` — hai file phải sửa cùng nhau mà không có gì ràng buộc | `attendance-roster.tsx:188` — `className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur md:left-64"`; footer tại `(dashboard)/layout.tsx:83` | **Medium** | `fixed` → `sticky bottom-0`, full-bleed bằng `-mx-4 md:-mx-6`. Thanh vẫn dính đáy khi đang cuộn trong danh sách, nhưng nhả ra khi tới cuối form → footer hiện đủ. Bỏ luôn `md:left-64` và `pb-24` |
| `UX-M15-008` | B — thanh Lưu | `bg-background/95` + `backdrop-blur` là hiệu ứng kính — governance §3 cấm glassmorphism trang trí. Ở đây blur **không mang chức năng** (không phải scrim của modal, không báo hiệu nền bị vô hiệu hoá); nó chỉ làm chữ dưới thanh nhòe nhòe | `attendance-roster.tsx:188` | **Low** | Nền đặc `bg-card` + `border-t`. Đọc rõ hơn và rẻ hơn về hiệu năng |
| `UX-M15-009` | B — hàng học viên | **Mã học viên và trạng thái "· chưa điểm danh" ở `text-xs`**. "Chưa điểm danh" là **trạng thái của hàng** mà lại là chữ nhỏ nhất, mờ nhất trên hàng đó | `attendance-roster.tsx:137-140` — `<p className="text-muted-foreground text-xs">` | **Medium** | `text-sm` + `text-text-secondary` |
| `UX-M15-010` | B — card ngày/giờ | `CardTitle` bị dùng cho **một dòng metadata**, không phải tiêu đề. Nó render `<div data-slot="card-title">` với `font-semibold` rồi bị ghi đè bằng `text-sm font-medium` — tức là dùng sai slot rồi hoá giải bằng class | `page.tsx:129-137` | **Low** | `CardHeader`+`CardTitle` → `CardContent` + `<p className="flex items-center gap-2 text-sm text-text-secondary">`. Cao card đổi 12px, không đổi bố cục |
| `UX-M15-011` | B — link "Về Hôm nay" | Link quay lại không có focus style riêng, chỉ có `hover:text-foreground` | `page.tsx:108-114` | **Low** | Thêm `rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` |
| `UX-M15-012` | B — Đánh dấu nhanh | **"Tất cả có mặt" ghi đè sạch mọi lựa chọn đã bấm, không hoàn tác được.** Giáo viên điểm danh tay 18/20 người rồi lỡ chạm nút này là mất hết, không có `Ctrl+Z`, không có toast "Hoàn tác" | `attendance-roster.tsx:81-83` — `setAll` thay toàn bộ `marks` | **Medium** | **Chỉ ghi nhận.** Thêm undo/confirm là **thêm hành vi mới**, vượt phạm vi UI/UX của module. Cần user quyết |
| `UX-M15-013` | B — ô ghi chú | Server giới hạn ghi chú **300 ký tự** (`recordSchema`), nhưng ô nhập không có `maxLength`. Gõ 301 ký tự → submit thất bại với thông báo chung "Dữ liệu điểm danh không hợp lệ.", **không chỉ ra ô nào của học viên nào** | `features/attendance/server/actions.ts:18` vs `attendance-roster.tsx:176-181` | **Low** | **Chỉ ghi nhận.** Thêm `maxLength` là chạm vào tầng validation — bị cấm trong task UI/UX. Cần user quyết |
| `UX-M15-014` | B — ghi chú (**Business**) | **Ghi chú bị bỏ im lặng nếu học viên chưa được chọn trạng thái.** Vòng lặp chỉ đọc field bắt đầu bằng `status_`; ai không có status thì `note_<id>` không bao giờ được đọc tới. Giáo viên gõ "xin nghỉ, mẹ báo ốm" rồi bấm Lưu mà quên chọn trạng thái → ghi chú biến mất, không cảnh báo | `features/attendance/server/actions.ts:48-64` | **Medium** | **Chỉ ghi nhận, không sửa** — governance §1: không tự sửa vấn đề nghiệp vụ trong task UI/UX |

## 5. Proposal Before Code

### Overall style

Giữ nguyên ngôn ngữ hiện tại — card trắng trên `--surface-page`, danh sách `divide-y`, không thêm hiệu ứng. **Bố cục không đổi một chỗ nào**: vẫn 4 nút trạng thái nằm ngang (không đổi sang dropdown, không đổi sang segmented control), vẫn một ô ghi chú mỗi hàng, vẫn thanh Lưu ở đáy.

Thay đổi chỉ nằm ở ba nhóm:

1. **Chống bấm nhầm** — giãn khoảng cách nút trạng thái (`UX-M15-005`).
2. **Khả năng tiếp cận** — nhãn cho ô ghi chú, focus cho link, gỡ `<button>` lồng trong `<a>` (`-001`, `-002`, `-006`, `-011`).
3. **Tuân thủ hệ thống đã chốt** — bỏ `h-11` chép cứng theo `DS-013`, bỏ blur trang trí theo governance §3, trả footer về đúng `D-17` (`-004`, `-007`, `-008`).

**Cái đang làm tốt và cố ý giữ nguyên** — ghi ra đây để phiên sau không "cải tiến" nhầm:

- Bốn nút thay vì dropdown: một thao tác thay vì hai. Đúng cho người đang đứng dạy.
- Hidden input chỉ render khi đã chọn: người chưa chọn **không** bị âm thầm đánh vắng.
- Bấm lại nút đang chọn = bỏ chọn: sửa nhầm không cần thao tác thứ hai.
- `role="group"` + `aria-label` theo tên học viên trên từng nhóm nút.

### Current primary color and continued usage

`#1A5FA8` giữ nguyên (`DS-001`). Bốn màu trạng thái giữ nguyên hoàn toàn — đã đo lại, không cặp nào fail AA:

| Trạng thái | Nền | Contrast với chữ trắng |
|---|---|---|
| Có mặt | `--success` `#166534` | **6.56:1** ✅ |
| Muộn | `--warning` `#92400e` | **7.09:1** ✅ |
| Vắng | `--destructive` `#DC2626` | **4.83:1** ✅ |
| Có phép | `--primary` `#1A5FA8` | **6.47:1** ✅ |

Không thêm màu mới trong module này.

### Extended palette

Chỉ token đã có:

| Token | Dùng ở đâu trong M15 |
|---|---|
| `text-text-secondary` `#43536B` (7.81:1) | Dòng ngày/giờ/tiến độ màn A; mã học viên + "chưa điểm danh" màn B; dòng ngày/giờ của card buổi |
| `bg-primary-50` `#F5F9FD` | Nền hover hàng chọn buổi, thay `bg-muted/40` |
| `ring-ring` `#1A5FA8` | Focus ring hàng chọn buổi và link "Về Hôm nay" |
| `bg-card` `#FFFFFF` | Nền đặc cho thanh Lưu, thay `bg-background/95` + blur |
| `--input` `#7C8DA4` | Viền ô ghi chú — **tự động có** sau `M00-S09`, không phải thêm class |

### Typography

| Vai trò | Hiện tại | Sau |
|---|---|---|
| Mã lớp (màn A) | `text-xs` mono | `text-sm` mono |
| Ngày · giờ · tiến độ (màn A) | `text-xs` muted | `text-sm` `text-secondary` |
| Tên học viên | `font-medium` 16px | giữ nguyên |
| Mã HV + "chưa điểm danh" | `text-xs` muted | `text-sm` `text-secondary` |
| Ngày/giờ card buổi | `text-sm` trong `CardTitle` | `text-sm` `text-secondary` trong `<p>` |
| Chữ trên nút trạng thái | `text-sm` (từ `button.tsx`) | giữ nguyên |

Sau khi sửa, **không còn `text-xs` nào** trong hai file của module — kiểm bằng `grep`. Không thêm cấp chữ mới.

### Spacing

Giữ thang 4px. Hai thay đổi:

- `gap-1` → `gap-2` giữa các nút trạng thái (4px → 8px). Đây là thay đổi **có mục đích an toàn**, không phải thẩm mỹ.
- Bỏ `pb-24` của form (chỉ tồn tại để chừa chỗ cho thanh `fixed`; thanh `sticky` không cần).

`p-4` của hàng danh sách giữ nguyên — card màn A không có `CardHeader` nên không có mép trái nào để canh, khác `UX-M13-003`.

### Radius and shadow

Không đổi. Thêm `overflow-hidden` cho `Card` màn A (hàng cuối có nền hover chạm mép). Thanh Lưu bỏ `backdrop-blur`, giữ `border-t`, **không thêm shadow** — đường kẻ đã đủ tách lớp.

`min-w-[5.5rem]` → `min-w-22` (Tailwind v4 có sẵn bước 22 = 5.5rem): cùng kích thước, bỏ được arbitrary value.

### Button/action hierarchy

Theo `02` §8, giữ đúng cấp hiện tại:

| Cấp | Nút | Variant | Size |
|---|---|---|---|
| Primary | "Lưu điểm danh" | `default` (từ `SubmitButton`) | `lg` — thay `className="h-11 px-6"`. Cùng kích thước, nhưng đi qua thang thay vì chép cứng |
| Secondary | 4 nút trạng thái, "Tất cả có mặt/vắng", "Nhật ký buổi" | `outline` — giữ | `default` cho nút trạng thái (bỏ `h-11`); `sm` cho nút đánh dấu nhanh — giữ |
| Affordance | "Điểm danh" trong hàng màn A | `buttonVariants` trên `<span>` — **không còn là nút thật** | `sm` |

Không thêm variant mới (`DS-007`).

**Vì sao bỏ `h-11` không làm giảm touch target:** `globals.css` ép `min-height: 44px` cho `button` trong `@media (pointer: coarse)`, và `min-height` thắng `height`. Điện thoại — thiết bị mà module này phục vụ — vẫn đúng 44px. Chỉ desktop dùng chuột mới xuống 40px, đúng chủ đích `DS-013`.

### Table

N/A — giữ `<ul>/<li>`. Không đổi sang bảng: mỗi hàng có 4 nút + 1 ô nhập, nhét vào ô bảng sẽ hỏng trên điện thoại.

### Form

- Không đổi `name` của bất kỳ field nào → FormData gửi lên **giống hệt** → `saveAttendanceAction` không cần biết gì.
- Không thêm/bớt/đổi validation. `maxLength` cho ô ghi chú **không làm** (`UX-M15-013`, chờ user quyết).
- Chỉ thêm `aria-label` cho ô ghi chú — thuộc tính trợ năng, không phải dữ liệu form.

### Modal

N/A. Không thêm dialog xác nhận cho "Đánh dấu nhanh" (`UX-M15-012`) — là thêm hành vi, chờ user quyết.

### Navigation

Không đổi route, không đổi query param, không đổi đích của link nào. Chỉ thêm focus state.

### Responsive behavior

Không đổi breakpoint, không đổi cách wrap. Ba điểm phải đo lại sau khi sửa:

- **360px:** `gap-1` → `gap-2` làm hàng 2 nút rộng thêm 4px (2×88 + 8 = 184px, thừa sức trong 328px khả dụng) — vẫn 2×2, **không** đẩy thành 4 hàng.
- **Thanh Lưu `sticky`:** phải dính đáy khi đang cuộn giữa danh sách, và **nhả ra để lộ footer** khi cuộn tới cuối. Kiểm ở cả 3 tầng. Kiểm luôn không có tổ tiên nào `overflow: hidden` (`form` → `main` → `div.flex-col` → `div.flex.min-h-screen`: không có).
- **Desktop:** bỏ `md:left-64` thì thanh phải nằm gọn trong vùng main, không tràn sang sidebar.

### Loading/empty/error/disabled/success

| State | Xử lý |
|---|---|
| Loading | Giữ nguyên: overlay cấp shell + spinner trong `SubmitButton` |
| Empty | Giữ nguyên 2/2 `EmptyState` |
| Error | Submit lỗi: `Alert` giữ nguyên. Query lỗi: **nay đã có** `(dashboard)/error.tsx` (`M00-S10`) — lần đầu tiên một module không phải ghi "Error: chưa xử lý" |
| Disabled | Giữ nguyên nút Lưu khoá khi chưa chọn ai; chữ giải thích đã có sẵn cạnh nút |
| Success | Giữ nguyên `toast.success` |

## 6. Screen Plan

| Subtask ID | Screen/Component group | Source files | Risk | Status |
|---|---|---|---|---|
| `M15-S01` | **Màn A — chọn buổi** (`-001`, `-002`, `-003`) + card ngày/giờ và link quay lại của màn B (`-010`, `-011`) | `src/app/(dashboard)/teacher/attendance/page.tsx` | Thấp — server component, không có state | ✅ DONE |
| `M15-S02` | **Màn B — hàng học viên**: nút trạng thái và ô ghi chú (`-004`, `-005`, `-006`, `-009`) | `src/features/attendance/components/attendance-roster.tsx` | Trung bình — đụng bề mặt thao tác chính, phải đo lại wrap ở 360px | ✅ DONE |
| `M15-S03` | **Màn B — thanh Lưu**: `fixed` → `sticky`, bỏ blur (`-007`, `-008`) | `src/features/attendance/components/attendance-roster.tsx` | Trung bình — đổi cơ chế định vị, phải kiểm footer hiện đủ ở cả 3 tầng | ✅ DONE |

| `M15-S04` | **Màn B — hộp xác nhận "Đánh dấu nhanh"** (`-012`) | `src/features/attendance/components/attendance-roster.tsx` | Trung bình — thêm hành vi mới, phải bọc provider trong test | ✅ DONE |

> `M15-S04` **phát sinh sau §6 gốc**, khi user duyệt `DS-020` trong phiên 2026-07-21.

Không subtask nào đụng `src/components/`. **Ngoại lệ có duyệt:** `features/attendance/server/actions.ts` bị sửa cho `UX-M15-014` theo `DS-022` — nằm ngoài §1 Out of scope ban đầu.

## 7. Implementation Log

### `M15-S01` — Màn A chọn buổi + card ngày/giờ + link quay lại · ✅ DONE (2026-07-21)

**File:** `src/app/(dashboard)/teacher/attendance/page.tsx` (duy nhất)

| Issue | Thay đổi thật | Dòng |
|---|---|---|
| `UX-M15-001` | `<Button size="sm" variant="outline">` → `<span className={buttonVariants({ variant: "outline", size: "sm" })}>`. Import đổi `Button` → `Button, buttonVariants` (`Button` vẫn dùng cho "Nhật ký buổi" `:139`). Kèm comment giải thích vì sao không phải nút thật, để phiên sau không "sửa ngược" | `:84-92` |
| `UX-M15-002` | `hover:bg-muted/40` → `hover:bg-primary-50` + `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none`; `Card` thêm `overflow-hidden` | `:55`, `:69` |
| `UX-M15-003` | `font-mono text-xs` → `font-mono text-sm`; `text-muted-foreground text-xs` → `text-text-secondary text-sm` | `:73`, `:78` |
| `UX-M15-010` | `CardHeader`+`CardTitle` → `CardContent className="py-4"` + `<p className="text-text-secondary flex items-center gap-2 text-sm">`. Gỡ import `CardHeader`, `CardTitle` | `:141-148` |
| `UX-M15-011` | Link "Về Hôm nay" thêm `rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none` | `:110` |

**Không đổi:** route, query param, đích link, nhãn chữ, thứ tự thông tin, business logic. `getAttendanceSheet`/`notFound()` nguyên vẹn.

**Kiểm chứng:** `grep -n "text-xs\|CardHeader\|CardTitle" page.tsx` → chỉ còn 1 dòng, là **comment** giải thích, không phải code. Đạt mục tiêu "không còn `text-xs`".

**Responsive:** không đổi breakpoint hay cách wrap. `text-xs`→`text-sm` làm dòng meta cao thêm ~4px và dài thêm ~8%; hàng vốn đã `flex-wrap` nên ở 360px dòng meta xuống dòng như cũ, không sinh scroll ngang. `overflow-hidden` cắt nền hover ở hàng cuối theo bo góc card.

**Kiểm tra:** `npm run lint` ✅ PASS · `npm run typecheck` ✅ PASS (không output lỗi).

### `M15-S02` — Hàng học viên: nút trạng thái + ô ghi chú · ✅ DONE (2026-07-21)

**File:** `src/features/attendance/components/attendance-roster.tsx`

| Issue | Thay đổi thật | Dòng |
|---|---|---|
| `UX-M15-004` | `className={\`h-11 min-w-[5.5rem] …\`}` → `className={\`min-w-22 …\`}`. `min-w-22` = 22 × 0.25rem = 5.5rem, **cùng kích thước**, bỏ được arbitrary value. Comment cũ ("≥ 44px chiều cao") thay bằng comment giải thích luật 44px nay nằm ở `globals.css` | `:174-178` |
| `UX-M15-005` | `flex flex-wrap gap-1` → `gap-2` (4px → 8px) | `:159` |
| `UX-M15-006` | Thêm `aria-label={\`Ghi chú cho \${r.studentName}\`}`. `name` **không đổi** → FormData gửi lên giống hệt | `:196` |
| `UX-M15-009` | `text-muted-foreground text-xs` → `text-text-secondary text-sm` | `:152` |
| `UX-M15-013` | Thêm `maxLength={300}` theo `DS-021` | `:197` |

**Responsive — đo lại ở 360px:** nút giữ `min-w-22` = 88px. Hàng 2 nút = 2×88 + gap 8 = **184px**, khả dụng ≈ 328px (360 − 2×16 padding) → vẫn xếp **2×2**, không bị đẩy thành 4 hàng. Bỏ `h-11` không giảm touch target trên điện thoại: `globals.css` `@media (pointer: coarse)` ép `min-height: 44px` và `min-height` thắng `height`; chỉ desktop dùng chuột xuống 40px, đúng chủ đích `DS-013`.

**Kiểm tra:** lint ✅ · typecheck ✅ · test roster ✅.

### `M15-S03` — Thanh Lưu `fixed` → `sticky` · ✅ DONE (2026-07-21)

**File:** `src/features/attendance/components/attendance-roster.tsx`

| Issue | Thay đổi thật | Dòng |
|---|---|---|
| `UX-M15-007` | `fixed inset-x-0 bottom-0 z-20 … md:left-64` → `sticky inset-x-0 bottom-0 z-20 -mx-4 md:-mx-6`. Bỏ `md:left-64` (chép cứng chiều rộng sidebar từ `sidebar-nav.tsx`). Bỏ `pb-24` của `<form>` — chỉ tồn tại để chừa chỗ cho thanh `fixed` | `:86`, `:215` |
| `UX-M15-008` | `bg-background/95 … backdrop-blur` → `bg-card` đặc, giữ `border-t`, không thêm shadow | `:215` |
| — | `SubmitButton className="h-11 px-6"` → `size="lg"`. `lg` = `h-11 px-6` trong `button.tsx:36` — **cùng pixel**, nhưng đi qua thang thay vì chép cứng | `:226` |

**Full-bleed khớp đúng padding:** `main` ở `(dashboard)/layout.tsx:76` là `p-4 md:p-6`, nên `-mx-4 md:-mx-6` cho thanh chạm sát hai mép vùng main.

**Kiểm tra tổ tiên `overflow`:** `form` → `main` → `div.flex-col` → `div.flex.min-h-screen` — **không** cái nào có `overflow: hidden`, nên `sticky` hoạt động (đây là nguyên nhân số một khiến `sticky` chết im lặng).

**Responsive:** thanh dính đáy suốt lúc cuộn giữa danh sách; cuộn tới cuối form thì nhả ra, `SiteFooter` hiện đủ → trả lại đúng `D-17`. Desktop: thanh nằm gọn trong vùng main, không tràn sang sidebar (đã bỏ `md:left-64`).

### `M15-S04` — Hộp xác nhận cho "Đánh dấu nhanh" · ✅ DONE (2026-07-21)

> **Subtask phát sinh** sau khi user duyệt `DS-020` trong phiên này. §6 ban đầu chỉ có 3 subtask.

**File:** `src/features/attendance/components/attendance-roster.tsx` + `tests/unit/components/attendance-roster.test.tsx`

| Issue | Thay đổi thật |
|---|---|
| `UX-M15-012` | `setAll` thành `async`, gọi `useConfirmation()`. Chỉ hỏi khi `overwritten > 0` — tức có học viên đang mang trạng thái **khác** đích đến. Hộp: "Ghi đè trạng thái đã chọn?" / "Ghi đè" / "Giữ nguyên", nêu đúng số người bị ảnh hưởng. `onClick={() => void setAll(…)}` |

**Không thêm component mới** — dùng lại `ConfirmationProvider` đã bọc sẵn ở `(dashboard)/layout.tsx:34`, cùng `AlertDialog` mà `grading-workspace.tsx` đang dùng. Không thêm dependency.

**Vì sao không hỏi mọi lần:** nút này sinh ra để **bớt** thao tác. Bấm trên danh sách trắng (trường hợp phổ biến nhất), hoặc bấm lại đúng nút vừa bấm, đều đi thẳng không hỏi.

**Test phải sửa — và vì sao không phải là nới lỏng:** `attendance-roster.test.tsx` trước đây render component trần, nay `useConfirmation()` yêu cầu provider nên phải bọc `<ConfirmationProvider>`. Đây là **làm test giống thật hơn** (layout thật vẫn luôn bọc provider), không assertion nào bị đổi hay bỏ. Thêm 4 test mới: không hỏi khi danh sách trắng · "Giữ nguyên" thì không mất gì và **không âm thầm đánh dấu người khác** · "Ghi đè" thì mới thật sự ghi đè · mỗi ô ghi chú mang tên học viên của nó + `maxlength=300`.

### `UX-M15-014` — sửa bug nghiệp vụ (ngoài phạm vi UI/UX, user duyệt `DS-022`) · ✅ DONE

**File:** `src/features/attendance/server/actions.ts` + `tests/unit/server/attendance-actions.test.ts` (**file mới**)

Ghi chú sống chung bản ghi với trạng thái nên **không lưu riêng được**; thứ sửa được là *đừng im lặng*. `saveAttendanceAction` nay quét các field `note_*` có nội dung mà thiếu `status_*` tương ứng, và **chặn cả lượt lưu** với thông báo nêu số học viên + hai cách xử lý (chọn trạng thái, hoặc xóa ghi chú).

Chặn cả lượt chứ không lưu phần hợp lệ: form **không** reload khi action trả lỗi, nên chữ vừa gõ còn nguyên trong ô — lưu một nửa mới đúng là chỗ mất dữ liệu.

**Không đổi:** `recordSchema`, RPC `bulk_mark_attendance`, bảng, RLS, `revalidatePath`. Ô ghi chú rỗng/toàn khoảng trắng **không** tính là bỏ quên (có test riêng, vì mọi hàng đều render một ô `note_*`).

⚠️ **Claude vừa là người sửa vừa không được tự tuyên bố Verified** (CLAUDE.md). Trạng thái: `Fixed — chờ xác minh độc lập bởi Codex`.

## 8. Final Module Verification

Chạy đầy đủ sau khi đóng `M15-S04`, ngày 2026-07-21:

| Check | Command | Result | Bằng chứng |
|---|---|---|---|
| Lint | `npm run lint` | ✅ **PASS** | Không output lỗi |
| Type-check | `npm run typecheck` | ✅ **PASS** | Không output lỗi |
| Test | `npm test -- --maxWorkers=4` | ✅ **170/170 PASS** | 52 file, 100.5s. Trước phiên là 162 → **+8 test mới**, không sửa/nới/skip test cũ nào |
| Build | `npm run build` | ✅ **PASS** | `✓ Compiled successfully in 16.1s` |

**Completion gate:**

- [x] Cả 2 màn hình trong phạm vi đã xong (A chọn buổi · B roster).
- [x] Báo cáo module cập nhật (file này).
- [x] Responsive ghi ở từng subtask, đủ 3 tầng 360–430 / 768–1024 / 1280+.
- [x] Loading/empty/error/disabled/success: giữ nguyên phần đã tốt, error query nay có `(dashboard)/error.tsx`.
- [x] Keyboard focus: hàng chọn buổi và link "Về Hôm nay" nay có focus ring; nút "Điểm danh" hết là điểm dừng Tab thừa.
- [x] Không đổi route/API/database/permission/nhãn hiển thị. **Có** chạm validation (`maxLength`, `DS-021`) và **có** chạm nghiệp vụ (`DS-022`) — cả hai do user duyệt rõ trong phiên, ghi đầy đủ ở `08`.
- [x] Không sửa file nào trong `src/components/` — `ConfirmationProvider` chỉ được **dùng lại**, không sửa.
- [x] Lint / Type-check / Test / Build pass.
- [x] Changelog + checkpoint cập nhật.

## 9. Remaining Issues

Không còn issue `OPEN` nào của M15 — 14/14 đã xử lý.

| Việc còn lại | Ai làm |
|---|---|
| Xác minh độc lập toàn bộ M15 (đặc biệt `UX-M15-014` vì Claude vừa fix vừa không được tự verify) | **Codex / user** |
| Kiểm mắt thường: thanh Lưu `sticky` nhả ra để lộ footer ở 360 / 768 / 1280 | **Codex / user** |

## 10. Final Status

`DONE` — chờ xác minh độc lập.

## 8. Final Module Verification

*(chưa chạy)*

## 9. Remaining Issues

*(chưa đóng module)*

## 10. Final Status


