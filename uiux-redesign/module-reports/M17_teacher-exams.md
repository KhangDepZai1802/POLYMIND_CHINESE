# M17 — Kiểm tra / Thi (Teacher) · `P17-T2`

> **2026-07-22 (đợt 5) — Claude — DONE, chờ xác minh độc lập.**
> `D-28`/`DS-027` (Learning Journey Bento, palette `student-*`) **không áp** cho module này — màn giáo viên giữ token dùng chung, ưu tiên mật độ thông tin và thao tác bàn phím (`DS-031`).

---

## 1. Phạm vi thật sự của module

| Màn | Đường dẫn | Trạng thái trước `P17-T2` |
| --- | --- | --- |
| Lên lịch thi | `/teacher/exams` | `exam-dashboard.tsx` — **chưa từng được redesign** |
| Bộ đề thi | `/teacher/exams/sets` | Dùng chung `question-builder/components/sets-page.tsx` — **đã làm ở M16** |
| Ngân hàng câu hỏi | `/teacher/exams/question-bank` | Dùng chung `question-bank/components/question-bank-page.tsx` — **đã làm ở M16** |
| Chấm kỳ thi | `/teacher/exams/[deliveryId]` | Dùng chung `assessment-results/components/grading-workspace.tsx` — **chưa từng được redesign** |

Kết luận đã kiểm chứng bằng `git status`: M16 sửa `question-bank-page.tsx` và `sets-page.tsx` nhưng **không** đụng `grading-workspace.tsx`. Vì vậy bề mặt mới của `P17-T2` là **hai** file, và cả hai đều dùng chung với M16 hoặc ảnh hưởng tới M16.

---

## 2. Bảy phát hiện, đều có bằng chứng chạy được

### `UX-UIUX-M17-001` — 🔴 Giờ đóng thi sai múi giờ (Business, High)

`exam-dashboard.tsx:245` dùng `new Date(...).toLocaleString("vi-VN")`. Đây là chỗ `D-12` **cuối cùng** còn lại trong toàn bộ `src/`.

**Bằng chứng 1 — dựng lại trong app.** Fixture đặt `closes_at = 2026-08-14T17:30:00Z`, cố ý vắt qua nửa đêm giờ VN. Bản cũ render:

```
Đóng 00:30:00 15/8/2026
```

Sai định dạng: giây thừa, `HH:mm:ss` đứng trước ngày, `d/M/yyyy` không có số 0 đầu — trong khi `D-12` quy định `dd/MM/yyyy HH:mm`.

**Bằng chứng 2 — đo phần múi giờ bằng Node.** Cùng mốc UTC đó:

| Múi giờ máy giáo viên | `toLocaleString("vi-VN")` hiển thị |
| --- | --- |
| `Asia/Ho_Chi_Minh` | `00:30:00 15/8/26` |
| `Europe/Berlin` | `19:30:00 14/8/26` |
| `America/New_York` | `13:30:00 14/8/26` |

Lệch **hẳn một ngày**. `toLocaleString("vi-VN")` chỉ đổi **ngôn ngữ**, không đổi **múi giờ**.

> ⚠️ Ghi trung thực: máy chạy test đang ở UTC+7 nên trong lần chạy E2E, phần **giờ** trùng nhau — bài E2E bắt được lỗi qua **định dạng**. Phần lệch múi giờ được chứng minh bằng phép đo Node ở trên, không phải bằng lần chạy E2E đó.

**Sửa:** `formatDateTime` như mọi nơi khác trong repo.

### `UX-UIUX-M17-002` — 🔴 Hai landmark `<main>` lồng nhau (Accessibility, High)

`grading-workspace.tsx:223` render `<main>` trong khi `app/(dashboard)/layout.tsx:76` đã có `<main>`. `grep -rn '<main' src/` trả đúng **một** kết quả — chính là chỗ này, tức đây là chỗ duy nhất trong cả repo mắc lỗi.

E2E đếm `page.locator("main")` được **2** trước khi sửa. Dùng chung nên hỏng **cả** màn chấm Bài tập (M16) lẫn màn chấm Thi (M17).

**Sửa:** `<section aria-labelledby="grading-delivery-title">`.

### `UX-UIUX-M17-003` — 🔴 Học viên đang chọn chỉ báo bằng màu (Accessibility, High)

Trong danh sách học viên của màn chấm, mục đang chọn chỉ khác ở `variant` (màu nền), không có `aria-current`/`aria-pressed`. Người dùng trình đọc màn hình bấm qua cả danh sách mà không nút nào tự nói đang được chọn.

Kèm theo: dấu tick "đã chấm xong" là `<svg>` mang `aria-label` nhưng **không có** `role="img"` — phần lớn trình đọc màn hình bỏ qua, nên trạng thái đó cũng chỉ còn là một dấu tick màu xanh. Cả hai đều vi phạm `color-not-only`.

**Sửa:** `aria-current="true"`, `role="img"` cho icon, và bọc danh sách thành `<ul>/<li>` thật.

### `UX-UIUX-M17-004` — Nhóm checkbox lớp không có tên nhóm (Accessibility, High)

`exam-dashboard.tsx:133` — `<Label>` lơ lửng không `htmlFor`, không bọc control. Đúng lỗi M16 đã sửa nhưng màn Thi còn nguyên. Ô tick chỉ có `class="size-4"` → không có vòng focus.

