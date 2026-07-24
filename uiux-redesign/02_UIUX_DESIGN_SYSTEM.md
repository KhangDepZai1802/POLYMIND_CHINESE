# UI/UX Design System

> Điền từ source code thực tế ngày **2026-07-21** (Phase 0). Mọi giá trị màu bên dưới đọc trực tiếp từ `src/app/globals.css`, không đoán bằng mắt.
> Mọi tỷ lệ contrast trong file này được tính bằng công thức WCAG 2.1 (relative luminance), không ước lượng.

---

## 1. Technology Audit

| Hạng mục              | Kết quả                                                                                                                                                         | Bằng chứng source                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Frontend framework    | Next.js 16.2.10, App Router, React 19.2.4, TypeScript strict                                                                                                    | `package.json`; `src/app/` dùng route group `(auth)` / `(dashboard)`                              |
| UI library            | shadcn/ui style `new-york`, base color `slate`, CSS variables `true`, RSC `true`                                                                                | `components.json`; 27 primitive trong `src/components/ui/`                                        |
| Primitive nền         | Radix UI (gói hợp nhất `radix-ui@1.6.2`)                                                                                                                        | `package.json`; `src/components/ui/button.tsx` import `{ Slot } from "radix-ui"`                  |
| CSS framework         | Tailwind CSS v4 (`@import "tailwindcss"`, `@theme inline`), PostCSS plugin `@tailwindcss/postcss`. **Không có `tailwind.config.js`** — token khai báo trong CSS | `src/app/globals.css`; `components.json` → `tailwind.config: ""`                                  |
| Icon library          | **lucide-react 0.545.0**                                                                                                                                        | `components.json` → `"iconLibrary": "lucide"`; `src/lib/permissions/navigation.ts` import 18 icon |
| Form library          | react-hook-form 7.65 + `@hookform/resolvers` + Zod 4.1                                                                                                          | `package.json`; `src/components/ui/form.tsx`                                                      |
| Table library         | `@tanstack/react-table` 8.21 (có sẵn) + primitive `Table` thuần                                                                                                 | `src/components/ui/table.tsx`; chỉ **5 file** hiện dùng `<Table`                                  |
| Chart library         | recharts 3.2.1, đọc token `--chart-1..5`                                                                                                                        | `package.json`; `globals.css`                                                                     |
| Toast                 | sonner 2.0.7, `<Toaster position="top-center" richColors />`                                                                                                    | `src/app/(dashboard)/layout.tsx:87`                                                               |
| Font                  | **Be Vietnam Pro** (next/font/google), subset `latin` + `vietnamese`, weight 400/500/600/700, `display: swap`                                                   | `src/app/layout.tsx:5-10`                                                                         |
| Font CJK              | Fallback stack hệ thống (`Microsoft YaHei`, `PingFang SC`, `Noto Sans SC`), class `.font-hanzi` phóng `1.08em`                                                  | `globals.css`                                                                                     |
| Theme location        | `src/app/globals.css` — `:root` (light) và `.dark`                                                                                                              | —                                                                                                 |
| Design token location | `globals.css` → `:root` + `@theme inline` map sang utility Tailwind                                                                                             | —                                                                                                 |
| Layout shell          | `src/app/(dashboard)/layout.tsx` — sidebar trái + header sticky h-16 + main + footer                                                                            | —                                                                                                 |
| Sidebar/navigation    | `src/components/layout/sidebar-nav.tsx` (desktop, `w-64`, `md:flex`), `mobile-nav.tsx` (drawer `<Sheet>`), `nav-links.tsx` (dùng chung)                         | —                                                                                                 |
| Route map             | 51 `page.tsx`; 3 role menu định nghĩa tại `src/lib/permissions/navigation.ts`                                                                                   | —                                                                                                 |
| Permission guard      | Middleware + server action + RLS. Nav **không phải** phân quyền (ghi rõ trong comment `navigation.ts:32-34`)                                                    | `src/lib/auth/`, `src/lib/permissions/`                                                           |

