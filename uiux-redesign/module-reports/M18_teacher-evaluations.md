# M18 — Đánh giá & Ghi chú · `P17-T3`

> **2026-07-22 (đợt 6) — Claude — DONE, chờ xác minh độc lập.**
> `D-28`/`DS-027` (Learning Journey Bento, palette `student-*`) **không áp** cho module này — màn giáo viên giữ token dùng chung, ưu tiên mật độ thông tin và thao tác bàn phím (`DS-031`).

---

## 1. Phạm vi thật sự của module

| Màn | Đường dẫn | Trạng thái trước `P17-T3` |
| --- | --- | --- |
| Danh sách học viên cần đánh giá | `/teacher/evaluations` | `page.tsx` (152 dòng) — **chưa từng được redesign** |
| Hồ sơ đánh giá một học viên | `/teacher/evaluations/[id]` | `[id]/page.tsx` (71) + `evaluation-profile.tsx` (**609**) — **chưa từng được redesign** |
| Đánh giá phía học viên | `/student/evaluations` | `redirect()` 12 dòng sang `/student/results?tab=evaluations` — **đã redesign ở M25**, không phát sinh việc |

`03_UIUX_MODULE_INVENTORY.md` ghi `/student/evaluations` là "gộp vào M11/M18 khi làm". Đã đọc file: nó chỉ chuyển hướng, và chú thích trong chính file nói rõ lý do — RPC `publish_evaluation` sinh notification trỏ tới route đó, bỏ đi thì mọi thông báo "Đánh giá học tập mới" thành **404**. Không đụng.

**Bề mặt thật của `P17-T3` là 2 màn / 3 file**, cộng **2 component dùng chung** mà lỗi truy ra tận nơi (mục 2.1 và 2.5).

---

## 2. Bảy phát hiện, đều có bằng chứng chạy được

Baseline đo trước khi sửa: **5 đỏ / 3 xanh** trên `tests/e2e/teacher-evaluations-responsive.spec.ts`.

### `UX-UIUX-M18-001` — 🔴 Bộ chọn lớp là combobox KHÔNG CÓ TÊN (Accessibility, Critical)

axe báo `select-name` mức **critical** (`wcag2a`, `wcag412`, `EN-9.4.1.2`) ngay ở lần chạy đầu:

```
Element does not have inner text that is visible to screen readers
aria-label attribute does not exist or is empty
aria-labelledby ... does not exist
Element does not have an implicit (wrapped) <label>
Element does not have an explicit <label>
html: <button type="button" role="combobox" ... data-slot="select-trigger" ...>
```

**Vì sao "nhìn thấy chữ" vẫn là vô danh.** `SelectTrigger` của Radix render `role="combobox"`. `combobox` **không nằm trong nhóm role lấy tên từ nội dung** (name from content), nên dòng chữ "LOP-01 — HSK 1" hiển thị bên trong **không** trở thành tên gọi được. Đây chính là lý do lỗi này sống sót qua M16 và M17: hai module đó dùng `<select>` gốc và `NativeSelect`, không đụng `ClassPicker`.

**Đo phạm vi bằng script thay vì đoán** — quét toàn `src/`:

| Chỉ số | Số đo |
| --- | --- |
| Tổng `<SelectTrigger>` trong repo | **32** |
| Không có `id`/`aria-label`/`aria-labelledby` | **6** |
| Trong đó thuộc phạm vi `P17-T3` | **1** — `class-picker.tsx:42` |

`ClassPicker` được dùng ở đúng **3 trang**: `/admin/schedule`, `/teacher/evaluations` (**M18**), `/teacher/progress` (**M19**). Sửa một chỗ, sạch cả hai module đang làm.

**Sửa:** `useId()` + `<Label htmlFor>` hiện hình (nhãn "Lớp"), không dùng `aria-label` ẩn — nhãn nhìn thấy được phục vụ cả người dùng sáng mắt (`input-labels`).