**Sửa:** `<fieldset>/<legend>` + `CHECKBOX_CLASS`.

**Cố ý KHÔNG đổi:** `<input type="checkbox">` gốc của `class_ids`. Gửi nhiều giá trị cùng một tên là **hành vi nghiệp vụ** ("mở cùng kỳ thi cho nhiều lớp"), `DS-003` cấm đổi.

### `UX-UIUX-M17-005` — Bản chép thứ 6 của `<select>` viền mờ (Consistency, Medium)

`exam-dashboard.tsx:166-174` là bản chép **thứ 6** của chuỗi class mà M16 đã gom vào `NativeSelect` — cũng dùng `border` (**1.27:1** trên nền trắng) thay vì `border-input` (**3.39:1**), và `h-9` trong khi thang control `DS-013` cho ô nhập là `h-10`.

### `UX-UIUX-M17-006` — Ngữ nghĩa danh sách, `text-xs`, màu thô (Consistency, Medium)

Danh sách kỳ thi là `<div>` lồng `<div>`; dòng meta (giờ đóng, số bài chờ chấm — thứ giáo viên **quét** để chọn mở kỳ thi nào trước) để `text-xs`; empty state là `<p>` trần. `grading-workspace.tsx` còn `text-xs` ở mã học viên và chú thích thang điểm, cùng `emerald-500`/`amber-600` thô nằm ngoài hệ token.

**Sửa:** `<ul>/<li>`, `text-sm`, `EmptyState`, và token `--success` (#166534, **5.95:1**) / `--warning` (#92400e, **5.88:1**) đã đo sẵn ở `DS-030`.

### `UX-UIUX-M17-007` — Logic gom nhóm chép hai bản (Consistency, Low)

18 dòng gom lần giao theo lớp bị chép **nguyên văn** ở `exercise-dashboard.tsx` (M16) và `exam-dashboard.tsx` (M17): cùng khóa `unassigned`, cùng nhãn "Chưa xác định lớp". Đúng loại lỗi `UX-UIUX-M25-010` — ba bản ô số liệu bento đã **trôi khác nhau ở chỗ nhìn thấy được**. Gom trước khi kịp trôi.

**Sửa:** `features/assessment-results/group-deliveries.ts` + 5 unit test khoá đúng những điểm có thể trôi (thứ tự nhóm, cách dựng nhãn, nhánh chưa gắn lớp).

---

## 3. Xác nhận không đổi nghiệp vụ

Không đổi: query · server action · RPC · RLS · Storage · route · phân quyền · validation · công thức · nhãn nghiệp vụ. **Không có migration.**

- `EX-12` (khung mở/đóng nhiều ngày) giữ nguyên — đã đọc lại `pg_get_constraintdef`, `exam_deliveries` chỉ còn `CHECK (opens_at < closes_at)`.
- `EX-13` (deadline mỗi lượt) không đụng tới.
- Chống lộ đáp án và `ExamIntegrityBoundary` không sửa một dòng.
- `groupDeliveriesByClass` giữ **đúng** thứ tự theo lần xuất hiện đầu tiên, vì thứ tự đó do câu truy vấn quyết định (`DS-003`).

---

## 4. Kết quả kiểm tra thật

| Bộ | Kết quả |
| --- | --- |
| `tests/e2e/teacher-exams-responsive.spec.ts` (mới) | **12/12** — Chromium 6 + Pixel 7 6 |
| `tests/e2e/teacher-exercises-responsive.spec.ts` (M16, chạy lại vì dùng chung) | **16/16** |
| `tests/e2e/accessibility-responsive.spec.ts` | **2/2** |
| `tests/unit/domain/group-deliveries.test.ts` (mới) | **5/5** |
| Vitest toàn bộ | **220/220** (62 file; baseline 215 → **+5**, không sửa/nới/skip test cũ nào) |
| `npm run lint` · `typecheck` · `build` | ✅ ✅ ✅ |

Responsive đo đủ bậc thang **360 / 390 / 430 / 768 / 1024 / 1280** trên cả ba màn; axe `wcag2a/2aa/21a/21aa` sạch ở 360/768/1280.

**Bài kiểm có sức nặng thật:**

- Lên lịch **một kỳ thi THẬT** qua UI (chọn bộ đề, tick lớp, chọn ngày qua lịch) rồi **đọc thẳng DB** xác nhận `duration_minutes|passing_score` = `60|70` — chứng minh giá trị người dùng nhập đi tới server chứ không phải giá trị mặc định của form (45 và 50).
- Bài múi giờ được **kiểm ngược**: tạm khôi phục `toLocaleString` → test đỏ đúng như mong đợi, rồi khôi phục lại bản đã sửa. Test không phải loại "luôn xanh".

Fixture E2E tự dọn (`beforeAll`/`afterAll` + `finally`), dùng dải UUID riêng `e1700000-…` không đụng fixture M16 (`e1600000-…`).

---

## 5. Việc cố ý không làm

- **Không** áp Learning Journey Bento / palette `student-*` — `DS-031` nói rõ đó là student-only.
- **Không** đổi `text-muted-foreground` ở những chỗ ngoài hai file trong phạm vi: đã đo `#5b6b80` trên nền trắng = **5.44:1**, đạt AA — đổi chỉ vì "cho đồng bộ" là churn không có lỗi thật đi kèm.