### Ghi chú quan trọng về theme

`globals.css` có đầy đủ khối `.dark` (~25 token) và source có 35 class `dark:`, **nhưng không có `ThemeProvider`, không có nút chuyển theme, và `<html>` không bao giờ được gắn class `dark`**. `next-themes` chỉ được import ở một chỗ duy nhất là `src/components/ui/sonner.tsx:10`. Kết luận: **dark mode hiện là code không tới được** — xem `DS-009` và `UX-M00-006`.

---

## 2. Màu chủ đạo hiện tại — xác định từ source

| Thuộc tính              | Giá trị                                    | Nguồn                                                                                     |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Primary                 | **`#1A5FA8`** = `hsl(210.8, 73.2%, 38.0%)` | `globals.css` → `:root { --primary: #1a5fa8 }`                                            |
| Primary foreground      | `#FFFFFF`                                  | `--primary-foreground`                                                                    |
| Brand navy              | `#0D3F78`                                  | `--brand-navy`                                                                            |
| Brand red (nhấn)        | `#C8102E`                                  | `--brand-red` — comment source ghi rõ "đỏ Trung Hoa là ACCENT THƯƠNG HIỆU, dùng TIẾT CHẾ" |
| Brand orange (nhấn phụ) | `#FB9518`                                  | `--brand-orange`, foreground `#10243F`                                                    |
| Focus ring              | `#1A5FA8`                                  | `--ring`                                                                                  |
| Foreground              | `#10243F` (navy gần đen)                   | `--foreground`                                                                            |

### Nơi đang sử dụng

| Vị trí                     | Màu                                                                                        | Source                |
| -------------------------- | ------------------------------------------------------------------------------------------ | --------------------- |
| Nav item active            | nền `--primary`, chữ trắng, thêm chấm tròn `--brand-orange` bên phải                       | `nav-links.tsx:38-52` |
| Nav item hover             | `bg-brand-orange/15` + `text-foreground`                                                   | `nav-links.tsx:42`    |
| Button `default`           | nghỉ = `bg-primary`; **hover đổi sang `bg-brand-orange`** + `text-brand-orange-foreground` | `button.tsx:13-14`    |
| Button `outline` / `ghost` | hover `bg-brand-orange/15`                                                                 | `button.tsx:18,22`    |
| Button `link`              | `text-primary`, hover `text-brand-orange`                                                  | `button.tsx:23`       |
| Gạch nhấn logo sidebar     | `bg-brand-orange`, cao 4px rộng 32px                                                       | `sidebar-nav.tsx:23`  |
| Badge `info`               | `bg-primary/10 text-primary border-primary/25`                                             | `status-badge.tsx:10` |
| Chart                      | `--chart-1` = `#1A5FA8`                                                                    | `globals.css`         |

### Quy tắc màu — CHỐT

- **KHÔNG đổi `#1A5FA8`, `#C8102E`, `#FB9518`, `#0D3F78`.** Đây là nhận diện thương hiệu (`DS-001`).
- Chỉ được **mở rộng sắc độ** từ các màu đã xác nhận và **sửa contrast** ở các cặp fail.
- Mọi thay đổi token dùng chung phải ghi vào `08_UIUX_DECISIONS.md` trước khi triển khai.

---

## 3. Color Tokens

### 3.1 Audit contrast token hiện tại (light) — số đo thật

