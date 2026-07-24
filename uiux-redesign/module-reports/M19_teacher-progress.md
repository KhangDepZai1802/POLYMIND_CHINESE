# M19 — Báo cáo lớp · `P17-T4`

> **2026-07-22 (đợt 6) — Claude — DONE, chờ xác minh độc lập.**
> `D-28`/`DS-027` **không áp** — màn giáo viên giữ token dùng chung (`DS-031`). Phạm vi export/biểu đồ theo `DS-037`.

---

## 1. Phạm vi thật sự của module

| Màn | Đường dẫn | Trạng thái trước `P17-T4` |
| --- | --- | --- |
| Báo cáo lớp | `/teacher/progress` | `page.tsx` (297 dòng) — **chưa từng được redesign** |

Đây là module **một màn**. `ClassPicker` của nó đã được sửa sẵn ở `P17-T3` (`DS-036`) — bằng chứng thấy rõ trong baseline: **axe đã xanh ngay từ lần chạy đầu**, trong khi cùng component đó ở M18 từng báo `select-name` mức critical. Impact map của `DS-036` dự đoán đúng.

### Vế "export đúng date range" của Definition of Done — **N/A, có bằng chứng**

`P17-T4` trong `docs/08-phase-plan.md` yêu cầu *"giữ công thức, filter và export đúng date range đang chọn (bài học `BUG_M16_01`)"*. Đã kiểm bằng đọc source, không suy đoán:

| Kiểm tra | Kết quả |
| --- | --- |
| `/teacher/progress` có nút export? | **Không.** Toàn trang chỉ có `ClassPicker`. |
| `/teacher/progress` có bộ lọc thời gian? | **Không.** `searchParams` chỉ nhận `class`. |
| `features/reports/export.ts` phục vụ ai? | **Chỉ báo cáo học phí của Admin** — `AdminTuitionReport`, gọi qua `/api/export/reports`. |
| `getTeacherClassReport` có tham số ngày? | **Không.** Chỉ nhận `classId`. |

→ DoD mô tả một thứ **chưa tồn tại**. Thêm vào là **thêm tính năng**, không phải redesign. **User chốt: không thêm** (`DS-037`). Bài học `BUG_M16_01` được ghi nhận là *chưa áp dụng được* ở module này, chứ không phải *đã thoả*.

---

## 2. Sáu phát hiện baseline + một lỗi tự gây ra rồi tự bắt

Baseline đo trước khi sửa: **6 đỏ / 2 xanh**.

### `UX-UIUX-M19-001` — 🔴 Cả trang chỉ có ĐÚNG MỘT heading (Accessibility, High)

`CardTitle` render `<div>` (xem `card.tsx:41`, đã có sẵn `asChild`). Nên toàn bộ trang — 4 ô số liệu, khối cảnh báo, bảng 7 cột — nằm dưới đúng một `<h1>` của `PageHeader`. Người dùng trình đọc màn hình không nhảy được giữa các khối.

**Sửa:** `CardTitle asChild` → `<h2>` cho ba khối. Cùng cách đã làm ở M18.

### `UX-UIUX-M19-002` — 🔴 Bảng 7 cột: không cuộn được bằng bàn phím, mà cũng không cuộn (Accessibility, High)

Hai lỗi chồng nhau:

1. `<div className="overflow-x-auto">` không có `tabIndex` → người dùng bàn phím không bao giờ tới được các cột bên phải. Đúng lỗi `UX-UIUX-M21-009` đã sửa ở màn học viên.
2. Nhưng đo ra thì ở 360px bảng **không hề cuộn**: `scrollWidth === clientWidth`. Vì `w-full` không có `min-width`, 7 cột bị **bóp** còn ~51px mỗi cột — tiêu đề "Có mặt / Muộn / Vắng" vỡ thành ba dòng. Bảng không tràn, nhưng đọc không nổi.

**Sửa:** `min-w-176` (704px) cho bảng để nó cuộn thay vì bóp, và vùng bọc thành `role="region"` + `aria-label` + `tabIndex={0}` + vòng focus. Hai vế phải đi cùng nhau: cho vùng không bao giờ cuộn một `tabindex` chỉ tạo thêm một chặng Tab vô nghĩa.

### `UX-UIUX-M19-003` — Bảng số liệu thiếu `<caption>` và `scope` (Accessibility, Medium)

