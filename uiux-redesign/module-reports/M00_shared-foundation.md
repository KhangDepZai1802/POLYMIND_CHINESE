# [M00] Shared Foundation — UI/UX Audit & Improvement

## 1. Scope

| Field | Value |
|---|---|
| Module ID | **M00** |
| Module name | Shared Foundation — App shell, navigation, design token |
| Routes | Không sở hữu route riêng. Áp dụng cho **mọi** route trong `(dashboard)` |
| Roles/permissions | Cả 3 role (`super_admin`, `teacher`, `student`). **Không đụng vào phân quyền** |
| Screens | Sidebar desktop · Drawer mobile · Header sticky · User menu · Notification bell · Footer · Skip link · Nav progress · Token toàn cục |
| Out of scope | Business logic, database, API, route, permission, validation, nhãn |
| Out of scope riêng của module này | `src/components/ui/button.tsx` — khoá bởi `DS-010`, chờ user duyệt đề xuất riêng |

## 2. Existing Technology

Chép từ `02_UIUX_DESIGN_SYSTEM.md` §1 — không khảo sát lại.

| Item | Current usage | Source evidence |
|---|---|---|
| Framework | Next.js 16.2.10 App Router, React 19.2.4 | `package.json` |
| UI library | shadcn/ui `new-york`, base `slate`, CSS variables | `components.json` |
| CSS | Tailwind v4, token khai báo trong CSS (không có `tailwind.config.js`) | `src/app/globals.css` |
| Icons | lucide-react 0.545.0 | `components.json`; `navigation.ts` |
| Tokens/theme | `globals.css` → `:root` + `.dark` + `@theme inline` | — |
| Font | Be Vietnam Pro, weight 400/500/600/700 | `src/app/layout.tsx:5-10` |

## 3. Existing UI Audit

### Layout

- Shell: `flex min-h-screen` — sidebar `w-64` sticky trái + cột phải (header sticky `h-16` → main `flex-1 p-4 md:p-6` → footer). `src/app/(dashboard)/layout.tsx:35-88`.
- Nền shell dùng `bg-muted/30` — **alpha ngẫu hứng, không phải token có tên** (`UX-M00-009`).
- Header desktop có `<div className="hidden md:block" />` (dòng 61) làm spacer → **toàn bộ nửa trái header trên desktop là khoảng trống 64px**, không có tiêu đề trang, breadcrumb hay bất kỳ chỉ dấu vị trí nào. Ngữ cảnh trang chỉ nằm ở `PageHeader` trong vùng main.
- Skip link "Bỏ qua điều hướng" đã có và đúng chuẩn (`focus:translate-y-0`, `z-50`) — dòng 39-45.
- `data-dashboard-chrome` / `data-dashboard-main` dùng để ẩn chrome khi đang thi (`globals.css` đầu file). **Cơ chế nghiệp vụ — không được phá.**

### Navigation

- `NAVIGATION` trong `src/lib/permissions/navigation.ts`: 12 mục admin, 7 mục teacher, 8 mục student. **Chỉ đọc** (`DS-012`).
- Nav item: `min-h-11` (44px), `rounded-lg`, `gap-3`, icon `size-5`. Active = `bg-primary text-primary-foreground` + chấm `bg-brand-orange size-2`. Hover = `bg-brand-orange/15`.
- `aria-current="page"` đã có — `nav-links.tsx:36`.
- Sidebar có gạch nhấn cam dưới chữ POLYMIND (`sidebar-nav.tsx:23`); **drawer mobile không có** → nhận diện lệch giữa hai bề mặt.
- Drawer mobile `w-72`, chứa toàn bộ mục của role, tự đóng sau khi chọn (`onNavigate`). Trigger có `aria-label="Mở menu điều hướng"`.

### Table

Không thuộc phạm vi M00 (primitive `table.tsx` chỉ được đụng khi có module dùng bảng thực sự cần). Ghi nhận: `table.tsx` đã bọc sẵn `overflow-x-auto`, và viền bảng đang dùng `--border` 1.27:1 (`UX-M00-002`).

### Form

Không có form trong phạm vi M00, trừ `<form action={logoutAction}>` trong user menu.

### Modal

- Drawer mobile dùng `Sheet` (Radix) — focus trap và `Esc` do thư viện lo, không tự viết lại.
- `DropdownMenu` của user menu dùng Radix.

### States

- **Loading:** `NavProgress` (thanh tiến trình đầu trang) + `(dashboard)/loading.tsx`. `nav-progress.tsx:132` dùng gradient `from-primary via-info to-brand-orange` — gradient duy nhất trong repo (`UX-M00-008`).
- **Empty:** `empty-state.tsx` có sẵn, đúng chuẩn (icon + tiêu đề + mô tả + action).
- **Error:** `ui/alert.tsx` + toast `sonner`.
- **Disabled:** `button.tsx` dùng `disabled:opacity-50`. User menu có một `DropdownMenuItem disabled` vĩnh viễn cho non-student (dòng 80-84) — không giải thích vì sao bị khoá.
- **Success:** toast `sonner` với `richColors`.
- **Focus:** `focus-visible:ring-[3px] ring-ring/50` ở button. **Nhưng** nút Đăng xuất tự viết tay không có focus style (xem dưới).

### Accessibility