| Cặp                                               | Giá trị               |   Contrast | Kết luận                                                                                                       |
| ------------------------------------------------- | --------------------- | ---------: | -------------------------------------------------------------------------------------------------------------- |
| `--foreground` trên `--background`                | `#10243F` / `#FFFFFF` |    15.60:1 | AA pass                                                                                                        |
| `--muted-foreground` trên trắng                   | `#5B6B80` / `#FFFFFF` |     5.44:1 | AA pass                                                                                                        |
| `--muted-foreground` trên `--muted`               | `#5B6B80` / `#F1F5F9` |     4.97:1 | AA pass                                                                                                        |
| `--primary-foreground` trên `--primary`           | `#FFFFFF` / `#1A5FA8` |     6.47:1 | AA pass                                                                                                        |
| `--secondary-foreground` trên `--secondary`       | `#0D3F78` / `#EEF4FB` |     9.49:1 | AA pass                                                                                                        |
| `--destructive-foreground` trên `--destructive`   | `#FFFFFF` / `#DC2626` |     4.83:1 | AA pass                                                                                                        |
| `--success-foreground` trên `--success`           | `#FFFFFF` / `#166534` |     7.13:1 | AA pass                                                                                                        |
| `--warning-foreground` trên `--warning`           | `#FFFFFF` / `#92400E` |     7.09:1 | AA pass                                                                                                        |
| `--brand-red-foreground` trên `--brand-red`       | `#FFFFFF` / `#C8102E` |     5.88:1 | AA pass                                                                                                        |
| `--brand-orange-foreground` trên `--brand-orange` | `#10243F` / `#FB9518` |     6.99:1 | AA pass                                                                                                        |
| **`--info-foreground` trên `--info`**             | `#FFFFFF` / `#0284C7` | **4.10:1** | ❌ **FAIL AA** cho chữ thường → `UX-M00-001`                                                                   |
| **`--border` trên `--background`**                | `#DDE5EE` / `#FFFFFF` | **1.27:1** | ❌ **FAIL** 3:1 cho viền control (WCAG 1.4.11) → `UX-M00-002`                                                  |
| Chữ trắng trên `--brand-orange`                   | `#FFFFFF` / `#FB9518` |     2.23:1 | ❌ Cấm tuyệt đối. Hiện source **không** vi phạm (button `default` hover dùng đúng `--brand-orange-foreground`) |

Kết luận: bộ token hiện tại **đã tốt**, chỉ có **hai lỗi contrast thật** (`--info`, `--border`) cần sửa.

### 3.2 Thang Primary 50–950 — dẫn xuất từ `#1A5FA8`

Giữ nguyên hue `210.8°` của màu thương hiệu. **`primary-600` khớp chính xác `#1A5FA8`** — đây là bằng chứng thang màu được dẫn xuất từ brand color chứ không phải bịa ra.

| Token             | Value         | Contrast / trắng | Usage                                                             |
| ----------------- | ------------- | ---------------: | ----------------------------------------------------------------- |
| `primary-50`      | `#F5F9FD`     |           1.06:1 | Nền nhấn rất nhẹ, hàng bảng được chọn                             |
| `primary-100`     | `#E6EFFA`     |           1.16:1 | Hover nhẹ, nền badge info                                         |
| `primary-200`     | `#C3DBF4`     |           1.42:1 | Viền nhấn, separator trong vùng primary                           |
| `primary-300`     | `#91BBE8`     |           2.00:1 | Viền control trạng thái nhấn                                      |
| `primary-400`     | `#4D92DB`     |           3.26:1 | Icon/đồ hoạ trên nền trắng (≥3:1) — **không dùng cho chữ thường** |
| `primary-500`     | `#2373C7`     |           4.83:1 | Chữ primary trên nền trắng khi cần nhạt hơn 600                   |
| **`primary-600`** | **`#1A5FA8`** |       **6.47:1** | **Primary mặc định — = `--primary` hiện tại, KHÔNG ĐỔI**          |
| `primary-700`     | `#134B86`     |           8.83:1 | Hover/active của nút primary                                      |
| `primary-800`     | `#103B68`     |          11.37:1 | Nhấn mạnh trên nền tối nhẹ                                        |
| `primary-900`     | `#0C2C4D`     |          14.16:1 | Chữ tiêu đề nhấn mạnh                                             |
| `primary-950`     | `#091D32`     |          17.03:1 | Contrast tối đa                                                   |

> ⚠️ Thang này là **đề xuất** cho phase sau. Chỉ được thêm vào `globals.css` khi module `M00` triển khai, và phải giữ `--primary` trỏ đúng `primary-600`.