**5 chỗ còn lại KHÔNG sửa** vì ngoài phạm vi task (`AGENTS.md` — không ghi đè việc của agent khác): `announcement-manager.tsx:273` (M11), `question-actions.tsx:157` (M16/M17), `invoice-manager.tsx:372,585,606` (M10). Đã ghi vào `07_UIUX_ISSUES_LOG.md`. Đáng chú ý: `question-actions.tsx` thuộc M16/M17 vừa đóng mà spec của hai module đó **không bắt được**, vì `<Select>` ấy nằm trong dialog mà spec không mở — bài học cho `P17-T5`.

### `UX-UIUX-M18-002` — 🔴 Lỗi form không được trình đọc màn hình đọc ra (Accessibility, High)

`FieldError` cũ là `<p className="text-destructive text-xs">` trần: không `role="alert"`, không `id`, và **không ô nhập nào** có `aria-invalid`/`aria-describedby`.

Lỗi ở màn này đến từ **server action sau khi bấm Lưu**, không phải validation của trình duyệt. Không có vùng live thì người dùng bấm Lưu → không nghe gì → tưởng đã lưu xong. Tiền lệ `UX-UIUX-M27-*` đã sửa đúng lỗi này ở `/student/profile`; M18 là chỗ còn dùng bản cũ.

**Bằng chứng E2E** — nhập ghi chú 2 ký tự (qua được `required` của trình duyệt, đụng `min(3)` của Zod ở server): bản cũ không có phần tử `role="alert"` nào.

**Sửa:** `FieldError` có `role="alert"` + `id` + `text-sm`; helper `errorProps()` gắn `aria-invalid`/`aria-describedby` **chỉ khi thật sự có lỗi** — gắn sẵn `aria-invalid="false"` cho mọi ô là đọc ra trạng thái hợp lệ cho cả ô người dùng chưa đụng tới.

Ô ghi chú giữ **cả hai** id trong `aria-describedby` (`note-body-hint note-body-error`): mất câu "Tối thiểu 3 ký tự" đúng lúc có lỗi là mất chính thông tin cần để sửa.

### `UX-UIUX-M18-003` — 🔴 Mỗi bản đánh giá không có heading, và cụm nút trùng tên nhau (Accessibility, High)

`CardTitle` mặc định render `<div>` (đã đọc `card.tsx`: có sẵn `asChild` cho đúng tình huống này). Hồ sơ xếp dọc **nhiều** bản đánh giá → không heading thì không nhảy được giữa các bản, phải cuộn tuần tự.

Nặng hơn: mọi bản đều có `aria-label="Sửa đánh giá"`, `aria-label="Xóa đánh giá nháp"`, nút `Gửi cho học viên` giống hệt nhau. Trình đọc màn hình liệt kê ra N nút **trùng tên**, không cách nào biết nút nào tác động lên bản nào — trong khi Gửi là thao tác **không thu hồi được**.

**Sửa:** `CardTitle asChild` → `<h3>` (trang đã `<h1>`, section đã `<h2>`); mọi tên gọi được kèm ngày đánh giá. Tên mới **vẫn chứa nguyên chữ nhìn thấy** ("Gửi cho học viên bản đánh giá 10/07/2026") nên không phạm WCAG 2.5.3 *Label in Name*.

> ⚠️ Ghi trung thực: bài kiểm chốt việc này lần đầu viết sai. `getByRole(name)` của Playwright khớp **chuỗi con** theo mặc định, nên `name: "Sửa đánh giá"` vẫn khớp `"Sửa đánh giá 10/07/2026"` và phép đếm vô nghĩa. Đã sửa thành `exact: true`. Assertion vẫn bắt được lỗi gốc: code cũ có đúng 2 nút tên **đúng bằng** "Sửa đánh giá" → đỏ.

### `UX-UIUX-M18-004` — 🔴 Dialog nói SAI hậu quả khi sửa bản đã gửi (Business/Content, High)

Dialog sửa đánh giá luôn hiện một câu duy nhất:

> "Lưu form không gửi cho học viên. Gửi là một hành động riêng."

