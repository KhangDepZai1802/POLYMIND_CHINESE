# MODULE QA BOARD — POLYMIND CHINESE

> Bảng điều phối QA giữa **Claude (QA/Verify)** và **Codex (Fix)**. Nguồn sự thật về trạng thái QA từng module.
> Đọc cùng [`WORKLOG.md`](../../WORKLOG.md). **Không dựa vào trí nhớ phiên trước** — mọi trạng thái nằm ở đây.

- **Hệ thống:** POLYMIND CHINESE — quản lý học viên tiếng Trung (Next.js App Router + TypeScript strict + Supabase Auth/Postgres/Storage + Vercel).
- **Kiến trúc:** `src/features/*/server` (nghiệp vụ) · `src/lib/domain` (business rule thuần, có unit test) · RLS ở DB là **chốt chặn cuối**.
- **Test:** Vitest (unit/component) · pgTAP (constraint + RLS/IDOR) · Playwright (E2E 3 role).

---

## Chú thích trạng thái

- **QA Status:** `Pending` · `Analyzing` · `Test Cases Ready` · `Automated Tests Ready` · `Bugs Found` · `No Confirmed Bugs` · `Completed` · `Blocked`
- **Fix Status:** `Not Required` · `Waiting for Codex` · `Investigating` · `Fixed` · `Cannot Reproduce` · `Blocked` · `Needs Requirement Clarification`
- **Verification:** `Not Started` · `Waiting for Fix` · `Verifying` · `Verified` · `Partially Verified` · `Failed` · `Blocked`

> **Luật vàng:** người **fix** không được tự ghi `Verified`. Phải để agent kia **xác minh độc lập** — đọc diff, chạy test, dựng lại kịch bản lỗi. Đó là toàn bộ giá trị của mô hình này.

---

## Bảng module (sắp theo dependency + rủi ro)