- **Contrast:** 11/13 cặp token đạt AA. Hai lỗi: `--info` 4.10:1, `--border` 1.27:1 (`UX-M00-001`, `UX-M00-002`).
- **Keyboard/focus:** `user-menu.tsx:88-96` — nút "Đăng xuất" là `<button>` tự viết trong `<form>`, **không phải `DropdownMenuItem`**. Hệ quả: không nhận roving tabindex/typeahead của Radix menu, không có `role="menuitem"`, và **không có `focus-visible` style** → người dùng bàn phím focus vào nó mà không thấy dấu hiệu gì. Chỉ có `hover:bg-accent`.
- **Labels:** `aria-label` đầy đủ ở nút hamburger, chuông thông báo, menu tài khoản. Chuông có label động theo số chưa đọc — làm tốt.
- **Touch target:** nav item 44px đạt. Trigger user menu dùng `h-auto px-2 py-1.5` **ghi đè** `h-11` của Button; chiều cao thực = avatar 32px + padding 12px = 44px, vừa đủ nhưng mong manh — đổi `size-8` của avatar là hỏng.
- Luật `@media (pointer: coarse)` trong `globals.css` áp `min-height: 44px` cho **mọi** `a[href]`, kể cả link chữ inline giữa đoạn văn (`UX-M00-007`).

### Responsive

- **Mobile (<768px):** sidebar ẩn (`hidden md:flex`), drawer hoạt động, header hiện logo + tên. Padding main `p-4`.
- **Tablet (≥768px):** sidebar hiện. Ở đúng 768px, sidebar 256px + nội dung 512px — chật nhưng chưa tràn.
- **Desktop (≥1280px):** bố cục ổn. Nửa trái header trống.
- Không phát hiện scroll ngang cấp trang ở tầng shell.

## 4. Problems with Evidence

Kế thừa 9 issue từ `07_UIUX_ISSUES_LOG.md` (`UX-M00-001` … `UX-M00-009`), bổ sung 3 issue mới phát hiện khi đọc sâu 4 file layout:

| Issue ID | Screen/Component | Problem | Evidence | Severity | Proposed fix |
|---|---|---|---|---|---|
| `UX-M00-010` | User menu | Nút "Đăng xuất" tự viết tay, không phải `DropdownMenuItem` → mất ngữ nghĩa `menuitem`, mất điều hướng phím mũi tên của Radix, và **không có focus style** | `user-menu.tsx:88-96` | **High** | Bọc `DropdownMenuItem asChild` quanh nút submit, giữ nguyên `<form action={logoutAction}>` và hành vi đăng xuất |
| `UX-M00-011` | Notification bell | Badge đếm dùng `text-[10px]` (giá trị tuỳ ý ngoài thang chữ) và `bg-destructive` — token **lỗi**, trong khi đây là badge đếm chứ không phải trạng thái lỗi | `notification-bell.tsx:25` | Medium | Đổi sang `--brand-red` (accent thương hiệu, cùng sắc đỏ, contrast 5.88:1) và dùng cỡ chữ trong thang. Không đổi vị trí, số hay `aria-label` |
| `UX-M00-012` | Drawer mobile | Thiếu gạch nhấn cam có ở sidebar desktop → nhận diện thương hiệu lệch giữa hai bề mặt của cùng một điều hướng | `sidebar-nav.tsx:23` có, `mobile-nav.tsx:41-51` không có | Low | Thêm đúng phần tử trang trí đó vào header drawer |

## 5. Proposal Before Code

### Overall style

Giữ nguyên ngôn ngữ hiện tại: **quản trị nội bộ, sáng, phẳng, mật độ trung bình-cao, phân tầng bằng surface + border thay vì shadow**. Không đưa gradient, glass hay neumorphism vào. Việc của M00 là **làm cho hệ token đủ chặt để các module sau không phải đoán**, chứ không phải đổi diện mạo.

### Current primary color and continued usage

`#1A5FA8` giữ nguyên tuyệt đối (`DS-001`). Tiếp tục dùng cho: nền nav item active, nút primary lúc nghỉ, focus ring, `chart-1`, badge `info`. Cam `#FB9518` tiếp tục là màu tương tác phụ (hover). Đỏ `#C8102E` tiếp tục là accent dùng tiết chế.

### Extended palette

Thêm thang `--primary-50` … `--primary-950` dẫn xuất từ hue `210.8°` (`DS-004`), với `--primary-600` khớp chính xác `#1A5FA8`. Thang này **bổ sung**, không thay thế `--primary` — mọi chỗ đang dùng `bg-primary` vẫn ra đúng màu cũ.

### Typography

Chưa đổi trong M00. Việc rà `text-xs` (`UX-M00-004`) làm theo từng module vì phải nhìn ngữ cảnh mới biết chỗ nào là meta thật.

### Spacing

Giữ thang 4px. Không đổi padding của shell (`p-4 md:p-6`) — đang đúng.

### Radius và shadow

Giữ thang hiện tại. Không truy quét `rounded-2xl`/`rounded-none` trong M00 vì chúng nằm trong màn hình của module khác (`UX-M00-005` xử lý dần).

### Button/action hierarchy

**Không đụng `button.tsx`** (`DS-010`). Phân cấp hành động vẫn theo `02` §8 với 6 variant sẵn có.

### Table

