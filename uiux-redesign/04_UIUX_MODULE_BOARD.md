# UI/UX Module Board

## Active Task

| Field                  | Value                                                |
| ---------------------- | ---------------------------------------------------- |
| Active Module ID       | **Không có — `P18-T1` / M28 vừa đóng**                                |
| Active Module          | M28 — Xác thực & trang gốc (DONE, chờ xác minh độc lập)               |
| Current Screen/Subtask | `P18-T1` / M28 — 4 màn auth + `/` (N/A có bằng chứng) — **DONE, chờ xác minh độc lập** |
| Status                 | **`P18-T1 DONE — chờ xác minh độc lập`**                              |
| Started At             | 2026-07-22                                                            |
| Last Updated           | 2026-07-23 (đợt 8)                                                    |
| Owner/Agent            | Claude                                                                |
| Report File            | `module-reports/M28_auth.md`                                          |
| Next Exact Action      | **Xác minh độc lập `P18-T2`…`P18-T14`** (Claude viết toàn bộ code đợt 9 nên không tự ghi Verified), rồi **Phase 16 (Flashcard)** — đã hết chặn nhưng **chưa chia task**. `M06 Flashcard (Admin)` hoãn cùng Phase 16. `UX-UIUX-M18-004` giữ `FROZEN`. |

> **Phạm vi mở lại 2026-07-22 (`DS-031`)** — user yêu cầu làm tiếp các module còn lại của `uiux-redesign`, đảo phần "tạm dừng M16–M19" của `DS-026`/`D-27`. Thứ tự: **M16 → M17 → M18 → M19**. ⚠️ `DS-027` (Learning Journey Bento + palette `sky/cyan/amber/coral`) **chỉ dành cho khu vực học viên, không áp cho M16–M19** — bốn module này là màn làm việc của giáo viên, giữ token dùng chung hiện có. M28 và M01–M12 vẫn tạm dừng.
>
> **`P15-T9` đóng 2026-07-22** — soát liên module M20–M27 ở 6 bề rộng (360/390/430/768/1024/1280). Tìm 2 lỗi thật: `UX-UIUX-M21-009` (dải tab `/student/class` cuộn ngang không focus được — ba màn kia đã đúng, chỉ màn này sót) và `UX-UIUX-M25-010` (ô số liệu bento chép 3 bản, đã trôi khác nhau ở `tabular-nums`). Báo cáo: `module-reports/P15-T9_student-quality-gate.md`.
>
> **`P18-T1` / M28 đóng 2026-07-23 (đợt 8)** — user chốt mở lại nhóm Auth + Admin, đảo phần còn lại của `D-27` (`DS-043`). Tìm **7 lỗi thật**, nặng nhất là ba lỗi cấu trúc: **không màn nào có `<main>`**, **cả 4 màn dùng chung một `<h1>`** nên điều hướng bằng heading không phân biệt được trang, và **tiêu điểm biến mất sau khi submit lỗi** (phải bấm 5 lần Tab mới quay lại ô mật khẩu). ⚠️ **Suýt báo động giả lần thứ ba** ở bài tương phản: tính từ hai đầu gradient ra 4.05:1 (hụt AA) nhưng đo điểm ảnh thật sau chữ thì **5.18:1 — đạt**. Hai lỗi do chính đợt này gây ra đều bị test bắt trước khi giao, xem §6 báo cáo. Báo cáo: `module-reports/M28_auth.md`. `DS-041`, `DS-042`, `DS-043`.
>
> **`P17-T5` đóng 2026-07-23 (đợt 7)** — soát liên module M13–M19 ở 6 bề rộng, **gồm cả M14** để đóng nợ `IMPLEMENTED — chờ đo`. Tìm **5 lỗi thật**: `UX-UIUX-M13-010` + `UX-UIUX-M14-020` (tràn ngang 31px/70px do grid item `min-width: auto` — **một nguyên nhân gốc**, đã kiểm chứng trong trình duyệt trước khi sửa), `UX-UIUX-M14-021` (dải 8 tab không focus được — đúng lỗi `UX-UIUX-M21-009` lặp lại ở phía giáo viên), `UX-UIUX-M14-022` (tên lớp bị `truncate` mất hậu tố phân biệt), và `UX-UIUX-M00-019` (**9 spec E2E ghim UUID hàng seed** → vỡ sau mỗi `db reset`; mọi con số "E2E xanh" phiên trước chỉ tái lập được trên DB chưa reset). ⚠️ **Hai lần suýt báo động giả** đều là lỗi ĐO, xem §4.1 báo cáo. Báo cáo: `module-reports/P17-T5_teacher-quality-gate.md`.