7 `<th>` đều không có `scope="col"`, bảng không có `<caption>`. Trình đọc màn hình không gắn được ô dữ liệu với tiêu đề cột của nó.

**Sửa:** `scope="col"` cho cả 7, `<caption className="sr-only">` mô tả bảng.

### `UX-UIUX-M19-004` — Số liệu quyết định can thiệp bị thu về 12px (Readability, Medium)

Đo được **12px** ở dòng meta của khối "Học viên cần chú ý" — nơi ghi tỉ lệ chuyên cần, tiến độ và số bài còn thiếu. Đây chính là số giáo viên dựa vào để quyết định can thiệp. Cùng loại lỗi ở nhãn/gợi ý của 4 ô số liệu, mã học viên và cột "Có mặt / Muộn / Vắng".

**Sửa:** `text-sm` toàn bộ, thêm `tabular-nums` cho mọi cột số để chúng không nhảy chiều rộng khi đổi lớp.

### `UX-UIUX-M19-005` — Không có biểu đồ nào, dù bảng không trả lời được câu hỏi chính (UX, Medium)

`03_UIUX_MODULE_INVENTORY.md` ghi M19 phụ thuộc `Chart, Table` nhưng trang **không có biểu đồ nào**. Quan trọng hơn con số trong inventory: bảng xếp theo **tên**, nên nó không trả lời được câu hỏi giáo viên thật sự hỏi — *"ai đang đuối nhất"*.

**Sửa (`DS-037`, user duyệt):** thêm `AttendanceBars` — thanh ngang chuyên cần theo học viên, **xếp tăng dần**, em thấp nhất nằm trên cùng.

Ràng buộc tự đặt cho mình khi làm:

| Ràng buộc | Cách làm |
| --- | --- |
| Không thêm query/công thức | Dùng đúng `attendance_rate` mà `getTeacherClassReport` đã trả về |
| Không tự đặt ngưỡng "đuối" | Cờ `atRisk` lấy từ `report.atRisk` — tức view `v_at_risk_assessment_students` của DB |
| Không để màu là kênh duy nhất | Mỗi thanh in **số phần trăm** thành chữ; em bị đánh dấu có chữ **"Cần chú ý"** |
| Trình đọc màn hình đọc được | `role="img"` + `aria-label` chứa **kết luận** (thấp nhất/cao nhất là ai, bao nhiêu) và trỏ tới bảng bên dưới làm bản thay thế đầy đủ |
| Không nhầm "chưa biết" với "bằng 0" | `attendance_rate = null` (lớp chưa có buổi nào đã qua) hiện "—" và **xếp xuống cuối**, không chiếm chỗ em thật sự đang đuối |

**Vì sao KHÔNG dùng `recharts`** dù nó có sẵn trong `package.json`: `grep` ra **0 chỗ dùng** trong `src/`. Kéo nó vào sẽ ép `/teacher/progress` từ server component thuần thành client component và cõng một thư viện đồ thị đầy đủ cho đúng một biểu đồ thanh. Repo đã có tiền lệ chặn cứng chuyện này ngay trong `features/reports/export.ts` (*"ExcelJS nặng ~1MB. Chặn cứng ở đây"*). Thanh CSS render trên server: không JS, không hydrate, không layout shift.

**Đo tương phản** (WCAG 1.4.11 yêu cầu ≥3:1 cho thành phần phi văn bản):

| Cặp màu | Tỉ lệ |
| --- | --- |
| `--chart-1` `#1a5fa8` trên rãnh `--muted` `#edf1f7` | **5.71:1** ✅ |
| `--warning` `#92400e` trên rãnh `--muted` | **6.25:1** ✅ |
| Chữ "Cần chú ý" `--warning` trên `--card` trắng | **7.09:1** ✅ |

> Ghi trung thực: rãnh nền so với nền card chỉ **1.13:1**. Rãnh là vạch dẫn, không mang thông tin — con số đã in thành chữ bên cạnh — nên không có dữ liệu nào phụ thuộc việc nhìn thấy rãnh.

### `UX-UIUX-M19-006` — Nhiều nút "Ghi nhận xét" trùng tên (Accessibility, Medium)

Cùng loại lỗi đã sửa ở M18. Tên gọi được nay kèm tên học viên, **vẫn chứa nguyên chữ nhìn thấy** nên không phạm WCAG 2.5.3.