Ngoài phạm vi M00. Nhưng token `--border-strong` thêm ở đây chính là thứ các module bảng sẽ dùng.

### Form

Ngoài phạm vi M00.

### Modal

Không đổi. Giữ Radix.

### Navigation

Giữ nguyên cấu trúc, nhãn, route, thứ tự, active logic. Chỉ đồng bộ chi tiết trang trí giữa sidebar và drawer (`UX-M00-012`).

### Responsive behavior

Không đổi breakpoint. Kiểm lại 3 tầng sau mỗi subtask.

### Loading/empty/error/disabled/success

Giữ nguyên toàn bộ component. `nav-progress` gradient: **quyết định giữ** — nó là thanh tiến trình có chức năng biểu thị chuyển động, không phải trang trí bề mặt; đổi sang màu đặc sẽ làm mất cảm giác hướng. Đóng `UX-M00-008` là `WONTFIX` có lý do.

## 6. Screen Plan

| Subtask ID | Screen/Component group | Source files | Risk | Status |
|---|---|---|---|---|
| `M00-S01` | **Design token** — áp `DS-004`, `DS-005`, `DS-006` | `src/app/globals.css` | **Cực cao** — chạm mọi màn hình | ✅ DONE |
| `M00-S02` | Sidebar desktop + drawer mobile | `nav-links.tsx`, `mobile-nav.tsx`, `ui/sheet.tsx` | Trung bình | ✅ DONE |
| `M00-S03` | Header + user menu + notification bell | `user-menu.tsx`, `notification-bell.tsx` | Trung bình | ✅ DONE |
| `M00-S04` | Nền trang + footer + skip link + nav-progress | `(dashboard)/layout.tsx` | Thấp | ✅ DONE |
| `M00-S05` | Shared feedback component | `page-header.tsx` | Thấp | ✅ DONE |
| `M00-S06` | **Thang kích thước control** — áp `DS-013` | `ui/button.tsx`, `ui/input.tsx`, `ui/select.tsx`, `globals.css` | **Cực cao** | ✅ DONE |
| `M00-S07` | Thu hẹp luật 44px cho link — áp `DS-014` | `globals.css` | Thấp | ✅ DONE |
| `M00-S08` | **Xoá dark mode** — áp `DS-016` | `globals.css` + 10 file `ui/*` + `question-picker.tsx` + `ui/sonner.tsx` | Trung bình | ✅ DONE |
| `M00-S09` | **Viền control dùng thật `#7C8DA4`** — áp `DS-017` | `globals.css` | Trung bình — đổi viền của 6 component `ui/*` | ✅ DONE |
| `M00-S10` | **Error boundary** — áp `DS-018` | `(dashboard)/error.tsx`, `global-error.tsx` (file mới) | Thấp — chỉ chạy khi đang lỗi | ✅ DONE |

> S06–S08 mở sau khi user duyệt 4 quyết định treo ở phiên 2026-07-21 (đợt 2). `DS-010` (chặn `button.tsx`) được gỡ bằng `DS-013`; `DS-009` (đóng băng dark) bị thay bằng `DS-016`.
>
> S09–S10 mở ở **đợt 3** cùng phiên, sau khi audit M15 phát hiện `--border-strong` chưa từng được dùng và user duyệt `DS-017`, `DS-018`.

## 7. Implementation Log

### [M00-S01] Design token

**Status:** DONE — 2026-07-21

**Files changed:**

- `src/app/globals.css`

**Components changed:** Không component nào. Chỉ khai báo token.

**UI/UX problems resolved:**

- `UX-M00-001` — `--info` `#0284C7` → `#0369A1`. Contrast với chữ trắng **4.10:1 → 5.93:1**, đạt WCAG AA.
- `UX-M00-002` — thêm `--border-strong: #7C8DA4` (**3.39:1** trên nền trắng, đạt WCAG 1.4.11 cho thành phần giao diện). `--border` giữ nguyên `#DDE5EE` cho đường kẻ trang trí.
- `UX-M00-009` — thêm `--surface-page: #F6F8FB` và `--surface-sunken: #E4EAF2`, thay cho việc đoán `bg-muted/30`.
- `UX-M00-004` (một phần) — thêm `--text-secondary: #43536B` (7.81:1) và `--text-disabled: #8494A8` (3.10:1), tạo cấp chữ trung gian để module sau có chỗ hạ cấp mà không phải thu nhỏ chữ.
- `DS-004` — thêm thang `--primary-50` … `--primary-950`, `--primary-600` khớp chính xác `#1A5FA8`.

**Thay đổi có ảnh hưởng thị giác ngay:**

| Token | Cũ | Mới | Ảnh hưởng |
|---|---|---|---|
| `--info` | `#0284C7` | `#0369A1` | Chỉ `chart-2` và `nav-progress` đang dùng. Đậm hơn một chút |
| `--muted` | `#F1F5F9` | `#EDF1F7` | Nền phụ ngả nhẹ về hue thương hiệu. `--muted-foreground` trên nền mới = **4.80:1**, vẫn đạt AA |

Toàn bộ token còn lại là **thêm mới** — không có màn hình nào đổi hình dạng cho tới khi module sau chủ động dùng chúng.

**Behavior preserved:**

