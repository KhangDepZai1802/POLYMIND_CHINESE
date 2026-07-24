# M16 — Bài tập (Teacher)

| Field      | Value                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| Module ID  | M16                                                                                          |
| Task       | `P17-T1`                                                                                     |
| Phạm vi    | `/teacher/exercises` · `/teacher/exercises/sets` · `/teacher/exercises/question-bank`         |
| Agent      | Claude                                                                                       |
| Ngày       | 2026-07-22                                                                                   |
| Trạng thái | **DONE — chờ xác minh độc lập** (Claude viết code, không tự ghi Verified)                     |

---

## 1. Ghi chú phạm vi

`DS-031`: **`DS-027` (Learning Journey Bento) không áp cho module này.** Đây là
công cụ làm việc của giáo viên, không phải màn tạo động lực cho học viên. Không
dùng palette `student-sky/cyan/amber/coral`, không hero, không bento trang trí.
Việc cần làm là: gọi được bằng bàn phím và trình đọc màn hình, không tràn ngang,
đọc được số liệu, và **không lệch giờ**.

**Hai file được sửa dùng chung với M17** (`kind="exam"` đi qua đúng component
này): `question-bank-page.tsx` và `ui/native-select.tsx`. M17 sẽ hưởng sẵn phần
sửa này; ngược lại, khi làm M17 phải chạy lại spec M16 để chắc không phá.

---

## 2. Audit — 6 phát hiện, đều có bằng chứng chạy được

| ID                | Mức        | Bằng chứng                                                                                                                     | Xử lý                                                                              |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `UX-UIUX-M16-001` | **High**   | `exercise-dashboard.tsx:279` — `new Date(due_at).toLocaleString("vi-VN")`. Đo thật: máy đặt múi giờ Berlin hiện **15:05**, máy VN hiện **20:05** cho **cùng một hạn nộp**; định dạng ra `20:05:00 22/7/2026` | Dùng `formatDateTime` (ghim `Asia/Ho_Chi_Minh` + `dd/MM/yyyy HH:mm`) — **`D-12`**   |
| `UX-UIUX-M16-002` | **High**   | `/teacher/exercises/question-bank` @360px **tràn ngang 67px**. Truy ra: `div.flex.shrink-0` chứa badge + nút rộng **398px** trong khung 360px — `shrink-0` khoá không cho co nên `flex-wrap` bên trong vô tác dụng | Bỏ `shrink-0`, thêm `min-w-0` + `basis-full sm:basis-auto` để cụm xuống dòng riêng ở màn hẹp |
| `UX-UIUX-M16-003` | **High**   | Form "Giao bộ bài tập": 8 control có `<Label>` **không** `htmlFor`, không bọc control → trình đọc màn hình đọc "combo box"/"spin button" **không tên**. Danh sách lớp là nhóm checkbox nhưng nhãn nhóm chỉ là một `<Label>` lơ lửng | `htmlFor`/`id` cho cả 8 control; nhóm lớp thành `<fieldset>` + `<legend>`           |
| `UX-UIUX-M16-004` | **High**   | Bộ lọc Ngân hàng câu hỏi: ô tìm kiếm chỉ có `placeholder` (mất khi gõ), hai ô chọn **không có tên nào cả**                     | `<Label>` thật cho cả ba; `<form aria-label>`                                       |
| `UX-UIUX-M16-005` | **Medium** | Cùng một chuỗi class `<select>` bị chép ở **6 chỗ** (M16 + M17), cả 6 dùng `border` = `#DDE5EE` **1.27:1** thay vì `border-input` `#7C8DA4` **3.39:1**, và chép cứng `h-9` trong khi ô nhập là `h-10` | Gom thành `ui/native-select.tsx`, `id` là **bắt buộc trong kiểu dữ liệu** để lỗi nhãn không quay lại im lặng |
| `UX-UIUX-M16-006` | **Medium** | Danh sách bài đã giao là `<div>` lồng `<div>`, không phải danh sách; meta (hạn, số bài chờ chấm) để `text-xs`; empty state là một `<p>` trần trong khi cả repo dùng `EmptyState` | `<ul>/<li>` thật + `aria-labelledby` cho từng nhóm lớp; meta lên `text-sm`; dùng `EmptyState` |