### `UX-UIUX-M19-007` — 🔴 Nhãn "Cần chú ý" bị cắt cụt — **lỗi do chính `P17-T4` gây ra**

E2E **8/8 xanh** rồi, nhưng chụp ảnh 1280px thì thấy:

```
Học viên Demo 2  · Cần ch…      0%
```

Tên và nhãn nằm chung một phần tử `truncate`, cột tên tối đa `12rem` → nhãn bị cắt. Trớ trêu: **đúng cái chữ đóng vai trò thay thế cho màu** lại là cái bị mất.

`toContainText` không bắt được vì DOM vẫn đủ chữ — chỉ CSS cắt. **Sửa:** tách tên (truncate được) khỏi nhãn (`shrink-0`), nới cột lên `18rem`; thêm assertion **đo bề rộng thật** (`scrollWidth > clientWidth`) để khoá.

> Bài học ghi lại: E2E xanh **không thay thế được** việc nhìn ảnh chụp. Lỗi này chỉ lộ ra bằng mắt.

---

## 3. Cố ý KHÔNG đổi

| Thứ | Lý do |
| --- | --- |
| Export + bộ lọc thời gian | `DS-037` — user chốt không thêm; DoD mô tả thứ chưa tồn tại |
| Công thức `formatAttendanceScore`, `attendance_rate`, `progress_percent` | Của DB/domain. Biểu đồ chỉ **vẽ lại** số đã có |
| Ngưỡng "cần chú ý" | Của view `v_at_risk_assessment_students`. Đặt ngưỡng riêng ở UI là tạo nguồn sự thật thứ hai |
| `getTeacherClassReport` | Không thêm một dòng query nào |
| `recharts` | Xem lý do ở `UX-UIUX-M19-005` |

---

## 4. Kết quả kiểm tra — số thật

| Bộ kiểm | Trước `P17-T4` | Sau |
| --- | --- | --- |
| `teacher-progress-responsive` (Chromium + Pixel 7) | **6 đỏ / 2 xanh** (chromium) | **16/16** — và **32/32** với `--repeat-each=2` |
| `report.smoke` | 2/2 | **2/2** |
| `teacher-evaluations-responsive` (M18) | 16/16 | **16/16** |
| `evaluation.smoke` | 2/2 | **2/2** |
| `accessibility-responsive` | 2/2 | **2/2** |
| lint · typecheck · build | xanh | **xanh** |
| Vitest | 220/220 | **218–220/220 — xem ghi chú** |

Tổng lượt chạy E2E cuối cùng của cả M18 + M19 + spec liên quan: **38/38**.

**Không migration. Không đổi query/action/RPC/RLS/route/phân quyền/công thức/nhãn nghiệp vụ.**

### Ghi trung thực — Vitest chưa xanh ổn định

Chạy full suite ra **218/220** ở ba lượt và **220/220** ở một lượt. File đỏ **đổi mỗi lượt**: `question-wizard-edit`, `course-form-dialog`, `wrong-answer-review`, một bài của M24 — luôn là **timeout 5000ms**, không phải sai kết quả.

- **Không** file nào trong số đó import bất kỳ file nào `P17-T3`/`P17-T4` sửa.
- Chạy riêng từng file: **đều xanh** (`course-form-dialog` + `wrong-answer-review` = 6/6; `question-wizard-edit` = 4/4).
- Máy đang chạy Docker + `next dev` + Playwright cùng lúc trong phiên này.

→ Kết luận: **flaky do quá tải, không phải hồi quy** — nhưng đây là nợ kỹ thuật có thật, nên ghi vào issues log cho `P17-T5` thay vì tuyên bố "xanh".

Ngoài ra: một lượt build đỏ vì `Failed to fetch 'Be Vietnam Pro' from Google Fonts` (mạng), chạy lại xanh; một lượt E2E đỏ vì Docker Desktop tắt hẳn giữa phiên, khởi động lại rồi chạy lại xanh. Cả hai là môi trường, không phải sản phẩm.

---

## 5. File thay đổi

**Mới:**
- `src/features/reports/components/attendance-bars.tsx`
- `tests/e2e/teacher-progress-responsive.spec.ts` (8 bài × 2 project)
- `uiux-redesign/module-reports/M19_teacher-progress.md`

**Sửa:**
- `src/app/(dashboard)/teacher/progress/page.tsx`