### 3.3 Surface / Text / Border — đề xuất

| Token            | Value hiện tại                                 | Value đề xuất        |                 Contrast | Lý do                                                                                                       |
| ---------------- | ---------------------------------------------- | -------------------- | -----------------------: | ----------------------------------------------------------------------------------------------------------- |
| `surface-page`   | _(không có token — layout dùng `bg-muted/30`)_ | `#F6F8FB`            | text `#10243F` = 14.66:1 | Nền trang cần là token thật, không phải alpha ngẫu hứng                                                     |
| `surface-card`   | `--card: #FFFFFF`                              | `#FFFFFF` giữ nguyên |                  15.60:1 | Card nổi trên nền trang bằng độ sáng, không cần shadow mạnh                                                 |
| `surface-muted`  | `--muted: #F1F5F9`                             | `#EDF1F7`            |                  13.76:1 | Ngả nhẹ về hue thương hiệu thay vì slate trung tính                                                         |
| `surface-sunken` | _(không có)_                                   | `#E4EAF2`            |                  12.89:1 | Vùng chìm: header bảng, thanh filter                                                                        |
| `text-primary`   | `--foreground: #10243F`                        | giữ nguyên           |                  15.60:1 | Đã đạt                                                                                                      |
| `text-secondary` | _(không có)_                                   | `#43536B`            |                   7.81:1 | Hiện chỉ có 2 cấp (`foreground` / `muted-foreground`); thiếu cấp giữa nên mô tả và meta bị dồn cùng một màu |
| `text-muted`     | `--muted-foreground: #5B6B80`                  | giữ nguyên           |                   5.44:1 | Đã đạt AA — **không làm nhạt hơn**                                                                          |
| `text-disabled`  | _(không có)_                                   | `#8494A8`            |                   3.10:1 | Chỉ dùng cho control disabled (WCAG miễn trừ), luôn kèm thuộc tính `disabled`                               |
| `border-default` | `--border: #DDE5EE`                            | giữ nguyên           |                   1.27:1 | Chỉ cho **divider trang trí** — WCAG không yêu cầu 3:1 cho divider                                          |
| `border-strong`  | _(không có)_                                   | `#7C8DA4`            |                   3.39:1 | **Bắt buộc** cho viền input, checkbox, radio, select, viền bảng — WCAG 1.4.11 yêu cầu ≥3:1                  |

### 3.4 Trạng thái

| Token                   | Hiện tại  | Đề xuất       |                         Contrast (fg trên bg) |
| ----------------------- | --------- | ------------- | --------------------------------------------: |
| `success`               | `#166534` | giữ nguyên    |                              7.13:1 với trắng |
| `warning`               | `#92400E` | giữ nguyên    |                              7.09:1 với trắng |
| `error` / `destructive` | `#DC2626` | giữ nguyên    |                              4.83:1 với trắng |
| `info`                  | `#0284C7` | **`#0369A1`** |                           4.10:1 → **5.93:1** |
| `focus-ring`            | `#1A5FA8` | giữ nguyên    | 6.47:1 trên trắng, 6.08:1 trên `surface-page` |

**Luật bất biến:** màu không bao giờ là tín hiệu trạng thái duy nhất. `status-badge.tsx` đã làm đúng (luôn có nhãn chữ) — giữ nguyên nguyên tắc này ở mọi module.

---

## 4. Typography

Font: **Be Vietnam Pro**, weight có sẵn 400/500/600/700. Không thêm weight mới (mỗi weight là một file font phải tải).