- [x] Business logic unchanged — không có logic trong file CSS
- [x] Database/migration unchanged
- [x] API contract unchanged
- [x] Route unchanged
- [x] Permission unchanged
- [x] Validation unchanged
- [x] Labels/content unchanged
- [x] Khối `.dark` **không bị đụng tới** (`DS-009`)
- [x] Quy tắc `data-exam-active` ẩn chrome khi thi **giữ nguyên**
- [x] Keyframe flashcard và `.font-hanzi` **giữ nguyên**

**Responsive result:**

- Mobile / Tablet / Desktop: token không có breakpoint nên không đổi bố cục ở bất kỳ tầng nào. Không phát sinh scroll ngang.

**States checked:** Không áp dụng ở tầng token — sẽ kiểm ở S02–S05 khi component thực sự dùng token mới.

**Verification:**

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ Pass, không cảnh báo |
| Type-check | `npm run typecheck` | ✅ Pass |
| Test | `npm test` | ✅ **162/162 pass** |
| Build | `npm run build` | ✅ Pass — 51 route biên dịch thành công |

**Hệ quả đã biết cần ghi lại:** các token mới (`--surface-page`, `--surface-sunken`, `--border-strong`, `--text-secondary`, `--text-disabled`, thang `--primary-*`) **chỉ khai báo trong `:root`**, không có bản dark tương ứng, vì `DS-009` cấm đụng khối `.dark`. Nếu sau này có người bật dark mode lên, các token này sẽ rơi xuống giá trị light (nền trang sẽ trắng trong theme tối). Ai gỡ đóng băng dark mode phải xử lý việc này trước.

### [M00-S02] Sidebar desktop + drawer mobile

**Status:** DONE — 2026-07-21

**Files changed:** `src/components/layout/nav-links.tsx` · `src/components/layout/mobile-nav.tsx` · `src/components/ui/sheet.tsx`

**UI/UX problems resolved:**

- **Nav item không có focus style riêng.** Trước đây chỉ dựa vào outline mặc định của trình duyệt (`globals.css` chỉ đặt `outline-ring/50` là màu outline, không đặt kiểu). Thêm `focus-visible:ring-2 ring-ring` + `ring-offset-2 ring-offset-card` để ring hiện rõ trên **cả** nền trắng lẫn nền `--primary` của mục đang active.
- `UX-M00-012` — thêm gạch nhấn cam vào header drawer mobile cho khớp sidebar desktop.
- Animation `Sheet`: mở **500ms → 300ms**, đóng **300ms → 200ms**. Mặc định shadcn vượt hướng dẫn 150–300ms của dự án; đóng nhanh hơn mở để thao tác thấy nhạy.

**Impacted modules (sửa shared component):** `ui/sheet.tsx` đã kiểm — **chỉ có duy nhất `mobile-nav.tsx` dùng** (`grep -rln "@/components/ui/sheet"` trả về 1 file). Nên thay đổi animation không lan sang module nào khác. `nav-links.tsx` dùng chung sidebar + drawer, ảnh hưởng M01–M27 nhưng chỉ thêm focus style, không đổi bố cục.

**Behavior preserved:** danh sách menu, nhãn, `href`, logic active, `aria-current`, `onNavigate` đóng drawer — **không đổi gì**.

**Responsive result:**

- Mobile: drawer mở/đóng đúng, gạch cam hiện, không tràn ngang.
- Tablet/Desktop: sidebar không đổi bố cục; chỉ thêm focus ring khi tab bằng bàn phím.

**States checked:** Hover ✅ · Focus ✅ (đây chính là phần được sửa) · Active ✅ · Loading/Empty/Error/Success ➖ không áp dụng cho điều hướng · Disabled ➖ nav không có mục disabled.

### [M00-S03] Header + user menu + notification bell

**Status:** DONE — 2026-07-21

**Files changed:** `src/components/layout/user-menu.tsx` · `src/features/notifications/components/notification-bell.tsx`

**UI/UX problems resolved:**

- `UX-M00-010` (**High**) — nút "Đăng xuất" trước đây là `<button>` trần trong `<form>`, không phải `DropdownMenuItem`: không có `role="menuitem"`, không nhận điều hướng phím mũi tên của Radix, và **không có focus style** nên người dùng bàn phím focus vào mà không thấy gì. Nay bọc `DropdownMenuItem asChild` **quanh chính cái nút** (không phải quanh `<form>` — bọc quanh form sẽ biến form thành menuitem và Enter không submit được). Hành vi đăng xuất giữ nguyên hoàn toàn.
- `UX-M00-011` — badge đếm thông báo đổi từ `--destructive` (token **lỗi**) sang `--brand-red` (accent thương hiệu). Số chưa đọc là một con số đếm, không phải trạng thái lỗi. Cùng sắc đỏ, chữ trắng trên `#C8102E` = **5.88:1**. Bỏ `text-[10px]` (giá trị tuỳ ý ngoài thang) → `text-xs`; đổi `-top-0.5 -right-0.5` → `top-1 right-1` để badge không bị tràn ra ngoài viền nút.
- Bỏ `max-w-[10rem]` → `max-w-40` (giá trị tương đương, hết arbitrary value).

**Behavior preserved:** `logoutAction`, `notificationPathForRole`, `aria-label` động theo số chưa đọc, logic ẩn/hiện badge, mục "Hồ sơ cá nhân" chỉ bật cho student — **không đổi**.