> **M00 mở lại rồi đóng lần 2 trong phiên 2026-07-21** — thêm `S06` (thang kích thước control), `S07` (luật 44px cho link), `S08` (xoá dark mode) sau khi user duyệt `DS-013`…`DS-016`.
>
> **M15 đóng trong phiên 2026-07-21** với **4 subtask** thay vì 3: user duyệt `DS-020` (hộp xác nhận cho "Đánh dấu nhanh") nên phát sinh `M15-S04`. Cùng phiên user cũng duyệt `DS-021` (`maxLength={300}`, chạm validation) và `DS-022` (**sửa bug nghiệp vụ `UX-M15-014`** trong `actions.ts` — ngoại lệ có chủ đích của governance §1, không phải tiền lệ). Claude là người sửa `DS-022` nên **bắt buộc Codex xác minh độc lập**.
>
> **M14 đợt 5 (2026-07-21)** — audit xong màn C (+`session-log-form.tsx`), tổng **19 issue**. User duyệt `DS-023` (thêm 8 nhãn `exercise_delivery_status` — _chờ duyệt chữ_), `DS-024` (tab vào `?tab=`, ngoại lệ của `DS-012` chỉ cho M14), `DS-025` (`session-log-form.tsx` vào phạm vi ở mức trình bày). **`UX-M14-002` bị rút lại — báo động giả:** migration `20260716000037` đã `drop column assignment_role` và đặt `unique (class_id)`, mỗi lớp đúng một giáo viên là **quyết định sản phẩm D-22**. User đã duyệt cho Claude sửa issue đó nhưng **không sửa gì** vì bằng chứng sai; tại thời điểm đó không tạo quyết định mới.
>
> **M14 đợt 6 (2026-07-21)** — user duyệt **nguyên bảng 8 nhãn §5.2** (`Q6` đóng) và chốt **để `next-themes` lại** (`Q1` đóng — gỡ sẽ làm bẩn `package-lock.json` trong diff UI/UX đang chờ review). Triển khai đủ **5/5 subtask**, đóng **15/19 issue**. Module dừng ở `IMPLEMENTED` chứ **không** `DONE` vì completion gate còn 2 ô: **responsive chưa đo bằng trình duyệt thật** và **tốc độ đổi tab sau `DS-024` chưa đo** — phiên này không có Docker nên không dựng được trang có dữ liệu. Ghi rõ ở §8 báo cáo M14 thay vì đánh dấu bừa.
>
> **M00 mở lại lần 3 cùng phiên** — user duyệt `DS-017` (viền control thật sự dùng `#7C8DA4`; `UX-M00-002` trước đó mới sửa một nửa) và `DS-018` (error boundary, gỡ `UX-M13-009`). Cả hai là thay đổi tầng shared nên **phải đóng ở M00 trước khi mở M15** — luật "chỉ một module được `IMPLEMENTING`" (`01` §7).
>
> **M24 bị tách đôi 2026-07-22 (`DS-028`)** — user chốt flashcard sẽ đi theo mô hình Quizlet: thẻ là **thuật ngữ + định nghĩa dạng văn bản**, ảnh chỉ tùy chọn, thay cho hai file ảnh **bắt buộc** hiện nay (lý do: ảnh tỉ lệ cứng nên không responsive được). Đó là đổi **mô hình dữ liệu**, `DS-003` cấm làm trong task UI/UX. Nên `P15-T5a` (Ôn câu sai) làm ngay, `P15-T5b` (Flashcard) **hoãn** tới khi user trả lời `Q1`–`Q6` ở [`docs/10-yeu-cau-flashcard-quizlet.md`](../docs/10-yeu-cau-flashcard-quizlet.md) §7. M24 giữ `PARTIAL`, **không** `DONE`.
>
> **Đổi phạm vi 2026-07-22 (`DS-026`, `DS-027`):** user chốt chỉ tiếp tục redesign học viên M20→M27 theo phong cách Learning Journey Bento. M14 giữ nguyên `IMPLEMENTED — chờ đo`; không viết thêm code. M16–M19, M28 và M01–M12 tạm dừng. `P14-T12` đã triển khai player tốc độ audio dùng chung trước khi mở M20.