| Role                |               Size | Weight | Line height | Ghi chú                                                                 |
| ------------------- | -----------------: | -----: | ----------: | ----------------------------------------------------------------------- |
| Page title          |  24px (`text-2xl`) |    700 |        1.25 | Khớp `page-header.tsx` hiện tại — giữ nguyên                            |
| Section title       |   18px (`text-lg`) |    600 |        1.35 |                                                                         |
| Card title          | 16px (`text-base`) |    600 |         1.4 | `card.tsx` hiện chỉ có `font-semibold leading-none`, không định cỡ      |
| Body                | 16px (`text-base`) |    400 |         1.6 |                                                                         |
| Body compact / bảng |   14px (`text-sm`) |    400 |         1.5 | Cỡ chủ đạo của dữ liệu vận hành                                         |
| Small/meta          |               13px |    400 |        1.45 | **Xem cảnh báo bên dưới**                                               |
| Table header        |               13px |    600 |         1.4 | Không uppercase toàn bộ — tiếng Việt có dấu mất đường nét khi uppercase |
| Button              |               14px |    500 |           1 |                                                                         |
| Form label          |               14px |    500 |         1.4 |                                                                         |

**Cảnh báo có bằng chứng:** source dùng `text-xs` (12px) **242 lần** so với `text-xl`/`2xl`/`3xl` chỉ **17 lần**. Đây là dấu hiệu thông tin bị nén xuống cấp chữ nhỏ nhất thay vì được phân cấp. Ghi nhận `UX-M00-004`; mỗi module phải rà lại `text-xs` nào là meta thật, `text-xs` nào là nội dung bị thu nhỏ nhầm.

Nguyên tắc:

- Không thêm cấp chữ mới ngoài bảng trên.
- Không dùng `font-weight` 300 hay nhẹ hơn.
- Chữ Hán dùng `.font-hanzi` (đã có), không đổi.
- Dữ liệu số/tiền/đồng hồ dùng `tabular-nums` để không nhảy cột.

---

## 5. Spacing

Tailwind v4 mặc định `--spacing: 0.25rem` (4px). Dự án chưa khai báo lại → dùng thang 4px chuẩn. Không đổi thang, chỉ chốt cách dùng.

| Token      | Value | Usage                                                                       |
| ---------- | ----: | --------------------------------------------------------------------------- |
| `space-1`  |   4px | Khoảng rất nhỏ, gap icon-nhãn trong badge                                   |
| `space-2`  |   8px | Gap icon/text                                                               |
| `space-3`  |  12px | Padding trong field, gap nav item (`nav-links.tsx` dùng `gap-3`)            |
| `space-4`  |  16px | Khoảng chuẩn; padding main mobile (`p-4` — khớp layout hiện tại)            |
| `space-5`  |  20px | Gap giữa nhóm control                                                       |
| `space-6`  |  24px | Padding card (`card.tsx` dùng `py-6 px-6`); padding main desktop (`md:p-6`) |
| `space-8`  |  32px | Khoảng cách giữa section lớn                                                |
| `space-12` |  48px | Khoảng cách khối trang / empty state                                        |

Mật độ: đây là **ứng dụng quản lý nội bộ dùng hằng ngày** → ưu tiên mật độ trung bình-cao. Không nới rộng theo kiểu landing page.

---

## 6. Border Radius

Nguồn: `--radius: 0.625rem` (10px), map ra `radius-sm/md/lg/xl` trong `@theme inline`.

| Token         |  Value | Usage                                                           |
| ------------- | -----: | --------------------------------------------------------------- |
| `radius-sm`   |    6px | Chip, badge vuông, checkbox                                     |
| `radius-md`   |    8px | Button, input, select — `button.tsx` đang dùng `rounded-md`     |
| `radius-lg`   |   10px | Nav item (`nav-links.tsx` dùng `rounded-lg`), popover, dropdown |
| `radius-xl`   |   14px | Card (`card.tsx` dùng `rounded-xl`), modal                      |
| `radius-full` | 9999px | Avatar, chấm trạng thái, badge tròn                             |

**Vấn đề đã đo:** source dùng 7 giá trị radius khác nhau — `rounded-lg` 59 lần, `rounded-md` 44, `rounded-full` 31, `rounded-xl` 12, `rounded-sm` 9, `rounded-2xl` 5, `rounded-none` 4. `rounded-2xl` và `rounded-none` nằm ngoài thang → ghi nhận `UX-M00-005`, chuẩn hoá dần theo module.