Câu đó **đúng với bản nháp và sai với bản đã gửi**. Truy theo đường dữ liệu:

1. `publish_evaluation` (đọc `prosrc` trong DB) bật `published_at` **và** `visible_to_student`.
2. `updateEvaluationAction` sửa nội dung và **không hạ cờ nào xuống**.
3. `result-queries.ts` phía học viên đọc row có `published_at` **và** `visible_to_student`.

→ Sửa một bản đã gửi thì học viên đọc được bản mới **ngay**, trong khi UI vừa cam đoan điều ngược lại. Nút Sửa lại nằm **ngoài** nhánh `!isPublished` nên bản đã gửi vẫn sửa được.

**Sửa: chỉ đổi CÂU CHỮ, không đổi luật nghiệp vụ.** Bản đã gửi hiện: *"Bản đánh giá này đã gửi rồi — học viên thấy thay đổi ngay khi bạn lưu."* Việc có nên chặn sửa sau khi gửi hay không là **quyết định nghiệp vụ của user**, không phải việc của task UI/UX — đã ghi vào issues log.

### `UX-UIUX-M18-005` — Thông tin nghiệp vụ bị thu nhỏ còn 12px (Readability, Medium)

Đo `getComputedStyle().fontSize` của dòng meta trong roster: **12px**. Dòng đó chứa mã học viên, trạng thái ghi danh, số bản đánh giá và số ghi chú nội bộ — thông tin nghiệp vụ, không phải chú thích trang trí. M25/M26/M27 đã gỡ hết `text-xs` khỏi loại thông tin này; M18 là chỗ còn sót.

Gỡ thêm ở: mã lớp, kỳ đánh giá, chip điểm kỹ năng, nhãn khối nội dung, thời điểm ghi chú, và **câu "Học viên không đọc được ghi chú này."** — câu cuối là hàng rào chống nhầm lẫn "tưởng nội bộ hóa ra chia sẻ", để 12px là sai chỗ nhất.

### `UX-UIUX-M18-006` — Danh sách không phải danh sách; nhãn–giá trị không phải nhãn–giá trị (Semantics, Medium)

- Các bản đánh giá render thẳng ra `<section>`, trong khi panel ghi chú ngay cạnh **đã** là `<ul>/<li>` → hai nửa cùng màn hình không nhất quán. Đổi thành `<ul>/<li>` thật.
- Chip điểm kỹ năng: `<span>` rời → `<ul>/<li>`.
- `TextBlock` là cặp nhãn–giá trị nhưng render hai `<p>` ngang hàng → `<dl>/<dt>/<dd>` (cùng cách M26/M27 đã làm).
- Dấu `*` của trường bắt buộc: trình đọc màn hình đọc thành "sao" hoặc bỏ qua → thêm `<span className="sr-only">(bắt buộc)</span>`, dấu sao thành `aria-hidden`.

### `UX-UIUX-M18-007` — 🔴 Smoke test của chính M18 đã hỏng từ trước, che mất nhánh Gửi (Test integrity, High)

`tests/e2e/evaluation.smoke.spec.ts:92` dùng:

```ts
page.once("dialog", (d) => d.accept());
```

Cách đó chỉ bắt `window.confirm` **gốc của trình duyệt**. Ứng dụng đã chuyển sang `ConfirmationProvider` (AlertDialog của Radix) từ lâu — đã đọc `confirmation-provider.tsx` xác nhận. Nên dòng đó **không bắt gì cả**: hộp xác nhận mở ra, không ai bấm, `publish_evaluation` **không bao giờ chạy**, và toàn bộ assertion phía sau (published_at, visible_to_student, đếm notification, IDOR lớp GV B) **chưa từng được thực thi**.

**Kiểm chứng đây là lỗi có sẵn, không phải regression của `P17-T3`:** `git stash` đúng 4 file đã sửa → chạy lại `evaluation.smoke` trên code gốc → **vẫn đỏ**. Rồi `git stash pop` khôi phục.