---

## Board

| Order | Module ID | Module                                                                   | Audit      | Proposal | Implementation   | Responsive      | Lint | Type-check | Build | Final Status                    |
| ----: | --------- | ------------------------------------------------------------------------ | ---------- | -------- | ---------------- | --------------- | ---- | ---------- | ----- | ------------------------------- |
|     1 | **M00**   | **Shared Foundation** (shell, nav, token, thang control, error boundary) | ✅         | ✅       | ✅ 10/10 subtask | ✅              | ✅   | ✅         | ✅    | **DONE** — chờ xác minh độc lập |
|     2 | **M13**   | **Hôm nay (Teacher)**                                                    | ✅         | ✅       | ✅ 3/3 subtask + 1 lỗi `P17-T5` | ✅ 360→1280 đủ 6 mốc (`P17-T5`) | ✅   | ✅         | ✅    | **DONE** — chờ xác minh độc lập |
|     3 | **M15**   | **Điểm danh**                                                            | ✅         | ✅       | ✅ 4/4 subtask   | ✅ 360→1280 đủ 6 mốc (`P17-T5`) — không lộ lỗi mới | ✅   | ✅         | ✅    | **DONE** — chờ xác minh độc lập |
|     4 | **M14**   | **Lớp của tôi (Teacher)**                                                | ✅ 3/3 màn | ✅       | ✅ 5/5 subtask + 3 lỗi `P17-T5` | ✅ 360→1280 đủ 6 mốc (`P17-T5`) | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|     5 | **M16**   | **Bài tập (Teacher)**                                                    | ✅         | ✅       | ✅ 6/6 issue     | ✅ 360→1280     | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|     6 | **M17**   | **Kiểm tra / Thi (Teacher)**                                             | ✅         | ✅       | ✅ 7/7 issue     | ✅ 360→1280     | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|     7 | **M18**   | **Đánh giá & Ghi chú**                                                   | ✅         | ✅       | ✅ 7/7 issue     | ✅ 360→1280     | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|     8 | **M19**   | **Báo cáo lớp**                                                          | ✅         | ✅       | ✅ 7/7 issue     | ✅ 360→1280     | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|     9 | **M20**   | **Tổng quan (Student)**                                                  | ✅         | ✅       | ✅ S01/S02       | ✅ 360/768/1280 | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    10 | **M21**   | **Lớp của tôi (Student)**                                                | ✅         | ✅       | ✅ S01→S04       | ✅ 360/768/1280 | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    11 | **M22**   | **Bài tập (Student)**                                                    | ✅         | ✅       | ✅ S01→S04       | ✅ 360/768/1280 | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    12 | **M23**   | **Kiểm tra / Thi (Student)**                                             | ✅         | ✅       | ✅ S01→S04       | ✅ 360/768/1280 | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    13 | **M24**   | **Ôn tập** (Ôn câu sai ✅ · Flashcard ⏸)                                  | ✅ ½       | ✅ ½     | ✅ S01→S04       | ✅ 360/768/1280 | ✅   | ✅         | ✅    | **PARTIAL — Flashcard hoãn (`DS-028`)** |
|    14 | **M25**   | **Kết quả**                                                              | ✅         | ✅       | ✅ S01→S09       | ✅ 360/768/1280 | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    15 | **M26**   | **Học phí (Student)**                                                    | ✅         | ✅       | ✅ S01→S08       | ✅ 360/768/1280 | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    16 | **M27**   | **Hồ sơ**                                                                | ✅         | ✅       | ✅ S01→S07       | ✅ 360/768/1280 | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    17 | **M28**   | **Xác thực & trang gốc**                                                 | ✅         | ✅       | ✅ 7/7 lỗi      | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    18 | **M01**       | **Tổng quan (Admin)**                                                        | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    19 | **M02**       | **Học viên**                                                                 | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    20 | **M03**       | **Giáo viên**                                                                | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    21 | **M04**       | **Khóa học**                                                                 | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    22 | **M05**       | **Lớp học**                                                                  | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    23 | M06       | Flashcard (Admin)                                                        | ⏸         | ⏸       | ⏸               | ⏸              | ⏸   | ⏸         | ⏸    | **HOÃN tới sau Phase 16 (`DS-043`)** |
|    24 | **M07**       | **Lịch học**                                                                 | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    25 | **M08**       | **Học phí (Admin)**                                                          | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    26 | **M09**       | **Báo cáo**                                                                  | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    27 | **M10**       | **Duyệt câu hỏi**                                                            | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    28 | **M11**       | **Thông báo**                                                                | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |
|    29 | **M12**       | **Quản trị & Audit**                                                         | ✅         | ✅       | ✅ 9/9 lỗi       | ✅ 360→1280 đủ 6 mốc | ✅   | ✅         | ✅    | **DONE — chờ xác minh độc lập** |