---

## 7. Shadow

Ưu tiên **phân tầng bằng surface + border**, không dùng shadow mạnh. Ứng dụng quản lý cần đọc nhanh, không cần chiều sâu giả.

| Token       | Usage                             | Số lần đang dùng |
| ----------- | --------------------------------- | ---------------: |
| `shadow-xs` | Button `outline`                  |                8 |
| `shadow-sm` | Card ở trạng thái nghỉ            |                7 |
| `shadow-md` | Dropdown, popover, tooltip        |                4 |
| `shadow-lg` | Modal, sheet, skip-link khi focus |                7 |

Cấm: `shadow-xl`/`2xl`, glow màu, shadow nhiều lớp trang trí.

---

## 8. Action Hierarchy

Thứ tự: **Primary → Secondary → Tertiary/ghost → Destructive → Icon-only**.

Ánh xạ sang variant hiện có của `button.tsx` (không thêm variant mới trừ khi có quyết định riêng):

| Cấp         | Variant       | Quy định                                                                                     |
| ----------- | ------------- | -------------------------------------------------------------------------------------------- |
| Primary     | `default`     | **Tối đa một** primary nổi bật trong một khu vực                                             |
| Secondary   | `outline`     | Hành động hỗ trợ                                                                             |
| Tertiary    | `ghost`       | Hành động phụ trong hàng bảng, toolbar                                                       |
| Destructive | `destructive` | Phải tách khỏi cụm primary; giữ nguyên dialog xác nhận hiện có (`confirmation-provider.tsx`) |
| Icon-only   | `icon*`       | **Bắt buộc** `aria-label` hoặc tooltip                                                       |
| Link        | `link`        | Điều hướng dạng chữ                                                                          |

Quy định thêm:

- Loading không được đổi kích thước nút (`submit-button.tsx` đã xử lý — dùng lại, không tự viết mới).
- Disabled phải kèm thuộc tính `disabled` thật, không chỉ giảm opacity.
- Focus ring không được bị `overflow-hidden` của container cắt.

**Vấn đề đã đo — cần đề xuất riêng trước khi sửa:** trong `button.tsx`, **tất cả 8 size đều là 44px** (`h-11` / `size-11`). `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg` không khác nhau về chiều cao — thang kích thước nút thực tế **không tồn tại**. Đây là hệ quả của việc áp luật touch target 44px cho cả chuột lẫn cảm ứng. Ghi nhận `UX-M00-003`; đây là shared component rủi ro cao, **phải đề xuất và được duyệt trước khi đụng vào** (xem §15).

---

## 9. Table

- Header dễ quét; nền `surface-sunken`; chữ 13px/600.
- Căn lề theo loại dữ liệu: text trái, số/tiền phải, ngày trái, trạng thái trái.
- Số/tiền dùng `tabular-nums`.
- Hành động hàng nhất quán một chỗ (cuối hàng), không rải icon không nhãn.
- Bắt buộc có loading (skeleton), empty (`empty-state.tsx` — dùng lại), error.
- Sticky header chỉ khi bảng dài quá một màn hình.
- Viền bảng dùng `border-strong`, không dùng `border-default` (1.27:1 quá mờ).

**Responsive:** `table.tsx` đã bọc `<div class="relative w-full overflow-x-auto">` nên bảng cuộn **trong vùng bảng**, không tràn trang — đúng luật. Mỗi module vẫn phải ghi rõ chiến lược cho từng bảng: ẩn cột phụ / chuyển card / giữ cuộn ngang.

---

## 10. Form

- Label luôn hiển thị, không dùng placeholder thay label.
- Placeholder chỉ nêu ví dụ định dạng.
- Required, error, helper text nhất quán; error luôn có **chữ**, không chỉ đổi màu.
- Error đặt ngay dưới field liên quan.
- Field height ≥44px trên cảm ứng.
- Validate khi `blur`, không validate từng phím.
- **Giữ nguyên 100% validation hiện có** (Zod schema trong `features/*/schema.ts`) — đây là ranh giới cứng.
- **Giữ nguyên thứ tự field nghiệp vụ** trừ khi có quyết định ghi trong `08_UIUX_DECISIONS.md`.