**Sửa:** bấm đúng như người dùng thật — mở hộp xác nhận rồi bấm nút xác nhận trong `role="alertdialog"`. Đây **không phải** "sửa test cho nó xanh": hành vi sản phẩm (bắt xác nhận trước một thao tác không thu hồi được) là đúng; bài kiểm mô hình hoá sai cơ chế xác nhận. Sau khi sửa, nhánh Gửi mới thật sự chạy lần đầu.

> Ghi chú phụ: tên gọi được mới ở `UX-UIUX-M18-003` còn tháo một mơ hồ sẵn có — trước đây nút mở và nút xác nhận **cùng tên đúng bằng** "Gửi cho học viên".

---

## 3. Cố ý KHÔNG đổi

| Thứ | Lý do |
| --- | --- |
| Luật "sửa được bản đã gửi" | Quyết định nghiệp vụ của user, không phải việc của task UI/UX. Chỉ sửa câu chữ cho đúng sự thật. |
| `visible_to_student` / `published_at` / RPC `publish_evaluation` | `EX-20` giữ nguyên `learning_evaluations`. Không đụng query/action/RPC/RLS. |
| `/student/evaluations` | Route là **hợp đồng** của notification. Bỏ đi = 404 hàng loạt. |
| 5 `<SelectTrigger>` vô danh ở M10/M11/M16-M17 | Ngoài phạm vi `P17-T3`. Đã ghi issues log. |
| Palette `student-*`, Learning Journey Bento | `DS-031` — không áp cho màn giáo viên. |

---

## 4. Kết quả kiểm tra — số thật

| Bộ kiểm | Trước `P17-T3` | Sau |
| --- | --- | --- |
| `teacher-evaluations-responsive` (Chromium + Pixel 7) | **5 đỏ / 3 xanh** (chromium) | **16/16** |
| `evaluation.smoke` | **2 đỏ** (đã kiểm chứng bằng `git stash`) | **2/2** |
| `report.smoke` (M19 — dùng chung `ClassPicker`) | 2/2 | **2/2** |
| `accessibility-responsive` | 2/2 | **2/2** |
| Vitest | 220/220 | **220/220** |
| lint · typecheck · build | xanh | **xanh** |

**Không migration. Không đổi query/action/RPC/RLS/route/phân quyền/công thức/nhãn nghiệp vụ.**

### Ghi trung thực về độ ổn định

- `accessibility-responsive` đỏ **một lần** trên project `mobile` trong lần chạy tổ hợp đầu tiên, rồi xanh khi chạy riêng và xanh lại ở lần chạy tổ hợp thứ hai → **flake**, không phải lỗi thật.
- Vitest có lần ra 217/220 và 219/220 với lỗi **timeout 5000ms** ở `question-wizard-edit.test.tsx` và một bài của M24 — hai file **không** import bất kỳ file nào `P17-T3` sửa. Chạy riêng: 4/4 xanh. Lần chạy sạch cuối: **220/220**. Nguyên nhân là máy quá tải lúc Docker khởi động lại giữa phiên.
- Một lượt chạy E2E đỏ vì `net::ERR_ABORTED` và `worker process exited (code=1073807364)` — **Docker Desktop tắt hẳn giữa phiên**, không phải lỗi sản phẩm. Đã khởi động lại và chạy lại.

---

## 5. File thay đổi

**Mới:**
- `tests/e2e/teacher-evaluations-responsive.spec.ts` (8 bài × 2 project)
- `uiux-redesign/module-reports/M18_teacher-evaluations.md`

**Sửa:**
- `src/app/(dashboard)/teacher/evaluations/page.tsx`
- `src/features/evaluations/components/evaluation-profile.tsx`
- `src/features/schedules/components/class-picker.tsx` — **tầng dùng chung**, 3 trang
- `src/components/ui/date-picker.tsx` — **tầng dùng chung**, 14 call site / 7 file; thay đổi **thuần cộng thêm** (2 prop tùy chọn `aria-invalid`/`aria-describedby`), không caller nào đổi hành vi
- `tests/e2e/evaluation.smoke.spec.ts`