|   # | ID  | Module                        | Phạm vi                                                                                            | Phase      | Rủi ro       | QA             | Fix          | Verification |
| --: | --- | ----------------------------- | -------------------------------------------------------------------------------------------------- | ---------- | ------------ | -------------- | ------------ | ------------ |
|   1 | M01 | Authentication & Session      | Login, logout, forgot/reset password, accept-invite, middleware, session cookie SSR                | P1         | **Critical** | Pending        | Not Required | Not Started  |
|   2 | M02 | Authorization & RLS           | `app.*` helper, RLS policy toàn bộ bảng, fail-closed, IDOR                                         | P2         | **Critical** | Pending        | Not Required | Not Started  |
|   3 | M03 | User & Account Management     | Invite (service role, server-only), khóa/mở tài khoản, đổi role, `profiles`                        | P1, P3     | **High**     | Pending        | Not Required | Not Started  |
|   4 | M04 | Students                      | CRUD hồ sơ, guardian (field, **không phải role**), link tài khoản                                  | P3         | High         | Pending        | Not Required | Not Started  |
|   5 | M05 | Teachers                      | CRUD hồ sơ, `teacher_code`, phân công lớp                                                          | P3         | Medium       | Pending        | Not Required | Not Started  |
|   6 | M06 | Courses & Curriculum          | Level, Course, Module, Lesson, Materials                                                           | P3         | Medium       | **Bugs Found** | **Fixed**    | Not Started  |
|   7 | M07 | Classes                       | Lớp triển khai, sĩ số, hình thức, địa điểm, một GV phụ trách                                       | P3, P7     | High         | Pending        | Not Required | Not Started  |
|   8 | M08 | Schedules & Sessions          | Lịch lặp, **sinh buổi idempotent**, đổi lịch/học bù, lớp linh hoạt                                 | P3, P4     | **High**     | **Bugs Found** | **Fixed**    | Not Started  |
|   9 | M09 | Enrollments                   | Ghi danh (**capacity race**), tạm dừng, **chuyển lớp giữ lịch sử**, rút, hoàn thành                | P3         | **High**     | Pending        | Not Required | Not Started  |
|  10 | M10 | Attendance                    | Bulk upsert (**không sinh trùng**), class-match trigger, attribution actor thật                    | P4         | **High**     | Pending        | Not Required | Not Started  |
|  11 | M11 | Assignments & Submissions     | Draft/publish, hạn nộp, nộp text/file, chấm điểm, **HV không sửa được score**                      | P4, P5     | **High**     | **Bugs Found** | **Fixed**    | Not Started  |
|  12 | M12 | Assessments & Evaluations     | Điểm 0–100 + 6 kỹ năng, **draft ≠ publish**, xếp loại từ grading scale, `student_notes` staff_only | P4         | **High**     | **Bugs Found** | **Fixed**    | Not Started  |
|  13 | M13 | Progress & Completion         | View tiến độ (tính, không nhập tay), readiness, xác nhận hoàn thành có audit                       | P4, P5     | Medium       | Pending        | Not Required | Not Started  |
|  14 | M14 | Tuition                       | Invoice/payment/**receipt duy nhất**, số dư = tính ra, **teacher DENY toàn bộ**                    | P6         | **High**     | Pending        | Not Required | Not Started  |
|  15 | M15 | Notifications & Announcements | In-app một chiều, **dedupe cron**, link có authorization                                           | P6         | Medium       | Pending        | Not Required | Not Started  |
|  16 | M16 | Reports & Export              | Báo cáo theo scope, **export giữ đúng filter đang chọn**                                           | P6         | Medium       | Pending        | Not Required | Not Started  |
|  17 | M17 | Dashboards                    | 3 dashboard theo role, KPI từ view                                                                 | P3–P5      | Low          | Pending        | Not Required | Not Started  |
|  18 | M18 | Storage & Files               | 5 private bucket, **object_path do server sinh**, signed URL ngắn hạn, IDOR file                   | P2, P4, P5 | **High**     | **Bugs Found** | **Fixed**    | Not Started  |
|  19 | M19 | Audit Log                     | Append-only, **chỉ super admin đọc**, actor thật                                                   | P6         | Medium       | Pending        | Not Required | Not Started  |
|  20 | M20 | Security & Deployment         | Headers, rate limit, upload abuse, env/secret, production seed, RLS trên cloud                     | P7         | **High**     | Pending        | Not Required | Not Started  |

**Trạng thái:** chưa bắt đầu đợt QA module toàn diện. Bug phát hiện trong lúc build được ghi ngay vào Verification Queue để không mất dấu.

---

## Handoff Queue (bug đang chờ fix)

_(trống — chưa có code)_

| #   | Bug ID | Module | Severity | Khu vực nghi ngờ | Trạng thái |
| --- | ------ | ------ | -------- | ---------------- | ---------- |
| —   | —      | —      | —        | —                | —          |

---

## Verification Queue (fix đang chờ xác minh độc lập)

| Bug ID         | Module   | Fix của Codex                                                                                                                                                                                                                        | Trạng thái                                    |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| UX-M11-M12-001 | M11, M12 | Đồng bộ builder Bài tập/Thi: đánh dấu câu đã chọn theo câu gốc, bắt buộc nhập điểm, preview modal cuộn, tổng điểm giao bài lấy từ bộ; kỳ thi tick nhiều lớp qua RPC transaction; thay toàn bộ native confirm bằng dialog theo theme. | ⏳ Chờ Claude xác minh UI độc lập             |
| UX-M11-M12-002 | M11, M12 | Nộp bài có loading + kiểm lỗi lưu cuối + toast + chuyển tab Đã nộp; preflight micro theo câu Nói; chế độ tập trung khi thi ẩn dashboard/cảnh báo rời trang; ngân hàng câu hỏi dùng thao tác Chỉnh sửa nhưng vẫn giữ version lịch sử. | ⏳ Chờ Claude xác minh UI và thiết bị độc lập |
| UX-M11-M12-003 | M11, M12 | Màn chấm bỏ JSON/enum/thuật ngữ kỹ thuật; câu trống là Chưa chấm, cảnh báo sót và một nút lưu bulk atomic; delivery gọn theo lớp; kết quả học viên hiển thị nội dung dễ đọc; sửa header `microphone=(self)` và chẩn đoán policy. | ⏳ Chờ Claude xác minh UI, bulk save và micro trên bản deploy |

### Đã xác minh độc lập

| Bug ID      | Module   | Fix của Codex                                                                                                                                                   | Xác minh của Claude                                                                                                                                                                                                                                                                                                                                                                                                                     | Trạng thái      |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| BUG-M08-001 | M08      | `getSessionLog` fail-fast khi route param không phải UUID → `notFound()` thay vì gửi chuỗi rác xuống Postgres và trả 500.                                       | **(2026-07-14, phiên 18) Góc soi riêng, không chạy lại test của Codex.** Rủi ro thật của một guard **không phải** "URL rác còn 500" mà là **guard chặn nhầm đường đi đúng** — nên kiểm đủ 3 ca: (a) 4 URL rác (`khong-phai-uuid`, `123`, `../etc`) → **404**, không 500; (b) UUID **hợp lệ nhưng của lớp GV B** → vẫn **404** (guard không nới lỏng IDOR); (c) **REGRESSION**: buổi học của chính GV A → **200** và render đúng LOP-02. | ✅ **Verified** |
| BUG-M11-002 | M11      | `getSubmissionGradingBoard` fail-fast khi route param không phải UUID → `notFound()` thay vì 500.                                                               | **(2026-07-14, phiên 18)** Cùng bộ 3 ca như trên: URL rác → **404**; assignment của chính GV A → **200**, hiện đúng bảng chấm bài. Đường đi đúng không bị guard chặn nhầm.                                                                                                                                                                                                                                                              | ✅ **Verified** |
| BUG-M06-001 | M06, M18 | Upload tài liệu ở cấp khóa học chấp nhận `module_id`/`lesson_id` không được gửi; mở server action tài liệu cho teacher rồi để RLS khoanh course được phân công. | _(2026-07-14, phiên 14)_                                                                                                                                                                                                                                                                                                                                                                                                                | ✅ **Verified** |
| BUG-M11-001 | M11      | Trigger khởi tạo submission chuẩn hóa mọi user flow có `auth.uid()` (kể cả super admin), không chỉ role student.                                                | _(2026-07-14, phiên 14)_                                                                                                                                                                                                                                                                                                                                                                                                                | ✅ **Verified** |

> Chi tiết bằng chứng của `BUG-M06-001` và `BUG-M11-001`: xem `WORKLOG.md` phiên 14.

---

## Điểm rủi ro cao — QA phải soi kỹ (rút từ bug có thật ở POLYMIND APP)

| #    | Rủi ro                                                                                       | Module        | Bug tương ứng ở hệ cũ                                             |
| ---- | -------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| R-1  | **Race condition ghi danh vượt sĩ số** — kiểm ở app thay vì `FOR UPDATE` trong transaction   | M09           | — (thiết kế mới chặn sẵn)                                         |
| R-2  | **Idempotency chỉ ở app-level** → bulk attendance / sinh buổi / receipt bị trùng khi gọi lại | M08, M10, M14 | `BUG_M09_01` (trả hoa hồng 2 lần vì thiếu unique index)           |
| R-3  | **Attribution sai** — `created_by`/`marked_by` lấy "user đầu tiên" thay vì actor thật        | M04, M10, M14 | `BUG_M06_01`, `BUG_M12_01`                                        |
| R-4  | **Fail-open trong hàm phân quyền** — nhánh `return true` mặc định                            | M02           | `CR-M14-3` (`MessagingPolicy.CanMessage` → "nhắn loạn xạ")        |
| R-5  | **Nhiều đường ghi cho cùng một hành động** → lệch trạng thái                                 | M14           | `BUG_M10_01` (3 đường set `Payment→Paid`)                         |
| R-6  | **Export bỏ qua filter đang chọn**                                                           | M16           | `BUG_M16_01`                                                      |
| R-7  | **Dữ liệu chưa publish bị lộ** cho học viên                                                  | M11, M12      | — (thiết kế mới cưỡng chế bằng RLS)                               |
| R-8  | **IDOR qua object_path / signed URL**                                                        | M18           | `OBS-M18-01/02/03`                                                |
| R-9  | **Teacher đọc được tuition/audit**                                                           | M14, M19      | `CR-M16-1`, `CR-M17-1` (KPI tài chính lộ cho role không được xem) |
| R-10 | **Service role dùng cho user flow** → vô hiệu hóa toàn bộ RLS                                | M02, M03      | — (luật cứng ở `AGENTS.md`)                                       |

---

## Cấu trúc hồ sơ mỗi module

Khi bắt đầu QA một module, tạo `docs/testing/modules/<ID>-<tên>/`:

```text
01-analysis.md            Phân tích scope + luồng + điểm rủi ro
02-business-flows.md      Luồng nghiệp vụ chi tiết
03-test-cases.md          Test case (gồm negative path + IDOR)
04-traceability.md        Ánh xạ requirement ↔ test case
05-automation-report.md   Test tự động: lệnh chạy + kết quả THẬT (pass/fail)
06-bug-report.md          Bug tìm được → chuyển Codex
07-fix-report.md          Codex ghi: sửa gì, file nào, test gì
08-verification-report.md Claude xác minh ĐỘC LẬP → Verified / Failed
```