---

## 11. Modal

- Tiêu đề mô tả đúng hành động, không dùng "Xác nhận" chung chung khi có thể nói rõ.
- Thứ tự nút nhất quán: hành động phụ bên trái, hành động chính bên phải.
- Destructive khác biệt rõ và tách khỏi nút chính.
- Nội dung dài cuộn **bên trong** modal, không đẩy tràn viewport.
- Focus trap và đóng bằng `Esc` theo Radix — không tự viết lại.
- Không biến mọi thao tác thành modal; thao tác đơn giản nên inline.

---

## 12. Navigation

- **Giữ nguyên cấu trúc route và phân quyền** — `NAVIGATION` trong `navigation.ts` là dữ liệu nghiệp vụ, không phải trang trí.
- Active state hiện tại (`bg-primary` + chấm cam) đã rõ; giữ tín hiệu kép (nền + chấm) vì đó là "không dùng màu làm tín hiệu duy nhất".
- `aria-current="page"` đã có (`nav-links.tsx:36`) — giữ.
- Sidebar desktop `w-64`, ẩn dưới `md`; mobile dùng drawer. Giữ behavior.
- Touch target nav item hiện `min-h-11` = 44px — đạt.
- Skip link "Bỏ qua điều hướng" đã có (`layout.tsx:39-45`) — giữ.

---

## 13. Responsive Behavior

Breakpoint kiểm tra bắt buộc cho mọi màn hình:

| Tầng    | Kích thước            | Yêu cầu                                                                                  |
| ------- | --------------------- | ---------------------------------------------------------------------------------------- |
| Mobile  | 360px / 390px / 430px | Không scroll ngang cấp trang. Sidebar ẩn, drawer hoạt động. Bảng theo chiến lược đã ghi. |
| Tablet  | 768px / 1024px        | Sidebar xuất hiện từ `md` (768px). Kiểm tra vùng nội dung không bị bóp.                  |
| Desktop | 1280px / 1440px+      | Không để dòng chữ dài quá 75 ký tự trong khối văn bản.                                   |

Luật: **không đánh dấu màn hình hoàn thành nếu chưa ghi kết quả cả ba tầng** vào báo cáo module.

---

## 14. System States

| State    | Quy chuẩn                                                                                     | Component dùng chung có sẵn                                                                                 |
| -------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Loading  | Skeleton cho nội dung có hình dạng biết trước; spinner cho hành động. Không gây layout shift. | `ui/skeleton.tsx`, `shared/submit-button.tsx`, `shared/page-loading-overlay.tsx`, `shared/nav-progress.tsx` |
| Empty    | Nêu rõ trạng thái + hành động khả dụng                                                        | `shared/empty-state.tsx`                                                                                    |
| Error    | Mô tả lỗi rõ + đường phục hồi; giữ nguyên retry hiện có                                       | `ui/alert.tsx`, toast `sonner`                                                                              |
| Disabled | Thuộc tính `disabled` thật + `text-disabled`; vẫn đọc được                                    | `button.tsx` (`disabled:opacity-50`)                                                                        |
| Success  | Toast hoặc dấu hiệu inline có icon **và** chữ                                                 | `sonner` (`richColors`)                                                                                     |
| Focus    | `focus-visible` ring 3px màu `--ring`, tương phản ≥6:1 trên mọi surface sáng                  | `button.tsx` đã dùng `focus-visible:ring-[3px] ring-ring/50`                                                |

Animation: chỉ 150–300ms, chỉ phục vụ phản hồi thao tác, chỉ animate `transform`/`opacity`. Phải tôn trọng `prefers-reduced-motion`.

### Audio học viên — yêu cầu đã chốt