---

## 3. Phát hiện KHÔNG sửa — cần user quyết

| ID                | Mức        | Vấn đề                                                                                                                                                                                                                    | Vì sao không tự sửa                                                                                                                        |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `UX-UIUX-M16-007` | **High**   | Chọn "Mở từ" muộn hơn "Hạn nộp" thì giáo viên nhận đúng dòng chữ này: `new row for relation "exercise_deliveries" violates check constraint "exercise_deliveries_check"` — **tiếng Anh, tên constraint của Postgres**. Bắt được khi viết test cho `P17-T1` | Sửa phải đụng `exercises/server/actions.ts` (map lỗi DB sang tiếng Việt) hoặc thêm luật validation ở client. Cả hai đều ngoài phạm vi task UI/UX theo `DS-003`; `DS-022` đã lập tiền lệ là loại này **phải hỏi user trước**. Trái `EX-21` (không lộ chi tiết kỹ thuật ra giao diện) |

> Đề xuất khi user duyệt: map lỗi ở `actions.ts` thành "Hạn nộp phải sau thời điểm mở bài." và **không** thêm luật mới — chỉ nói ra bằng tiếng Việt đúng cái ràng buộc DB đã có.

---

## 4. Cố ý **không** đổi

- **`class_ids` và `allow_late` giữ `<input type="checkbox">` gốc**, không đổi sang `ui/checkbox.tsx` (Radix). `createExerciseDeliveryAction` đọc `formData.getAll("class_ids")` — **gửi nhiều giá trị cùng một tên là hành vi nghiệp vụ** ("giao một lúc cho nhiều lớp"), không phải chuyện trình bày. Chỉ thêm vòng focus + màu, giữ nguyên phần tử.
- Không đổi query, action, RPC, RLS, Storage, route, phân quyền, validation, công thức hay bất kỳ nhãn nghiệp vụ nào. Không migration.
- `assessment-tabs.tsx` (`text-xs` cho số bước) và `step-hint.tsx`: đo lại thấy **đạt AA** (`text-foreground/80` trên nền gợi ý = **7.60:1**) → không sửa, không bịa việc.

---

## 5. Kiểm chứng

| Hạng mục       | Kết quả                                                              |
| -------------- | -------------------------------------------------------------------- |
| E2E M16 (mới)  | **14/14** — Chromium 7/7 + Pixel 7 7/7                               |
| Lint           | ✅                                                                   |
| Type-check     | ✅                                                                   |
| Vitest toàn bộ | **209/209** (60 file) — không đổi so với trước task, không sửa test cũ |
| Build          | ✅                                                                   |
| Fixture        | Tự dọn — 5 bảng đếm cuối đều **0**                                   |

**Bài kiểm quan trọng nhất là bài số 6:** nó giao bài thật, rồi đọc **DB** để
xác nhận `attempt_limit = 2` đúng như đã nhập. Đây là bằng chứng nhóm checkbox
nhiều giá trị và ba ô chọn mới vẫn gửi đúng — không phải suy đoán từ việc dialog
đóng lại.

**Ghi nhận trung thực về lượt chạy:** có **một lượt** `/teacher/exercises/sets`
trả 404 rồi lượt sau xanh lại, không đổi một dòng code nào giữa hai lượt — lỗi
biên dịch nhất thời của `next dev`, không phải lỗi sản phẩm. Ghi ra đây thay vì
im lặng, và **không** dùng nó để bỏ qua bất kỳ test đỏ nào khác.

---

## 6. File thay đổi

| File                                                       | Thay đổi                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `src/components/ui/native-select.tsx`                      | **mới** — `<select>` dùng chung, `id` bắt buộc                   |
| `src/features/exercises/teacher/exercise-dashboard.tsx`    | nhãn, fieldset, `formatDateTime`, `<ul>/<li>`, `EmptyState`      |
| `src/features/question-bank/components/question-bank-page.tsx` | nhãn bộ lọc, sửa tràn ngang, `EmptyState` — **dùng chung với M17** |
| `tests/e2e/teacher-exercises-responsive.spec.ts`           | **mới** — 7 test                                                 |