Ký hiệu:

- `⬜` Chưa làm
- `🟨` Đang làm
- `✅` Hoàn thành
- `⛔` Bị chặn
- `➖` Không áp dụng, phải có lý do

---

## Phase 0 — đã hoàn tất

| Bước                  | Kết quả                                   | Bằng chứng                                                               |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| Khảo sát kỹ thuật     | ✅                                        | `02_UIUX_DESIGN_SYSTEM.md` §1 — 17 hạng mục, mỗi hạng mục có dòng source |
| Xác định màu chủ đạo  | ✅ `#1A5FA8`                              | `02` §2 — đọc từ `globals.css`, không đoán                               |
| Audit contrast token  | ✅ 13 cặp đo bằng công thức WCAG          | `02` §3.1 — tìm ra 2 lỗi thật                                            |
| Thang màu 50–950      | ✅ `primary-600` khớp chính xác `#1A5FA8` | `02` §3.2                                                                |
| Module inventory      | ✅ 29 module + 8 shared component         | `03_UIUX_MODULE_INVENTORY.md`                                            |
| Design system         | ✅ §4–§15                                 | `02`                                                                     |
| Module board + thứ tự | ✅                                        | File này + `DS-002`                                                      |
| Sửa code UI           | ➖ **Không** — Phase 0 cấm sửa UI         | `git status` chỉ có file `uiux-redesign/*`                               |

---

## Quy tắc cập nhật

Cập nhật ngay khi:

- Bắt đầu module.
- Hoàn thành audit.
- Hoàn thành proposal.
- Hoàn thành từng màn hình.
- Phát hiện blocker.
- Chạy lint/type-check/build.
- Hoàn thành module.

Không đợi cuối session mới cập nhật.

---

## Module Completion Gate

Trước khi đổi `Final Status` sang `DONE`, xác nhận:

- [ ] Tất cả màn hình trong phạm vi đã hoàn thành.
- [ ] Báo cáo module đã cập nhật.
- [ ] Responsive đã kiểm tra ở cả 3 tầng (360–430 / 768–1024 / 1280+).
- [ ] Loading/empty/error/disabled/success đã xử lý hoặc ghi N/A kèm lý do.
- [ ] Keyboard focus đã kiểm tra.
- [ ] Không thay business logic/API/route/database/permission/validation/nhãn.
- [ ] Nếu có sửa shared component: đã liệt kê nơi sử dụng và ghi impacted modules.
- [ ] Lint pass (`npm run lint`).
- [ ] Type-check pass (`npm run typecheck`).
- [ ] Test pass (`npm test`) — baseline hiện tại có 173 test Vitest, không được để đỏ.
- [ ] Build pass (`npm run build`).
- [ ] Changelog cập nhật.
- [ ] Checkpoint trỏ sang hành động kế tiếp.