- Player dùng chung cho audio **do giáo viên/Super Admin tải lên** trong M22–M24; không áp dụng cho bản ghi Nói do học viên tự thu.
- Mặc định `1×`; bộ chọn chỉ có `0.5×`, `0.75×`, `1×`. Không thêm `1.25×` hoặc `1.5×`.
- Thay đổi tốc độ ở client bằng `playbackRate`, giữ cao độ khi browser hỗ trợ; không sinh file mới và không đổi pipeline signed URL.
- Bộ chọn có tên truy cập, trạng thái chọn rõ, thao tác được bằng bàn phím và đạt touch target 44×44 px trên cảm ứng.
- Nguồn yêu cầu: `DS-019`, `P14-T12`, user chốt ngày 2026-07-21.

### Palette hỗ trợ riêng cho trải nghiệm học viên

- **Màu chủ đạo không đổi:** xanh `#1A5FA8` cùng cam/đỏ thương hiệu vẫn là hai trục nhận diện chính; Be Vietnam Pro tiếp tục là font duy nhất.
- Được mở rộng bằng các sắc **gần màu gốc**: sky/cyan ở phía xanh và amber/coral ở phía cam/đỏ. Các màu này chỉ dùng cho nền nhẹ, phân nhóm, minh họa hình học, tiến độ và điểm nhấn phụ; không được lấn át màu chủ đạo.
- Màu mới phải đi qua semantic token có tên theo vai trò, được đo tương phản WCAG trên đúng surface trước khi đưa vào `globals.css`. Không viết hex trực tiếp trong component và không dùng màu làm tín hiệu duy nhất.
- Không tự thêm họ xanh lá/tím xa nhận diện. Không gradient, emoji, clay/3D hoặc hiệu ứng nặng; cảm giác tạo động lực đến từ phân cấp, khoảng thở, hình khối và dữ liệu học tập thật.
- Mã token cụ thể được chốt trong `P15-T1` sau audit M20 và impact map của `globals.css`; quyết định này chỉ cho phép hướng màu, không cho phép sửa shared token hàng loạt chưa đánh giá.
- Nguồn: `DS-027`, user chốt ngày 2026-07-22.

---

## 15. Quy tắc sửa Shared Component (bắt buộc)

Các file sau ảnh hưởng **toàn bộ module**. Trước khi sửa bất kỳ file nào bên dưới:

1. Chạy tìm toàn bộ nơi sử dụng và ghi số lượng vào báo cáo module.
2. Ghi phần "Impacted modules" trong báo cáo.
3. Nếu thay đổi có thể đổi hình dạng/hành vi ở module khác → **đề xuất trước, không tự triển khai hàng loạt**.

| File                                                                             | Rủi ro         | Ghi chú                           |
| -------------------------------------------------------------------------------- | -------------- | --------------------------------- |
| `src/app/globals.css`                                                            | **Cực cao**    | Đổi một token là đổi mọi màn hình |
| `src/components/ui/button.tsx`                                                   | **Cực cao**    | Xem `UX-M00-003`                  |
| `src/components/ui/table.tsx`, `input.tsx`, `form.tsx`, `card.tsx`, `dialog.tsx` | Cao            | Primitive shadcn                  |
| `src/components/layout/*`                                                        | Cao            | Shell dùng chung 3 role           |
| `src/components/shared/*`                                                        | Trung bình-cao | 13 component tiện ích             |

---

## 16. Trạng thái file này

| Mục                 | Trạng thái                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| §1 Technology audit | ✅ Hoàn tất từ source (2026-07-21)                                                             |
| §2 Màu chủ đạo      | ✅ Xác định từ source, có bằng chứng dòng                                                      |
| §3 Color token      | ✅ Audit xong; thang 50–950 và token mới là **ĐỀ XUẤT**, chưa vào code                         |
| §4–§15              | ✅ Chuẩn đã chốt; áp dụng dần theo module                                                      |
| Triển khai code     | ✅ Đã áp dụng qua M00/M13/M15/M14/M20; palette student-only của `DS-027` được triển khai ở M20 |