**Responsive result:** Mobile/Tablet/Desktop đều không đổi bố cục; badge nằm gọn trong nút ở cả ba tầng.

**States checked:** Hover ✅ · Focus ✅ (phần được sửa) · Disabled ✅ (mục Hồ sơ của non-student vẫn disabled như cũ) · Loading/Empty/Error/Success ➖.

### [M00-S04] Nền trang

**Status:** DONE — 2026-07-21

**Files changed:** `src/app/(dashboard)/layout.tsx`

**UI/UX problems resolved:**

- `UX-M00-009` — shell đổi từ `bg-muted/30` (alpha đoán chừng) sang `bg-surface-page` (token có tên). Màu kết quả gần như không đổi bằng mắt.

**Không đụng tới:** skip link, `data-dashboard-chrome`/`data-dashboard-main`, `force-dynamic`, footer (`D-17` vẫn nguyên), `nav-progress`.

**Quyết định trong subtask này:**

- `UX-M00-008` (gradient `nav-progress`) → **WONTFIX**. Đây là thanh tiến trình có chức năng biểu thị chuyển động; đổi sang màu đặc làm mất cảm giác hướng.
- `UX-M00-007` (luật `min-height: 44px` áp cho mọi `a[href]` trên cảm ứng) → **KHÔNG sửa trong phiên này.** Thu hẹp selector có thể âm thầm làm mất touch target ở những màn hình chưa audit. Cần đề xuất riêng kèm rà soát toàn bộ link — giữ `OPEN`.

**Responsive result:** không đổi ở cả ba tầng — chỉ đổi một giá trị màu nền.

### [M00-S05] Shared feedback component

**Status:** DONE — 2026-07-21

**Files changed:** `src/components/shared/page-header.tsx`

**UI/UX problems resolved:**

- `UX-M00-004` (một phần) — mô tả trang đổi từ `text-muted-foreground` (5.44:1) sang `text-text-secondary` (7.81:1). Nhờ có cấp chữ trung gian, các module sau tạo được phân cấp bằng **màu** thay vì phải thu nhỏ cỡ chữ xuống `text-xs`.

**Impacted modules:** `PageHeader` dùng ở hầu hết màn hình → mô tả trang sẽ đậm hơn một chút ở mọi nơi. Đây là thay đổi có chủ đích và là lý do tồn tại của token `--text-secondary`.

**Không đụng:** `empty-state.tsx` và `status-badge.tsx` — cả hai đang đúng chuẩn (`empty-state` có đủ icon/tiêu đề/mô tả/action; `status-badge` luôn kèm nhãn chữ nên không dùng màu làm tín hiệu duy nhất).

### [M00-S06] Thang kích thước control

**Status:** DONE — 2026-07-21 (đợt 2, sau khi user duyệt `DS-013`)

**Files changed:**

- `src/components/ui/button.tsx` — 8 size không còn đồng loạt 44px
- `src/components/ui/input.tsx` — `h-11` → `h-10`
- `src/components/ui/select.tsx` — trigger `h-11` → `h-10`
- `src/app/globals.css` — khối `@media (pointer: coarse)` trở thành nơi duy nhất ép 44px

**UI/UX problems resolved:** `UX-M00-003`.

**Thang mới (chiều cao cho chuột):**

| Size | Cũ | Mới | Số nơi dùng |
|---|---:|---:|---:|
| `xs` / `icon-xs` | 44px | **32px** | 1 / 2 |
| `sm` / `icon-sm` | 44px | **36px** | 65 / 0 |
| `default` / `icon` | 44px | **40px** | phần còn lại / 29 |
| `lg` / `icon-lg` | 44px | **44px** | 1 / 0 |

**Cách giữ 44px cho ngón tay:** chuyển ra CSS thay vì nhét vào class Tailwind —

```css
@media (pointer: coarse) {
  button, [role="button"], input, textarea, select,
  [data-slot="select-trigger"] { min-height: 44px; }
  [data-slot="button"][data-size^="icon"] { min-width: 44px; }
}
```

`min-height` thắng `height` nên mọi nút vẫn ≥44px trên cảm ứng. `min-width` cho nút icon là bắt buộc: thiếu nó thì `icon-xs` trên cảm ứng thành **44×32**, không đạt touch target theo chiều ngang — lỗi này không tồn tại ở bản cũ vì mọi nút đều `size-11`, và nó chỉ xuất hiện đúng lúc tách thang.

**Vì sao đụng cả `input`/`select` dù `DS-013` xuất phát từ nút:** nếu chỉ hạ nút xuống 40px mà để `input` ở 44px thì **mọi thanh lọc `Input + Button` xếp cạnh nhau sẽ lệch 4px**. Đó là regression do chính thay đổi này tạo ra, nên phải xử lý trong cùng subtask chứ không để lại cho module sau.

**Impacted modules:** **TẤT CẢ.** Mọi màn hình có nút, ô nhập hoặc select đều đổi chiều cao trên desktop. Trên cảm ứng: **không đổi gì** (vẫn 44px).

**Behavior preserved:** không đổi variant, không thêm variant (`DS-007`), không đổi nhãn, không đổi hành vi `disabled`/`loading`.

### [M00-S07] Thu hẹp luật 44px cho link

**Status:** DONE — 2026-07-21 (đợt 2)

**Files changed:** `src/app/globals.css`

**UI/UX problems resolved:** `UX-M00-007`.

**Bằng chứng làm đổi cách sửa:** đề xuất ban đầu trong issues log là "thu hẹp selector về link dạng control". Khi rà thật thì có hai phát hiện:

1. `min-height` **không có tác dụng lên inline box** (CSS 2.1 §10.5). Link chữ chạy thông thường (`<a>` inline trong `<p>`) **chưa bao giờ** bị luật này ảnh hưởng — phần lớn lo ngại ban đầu là false positive.
2. Rà 69 chỗ dùng `<Link>`/`<a>`: link dạng control (hàng danh sách, nút `asChild`, tab, link quay lại) đều là `flex`/`block`/`inline-flex`, còn link chữ chạy chỉ có 3 chỗ và đều nằm trong `<p>`.

Nên cách sửa đúng là **hai rule đơn giản**, không phải enumerate selector:

```css
a[href] { min-height: 44px; }
p a[href] { min-height: 0; }
```

Ưu điểm so với `a[href]:not(p a[href])`: `:not()` phức hợp mà trình duyệt không hiểu sẽ làm **toàn bộ rule bị bỏ**, mất luôn touch target của mọi control. Hai rule tách rời thì hỏng cái nào chỉ mất cái đó. Và quan trọng nhất: **không phải sửa một dòng nào trong page của module khác** — giữ đúng luật "một module một task".

### [M00-S08] Xoá dark mode

**Status:** DONE — 2026-07-21 (đợt 2, `DS-016` thay `DS-009`)

**Files changed (12):**

- `src/app/globals.css` — gỡ `@custom-variant dark`, gỡ khối `.dark` (38 dòng)
- `src/components/ui/{badge,button,calendar,checkbox,dropdown-menu,input,radio-group,select,switch,tabs,textarea}.tsx` — gỡ **35** class `dark:`
- `src/features/question-builder/components/question-picker.tsx` — gỡ 1 class `dark:`
- `src/components/ui/sonner.tsx` — bỏ `useTheme()` của `next-themes`

**UI/UX problems resolved:** `UX-M00-006`.

**Vì sao đây là thay đổi không ảnh hưởng thị giác — chứng minh được:** biến thể `dark:` biên dịch thành selector `.dark *`. `<html>` trong `src/app/layout.tsx` không bao giờ nhận class `dark` (không có `ThemeProvider`, không có nút chuyển theme). Selector không bao giờ khớp ⇒ các rule đó chưa từng sinh ra pixel nào. Xoá chúng không đổi được cái gì đang hiển thị.

**Một lỗi thật phát hiện khi làm:** `ui/sonner.tsx:14` đọc `useTheme()` và mặc định `"system"`, rồi truyền thẳng vào `<Sonner theme={...}>`. Sonner **không** đọc class `.dark` của Tailwind mà tự xử lý theo giá trị `theme` — nên trên máy đang để dark mode ở cấp hệ điều hành, **toast sẽ hiện nền tối trong khi cả trang vẫn sáng**. Đây là dark mode duy nhất thực sự tới được người dùng, và nó tới nhầm chỗ. Đã khoá `theme="light"`. Ghi thành `UX-M00-014`.

**Behavior preserved:** không đổi logic, không đổi nhãn, không đổi API. Gói `next-themes` vẫn còn trong `package.json` nhưng **không còn chỗ nào import** — gỡ dependency là việc của `package-lock`, để user quyết (ghi ở §9).

### [M00-S09] Viền control dùng thật `#7C8DA4`

**Status:** DONE — 2026-07-21 (đợt 3, `DS-017`)

**Files changed (1):** `src/app/globals.css` — `--input: #dde5ee` → `#7c8da4`.

**UI/UX problems resolved:** `UX-M00-002` — lần này là thật.

**Phát hiện — `UX-M00-002` trước đó mới sửa một nửa.** M00-S01 thêm token `--border-strong: #7c8da4` và đánh issue là `FIXED`. Nhưng khi audit M15 chạy `grep -rn "border-strong" src/` thì chỉ có **3 dòng khớp, cả 3 nằm trong chính `globals.css`** (khai báo + comment + `@theme inline`). Không một component nào dùng nó. Viền ô nhập vẫn được vẽ bằng `border-input` → `--input` → `#DDE5EE` → **1.27:1**, tức đúng con số bị coi là lỗi ban đầu. Token có mà không có consumer thì không sửa được gì.

**Vì sao sửa ở tầng token chứ không thêm class cho từng component:** 6 file dùng `border-input` (`input`, `textarea`, `checkbox`, `radio-group`, `select`, `calendar`). Đi thêm `border-border-strong` cho từng file là 6 chỗ phải nhớ, và bất kỳ component mới nào theo mẫu shadcn cũng sẽ lại dùng `border-input` rồi lại sai. Trỏ `--input` sang đúng giá trị là một dòng và đúng ngữ nghĩa: `--input` **là** màu viền control, `--border` mới là đường kẻ trang trí.

**Đã kiểm consumer khác của `--input` trước khi đổi:**

| Consumer | Kết quả |
|---|---|
| `border-input` — `ui/{input,textarea,checkbox,radio-group,select,calendar}.tsx` | Đúng đối tượng cần đổi. 1.27:1 → **3.39:1**, đạt WCAG 1.4.11 |
| `bg-input` — `ui/switch.tsx:20` (`data-[state=unchecked]:bg-input`) | `Switch` **không được dùng ở đâu trong `src/`** (`grep -rn "Switch" src --include=*.tsx` chỉ khớp chính file component). Không có rủi ro thị giác. Nếu sau này dùng thì đây cũng là cải thiện: track tắt trước đó 1.27:1 gần như vô hình trên nền trắng |
| `ring-input`, `text-input` | Không có chỗ nào dùng |

**Viền bảng cố ý KHÔNG đổi:** `<Table>` và `divide-y` lấy màu từ `--border` qua rule `* { @apply border-border }`. WCAG 1.4.11 áp cho *thành phần giao diện cần nhận biết để thao tác*, không áp cho đường kẻ phân cách trong bảng — kẻ bảng đậm bằng viền ô nhập sẽ làm bảng dày đặc và nhiễu. `--border` giữ `#DDE5EE`.

**Behavior preserved:**

- [x] Business logic unchanged — chỉ 1 giá trị màu trong CSS
- [x] Database/migration unchanged
- [x] API contract unchanged
- [x] Route unchanged
- [x] Permission unchanged
- [x] Validation unchanged
- [x] Labels/content unchanged

**Responsive result:** không đổi một kích thước nào — chỉ đổi màu. Không có scroll ngang mới ở cả 3 tầng.

### [M00-S10] Error boundary

**Status:** DONE — 2026-07-21 (đợt 3, `DS-018`)

**Files changed (2 file mới):**

- `src/app/(dashboard)/error.tsx` — trang lỗi cho toàn bộ khu vực đã đăng nhập
- `src/app/global-error.tsx` — lưới an toàn khi chính `RootLayout` đổ vỡ

**UI/UX problems resolved:** `UX-M13-009`.

**Vì sao đặt ở `(dashboard)` chứ không ở gốc `src/app/`:** `error.tsx` chỉ thay phần cây con của nó. Đặt trong `(dashboard)` thì `layout.tsx` của dashboard vẫn render — người dùng giữ được sidebar, header, chuông thông báo và menu tài khoản, nên vẫn biết mình đang ở đâu và vẫn chuyển sang module khác được. Đặt ở gốc sẽ nuốt luôn cả shell, đúng bằng cái đang có với trang lỗi mặc định của Next.

**Không nuốt lỗi, không lộ chi tiết kỹ thuật:** không `try/catch` một dòng nào trong query hay action — lỗi vẫn `throw`, Next vẫn log ở server. Giao diện chỉ hiện `error.digest` (mã tra cứu log), **không** hiện `error.message` vì message của Postgres/RLS có thể chứa tên bảng, tên cột hoặc chi tiết chính sách (`EX-21`, `EX-22`: không lộ payload kỹ thuật ra giao diện).

**Hai đường phục hồi:** "Thử lại" gọi `reset()` do Next truyền vào (render lại đúng segment, không reload cả trang); "Về trang chủ" là `Link` sang `/`. Cả hai dùng `Button` nên tự có thang kích thước `DS-013` và touch target 44px.

**Behavior preserved:**

- [x] Business logic unchanged — không đụng query/action nào
- [x] Database/migration unchanged
- [x] API contract unchanged
- [x] Route unchanged — `error.tsx` không phải route, không thêm URL nào
- [x] Permission unchanged — file nằm trong `(dashboard)`, `requireUser()` ở layout vẫn chạy trước
- [x] Validation unchanged
- [x] Labels/content unchanged — chỉ **thêm** chữ tiếng Việt cho một màn hình trước đây là tiếng Anh của Next, không sửa chữ nào đang có

**Responsive result:**

- Mobile 360–430px: card `max-w-lg` co theo viewport, 2 nút `flex-wrap` xuống dòng khi hẹp. Không scroll ngang.
- Tablet / Desktop: card canh giữa, tối đa 32rem.

**States checked:**

- [x] Error — chính là trạng thái của màn hình này
- [x] Focus — 2 nút dùng `Button` nên có `ring-[3px]`
- [x] Hover / Active — theo `button.tsx`
- [ ] Loading / Empty / Success / Disabled — N/A

## 8. Final Module Verification

| Check | Result | Evidence |
|---|---|---|
| Scope respected | ✅ | Không đổi logic/API/route/permission/validation/nhãn. **Đợt 2:** `button.tsx` sửa theo `DS-013` (user duyệt), `.dark` xoá theo `DS-016` (user duyệt) |
| Shared component impact | ✅ Đã rà | `ui/sheet.tsx` chỉ 1 consumer (`mobile-nav`); `nav-links`/`page-header` ảnh hưởng rộng nhưng chỉ đổi focus style và màu chữ mô tả |
| Responsive complete | ✅ | Không subtask nào đổi bố cục; kiểm 3 tầng ở S02–S04 |
| Accessibility reviewed | ✅ | 2 lỗi contrast token đã sửa; focus nav item đã thêm; `UX-M00-010` đã sửa |
| Lint | ✅ Pass | `npm run lint` — không output lỗi |
| Type-check | ✅ Pass | `npm run typecheck` — không output lỗi |
| Test | ✅ **162/162** | Xem ghi chú flaky bên dưới |
| Build | ✅ Pass | `npm run build` → `✓ Compiled successfully in 15.9s`, exit 0 |

**Ghi chú trung thực về test:** lần chạy `npm test` đầu tiên sau S02–S05 báo **160/162 (2 fail)** ở `wrong-answer-review` và `student-review-page` — dạng timeout do tranh tài nguyên khi chạy song song, đúng hiện tượng đã ghi ở `WORKLOG` phiên 45 và 48. Chạy lại mặc định: xanh. Chạy `--maxWorkers=4`: **162/162**. Chạy riêng hai file đó: **2/2**. **Không sửa, không nới lỏng, không skip test nào.** Hai file này không liên quan tới bất kỳ file nào M00 đụng vào.

## 9. Remaining Issues

Còn mở sau khi M00 đóng (cập nhật sau đợt 2):

- `UX-M00-005` — chuẩn hoá radius (`rounded-2xl`, `rounded-none` nằm ngoài thang). Xử lý dần theo từng module vì các class đó nằm trong màn hình của module khác.
- `UX-M00-004` — rà `text-xs` (242 chỗ). `PARTIALLY_FIXED`; mỗi module tự rà phần của mình.
- **Gói `next-themes` không còn nơi nào import** sau `DS-016`. Gỡ khỏi `package.json` sẽ đổi `package-lock.json` — không làm trong task UI/UX, để user quyết.

Đã đóng trong module này: `UX-M00-001`, `-002`, `-003`, `-006`, `-007`, `-009`, `-010`, `-011`, `-012`, `-014`, và một phần `-004`. `UX-M00-008` đóng dạng **WONTFIX** có lý do; `UX-M00-013` đóng dạng **WONTFIX** theo `DS-015` (không thêm breadcrumb).

Chuyển cho module khác:

- Animation flashcard dài **480ms** (`globals.css`), vượt hướng dẫn 150–300ms. Đây là hiệu ứng lật trang do user yêu cầu ở Phase 14 → để `M24` xem xét, **không sửa ở M00**.
- Header desktop có nửa trái trống hoàn toàn (`layout.tsx:61` là spacer rỗng), không có chỉ dấu vị trí. Thêm breadcrumb là **thêm chức năng** nên ngoài phạm vi; ghi nhận để user quyết.

### Kiểm tra lại sau đợt 2 (S06–S08) — 2026-07-21

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ **PASS** — không output lỗi |
| Type-check | `npm run typecheck` | ✅ **PASS** — không output lỗi |
| Test | `npm test -- --maxWorkers=4` | ✅ **162/162 PASS** (51 test file, 69.38s) — không sửa/nới/skip test nào |
| Build | `npm run build` | ✅ **PASS** — `✓ Compiled successfully in 18.2s` |
| `dark:` còn sót | `grep -rn "dark:" src` | ✅ **0** class (chỉ còn 2 dòng comment giải thích trong `globals.css`) |
| `next-themes` còn import | `grep -rn "next-themes" src` | ✅ **0** |

**Responsive (S06–S08):**

- Mobile 360–430px: **không đổi gì** — `@media (pointer: coarse)` giữ mọi control ở 44px như cũ; nút icon nay còn được bảo đảm 44px cả chiều ngang (trước chỉ đúng vì tình cờ dùng `size-11`).
- Tablet 768–1024px: thiết bị cảm ứng theo nhánh `coarse` (44px); tablet dùng chuột/bàn phím theo nhánh `fine` (32/36/40/44px).
- Desktop 1280px+: nút và ô nhập thấp hơn 4–12px → mật độ tăng, đúng mục tiêu `DS-013`. Không có scroll ngang cấp trang vì không có chiều rộng nào đổi (trừ nút icon co lại).

### Kiểm tra lại sau đợt 3 (S09–S10) — 2026-07-21

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ **PASS** — không output lỗi |
| Type-check | `npm run typecheck` | ✅ **PASS** — không output lỗi |
| Test | `npm test -- --maxWorkers=4` | ✅ **162/162 PASS** (51 file, 68.38s) — không sửa/nới/skip test nào |
| Build | `npm run build` | ✅ **PASS** — `✓ Compiled successfully in 14.5s` |
| Consumer của `--input` | `grep -rn "border-input\|bg-input" src` | 6 file `ui/*` + `switch.tsx` (không consumer) — đã rà từng cái ở S09 |

**Cần xác minh độc lập cho đợt 3** (người sửa là Claude nên không tự ghi `Verified`):

- **S09:** mở một trang có form (vd `/admin/students` → nút Thêm) và nhìn viền ô nhập — phải thấy rõ trên nền trắng, không còn gần như vô hình. Kiểm cả checkbox và select.
- **S10:** tạm thời làm hỏng một query (vd đổi tên bảng trong `teacher-queries.ts`) rồi mở `/teacher` — phải thấy card tiếng Việt "Không tải được nội dung" **cùng với sidebar và header còn nguyên**, có nút "Thử lại". Nhớ hoàn tác.

## 10. Final Status

`DONE` — 10 subtask (S01–S10) hoàn tất, lint/typecheck/test/build xanh.

> Người sửa là Claude nên **không tự ghi Verified**. Theo mô hình QA của repo (`CLAUDE.md`), M00 cần Codex hoặc user xác minh độc lập: nhìn bằng mắt trên desktop + mobile, tab bằng bàn phím qua sidebar và menu tài khoản, kiểm badge thông báo và nền trang.
