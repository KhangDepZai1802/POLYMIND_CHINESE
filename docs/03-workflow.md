# 03 — Workflow nghiệp vụ

> Mô tả các luồng thật của hệ thống, kèm **failure path**. Không có workflow XKLĐ, không có 17/20 bước, không có COE.

---

## 1. Thiết lập chương trình và lớp

```text
Super Admin tạo Level (HSK 1–6 đã seed sẵn)
  → tạo Course (khóa học/chương trình)
  → tạo Module → Lesson (giáo trình)
  → tạo Class (lớp triển khai từ Course)
  → cấu hình sĩ số, số buổi, thời lượng, hình thức, địa điểm
  → gán giáo viên chính (bắt buộc) + trợ giảng (tùy chọn)
  → cấu hình lịch lặp  HOẶC  đánh dấu lịch linh hoạt
  → sinh buổi học (generate_class_sessions)
  → ghi danh học viên
  → kích hoạt lớp (status → active)
```

**Điều kiện kích hoạt lớp** (`planned → active`), kiểm ở server **và** RPC:
- Có `planned_session_count` và `session_duration_minutes`.
- Có đúng 1 giáo viên `primary`.
- Có `start_date`.

**Lịch linh hoạt:** `LOP-01` (Ban Giám đốc VCB) **không có row `class_schedules`**. Buổi học được admin tạo tay từng buổi khi khách hàng chốt lịch. Hệ thống **không** được ép mọi lớp phải có recurrence — đây là yêu cầu nghiệp vụ, không phải thiếu dữ liệu.

**Sinh buổi học — `generate_class_sessions(class_id)`:**
1. Đọc `class_schedules` của lớp (nếu rỗng → trả về 0 buổi, không lỗi).
2. Duyệt từ `start_date`, theo `weekday` của từng schedule, sinh tuần tự tới khi đủ `planned_session_count`.
3. Chuyển giờ địa phương `Asia/Ho_Chi_Minh` → **UTC** khi ghi `starts_at`/`ends_at`.
4. `INSERT ... ON CONFLICT (class_id, session_number) DO NOTHING`.

**Failure path:**
| Tình huống | Xử lý |
|---|---|
| Chạy lại lần 2 | Không sinh buổi trùng (idempotent nhờ UNIQUE + ON CONFLICT) |
| Lớp chưa có `planned_session_count` | RAISE EXCEPTION, không sinh gì |
| Lớp không có lịch lặp | Trả về 0 buổi, **không phải lỗi** |
| Đã có buổi rồi, tăng `planned_session_count` | Sinh **tiếp** từ `session_number` lớn nhất, không đụng buổi cũ |

---

## 2. Mời tài khoản (invite)

```text
Super Admin tạo hồ sơ giáo viên/học viên (chưa có tài khoản)
  → nhấn "Gửi lời mời" (nhập email)
  → server action (service role, server-only) gọi admin_invite_user
  → Supabase Auth gửi email invite
  → người nhận đặt mật khẩu → đăng nhập lần đầu
  → profiles + teachers/students được link với auth.users.id
```

- **Không có public sign-up.** Route đăng ký không tồn tại.
- Hồ sơ học viên **tạo được trước khi có tài khoản** (`students.user_id` nullable) — trung tâm nhập danh sách lớp trước, mời sau.
- `admin_invite_user` phải **idempotent**: mời lại một email đã tồn tại → link vào tài khoản cũ, không tạo trùng.
- Service role key **chỉ tồn tại ở server environment**. Không `NEXT_PUBLIC_`.

**Failure path:**
| Tình huống | Xử lý |
|---|---|
| Email đã có tài khoản | Link hồ sơ vào user cũ (không tạo user mới), báo rõ cho admin |
| Gửi email thất bại | Rollback link? **Không** — giữ hồ sơ, cho phép "Gửi lại lời mời" |
| Tài khoản bị `is_active = false` | Chặn ở **cả** middleware **lẫn** RLS (`app.is_active()`). Không chỉ ẩn UI. |
| Quên mật khẩu | Supabase Auth reset flow chuẩn; thông báo lỗi login luôn **generic** (không tiết lộ email có tồn tại hay không) |

---

## 3. Ghi danh, tạm dừng, chuyển lớp, rút học

```text
Ghi danh:   enroll_student(student_id, class_id)
              → SELECT ... FOR UPDATE trên classes (khóa hàng)
              → đếm enrollment đang active
              → nếu >= capacity → RAISE EXCEPTION
              → INSERT enrollment (pending/active) + enrollment_status_history + audit
```

**Vì sao phải khóa hàng:** hai admin ghi danh đồng thời vào lớp còn đúng 1 chỗ — kiểm ở tầng app sẽ cho lọt cả hai. Kiểm trong transaction có `FOR UPDATE` mới chặn được.

```text
Chuyển lớp: transfer_enrollment(enrollment_id, to_class_id, reason)
              → kiểm capacity lớp đích (FOR UPDATE)
              → enrollment cũ: status → 'transferred', ended_on = today
              → tạo enrollment mới ở lớp đích
              → ghi 2 dòng enrollment_status_history + audit
              → TẤT CẢ trong MỘT transaction
```

Nguyên tắc bất di bất dịch:
- **Không bao giờ xóa enrollment.**
- Điểm danh, bài nộp, điểm số của lớp cũ **ở lại lớp cũ**. Chuyển lớp **không** tự động mang chúng sang. Nếu nghiệp vụ cần quy đổi → là thao tác riêng, có audit riêng.
- Học phí liên quan xử lý bằng **invoice adjustment / refund** tường minh, **không** sửa trực tiếp số liệu hóa đơn cũ.

| Trạng thái | Ý nghĩa | Cho phép chuyển tới |
|---|---|---|
| `pending` | Đã đăng ký, chưa bắt đầu | `active`, `withdrawn` |
| `active` | Đang học | `paused`, `completed`, `withdrawn`, `transferred` |
| `paused` | Tạm dừng (bảo lưu) | `active`, `withdrawn`, `transferred` |
| `completed` | Hoàn thành khóa | *(cuối)* |
| `withdrawn` | Rút học | *(cuối)* |
| `transferred` | Đã chuyển sang lớp khác | *(cuối)* |

---

## 4. Vận hành một buổi học

```text
Giáo viên mở Dashboard "Hôm nay"
  → thấy các buổi hôm nay + buổi chưa điểm danh
  → chọn buổi → mở roster
  → điểm danh nhanh (Có mặt / Đi muộn / Vắng / Có phép), có nút chọn hàng loạt
  → Lưu  →  bulk_mark_attendance (upsert theo (session_id, enrollment_id))
  → ghi nội dung thực dạy (lesson_log) + đánh dấu bài học đã hoàn thành
  → giao bài tập / tài liệu nếu có
  → "Hoàn tất buổi" → session.status = 'completed'
  → hệ thống cập nhật thống kê + sinh thông báo cho học viên vắng
```

- `marked_by` = **actor đang đăng nhập thật**. Không lấy "user đầu tiên trong DB" — đây là lỗi attribution có thật ở hệ cũ (`BUG_M06_01`, `BUG_M12_01`).
- Bulk attendance là **upsert**, không phải insert. Bấm Lưu 2 lần → vẫn 1 bản ghi/học viên.
- Trigger DB chặn điểm danh cho enrollment **không thuộc lớp của session** — dù server có bug thì DB vẫn giữ.

**Đổi lịch / nghỉ / học bù:**
```text
Buổi gốc: status → 'cancelled' hoặc 'rescheduled' (KHÔNG xóa row)
Buổi bù:  tạo session mới, original_session_id = <buổi gốc>
          → thông báo cho học viên trong lớp
```

---

## 5. Bài tập

```text
Giáo viên tạo bài tập (status = draft, chưa ai thấy)
  → đính kèm file (bucket assignment-files, path do server sinh)
  → đặt due_at, max_score, allow_late_submission
  → PUBLISH  → published_at = now(), status = 'published'
  → notification "Bài tập mới" tới học viên trong lớp

Học viên thấy bài (chỉ khi published_at IS NOT NULL)
  → nộp text và/hoặc file (bucket submissions)
  → hệ thống tự set is_late = (submitted_at > due_at)
  → nếu is_late và allow_late_submission = false → CHẶN

Giáo viên chấm: score (0..max_score) + feedback
  → status = 'graded'
  → notification "Đã có điểm" tới học viên
```

**Ba điều kiện để học viên nộp được** (kiểm ở **cả** server **và** RLS `WITH CHECK`):
1. `enrollment_id` thuộc **chính học viên đó**.
2. Assignment **đã publish**.
3. Assignment thuộc **lớp học viên đang học**.

**Failure path:**
| Tình huống | Xử lý |
|---|---|
| Học viên sửa `score`/`feedback` qua Supabase client trực tiếp | RLS `WITH CHECK` + trigger chặn → 403 |
| Nộp bài cho `enrollment_id` của người khác | RLS chặn (`app.owns_enrollment`) |
| Giáo viên chấm bài của lớp khác | RLS chặn (`app.teaches_enrollment`) |
| File sai định dạng / quá lớn | Server từ chối trước khi upload; whitelist MIME + size |
| Bấm Nộp 2 lần | UNIQUE `(assignment_id, enrollment_id)` → upsert, không sinh 2 bản ghi |

---

## 6. Kiểm tra và đánh giá tiến độ

```text
Giáo viên tạo bài kiểm tra (quiz | midterm | final | mock_hsk | speaking | custom)
  → nhập điểm tổng (0–100) + điểm 6 kỹ năng (nghe/nói/đọc/viết/từ vựng/ngữ pháp)
  → LƯU DRAFT  (published_at = NULL → học viên KHÔNG thấy)
  → review lại
  → PUBLISH  → publish_assessment_results(assessment_id)
       → set published_at
       → trigger tính classification từ grading_scale_rules
       → sinh notification "Kết quả đã công bố"
  → học viên thấy điểm + xếp loại
```

**Draft và publish là hai hành động tách biệt.** Học viên **chỉ** thấy row có `published_at IS NOT NULL` — cưỡng chế bằng **RLS**, không phải bằng `WHERE` ở tầng app (app có thể quên; RLS thì không).

**Xếp loại được server tính**, từ `grading_scale_rules`. Client **không** gửi `classification` lên — nếu gửi cũng bị trigger ghi đè.

```text
Đánh giá định kỳ (tuần/tháng):
Giáo viên tạo learning_evaluation
  → rating 6 kỹ năng (weak | average | good | excellent)
  → strengths, areas_for_improvement, action_plan, teacher_comment
  → chọn visible_to_student = true/false   ← giáo viên chủ động
  → PUBLISH
  → học viên chỉ thấy khi: published_at IS NOT NULL AND visible_to_student = true
```

Ghi chú nội bộ (`student_notes` với `visibility = 'staff_only'`): học viên **tuyệt đối không đọc được** — qua API, qua query trực tiếp, hay qua signed URL.

---

## 7. Học phí

```text
Super Admin phát hành hóa đơn
  → tuition_invoices (draft) + tuition_invoice_items
  → total = subtotal − discount
  → ISSUE → status = 'issued', notification "Hóa đơn mới" tới học viên

Học viên xem số phải thu + hạn (KHÔNG tự ghi nhận thanh toán được)

Super Admin ghi nhận thanh toán → record_tuition_payment(...)
  → MỘT transaction:
      INSERT tuition_payments (amount > 0)
      → tính tổng đã trả
      → cập nhật invoice.status: partial | paid
      → INSERT tuition_receipts (UNIQUE payment_id → đúng 1 phiếu)
      → INSERT notification
  → học viên nhận thông báo + xem được phiếu thu của mình
```

**Số dư = `total − SUM(payments)`**, tính ở view `v_tuition_balance`. **Không có bảng công nợ.** Đây là ranh giới cứng — hệ cũ để nó mọc thành cả module vay/thu nợ.

**Failure path:**
| Tình huống | Xử lý |
|---|---|
| Ghi payment vượt số phải thu | Trigger chặn, trừ khi đi qua flow refund tường minh |
| Gọi `record_tuition_payment` 2 lần đồng thời | Transaction + UNIQUE `payment_id` trên receipts → **không sinh 2 phiếu thu** |
| Giáo viên cố đọc hóa đơn | RLS **DENY** tuyệt đối trên toàn bộ 4 bảng tuition |
| Học viên gọi INSERT `tuition_payments` | Không có policy INSERT cho student → từ chối |
| Quá hạn | Cron đánh dấu `overdue` + notification (có `dedupe_key`, chạy lại không spam) |

---

## 8. Hoàn thành khóa

```text
Hệ thống TÍNH readiness (view v_enrollment_progress):
    chuyên cần ≥ course.completion_min_attendance_rate  (mặc định 80%)
    điểm TB    ≥ course.completion_min_overall_score    (mặc định 50/100)
    [tùy chọn] đã nộp đủ bài tập
  → hiển thị "Đủ điều kiện" / "Chưa đủ điều kiện" + thiếu gì

NGƯỜI xác nhận: super admin HOẶC giáo viên được phân công
  → enrollment.status = 'completed' + history + audit
```

**Máy không tự tốt nghiệp học viên.** Hệ thống chỉ tính và hiển thị; con người bấm nút và chịu trách nhiệm — có audit.

Ngưỡng chỉnh được **trước khi lớp bắt đầu**. **Không sửa hồi tố âm thầm** cho lớp đang chạy (sẽ làm học viên đang đủ điều kiện bỗng thành không đủ).

Lớp/khóa đã `completed` → **read-only**. Sửa hồi tố phải giới hạn và có audit. Chứng chỉ là backlog phase 2.

---

## 9. Thông báo

Một chiều. Không reply, không thread, không chat.

| Loại | Kích hoạt bởi | Người nhận |
|---|---|---|
| `session_upcoming` | Cron (trước buổi học) | Học viên trong lớp |
| `session_changed` | Đổi/hủy/học bù | Học viên trong lớp |
| `assignment_new` | Publish bài tập | Học viên trong lớp |
| `assignment_due` | Cron (trước hạn nộp) | Học viên **chưa nộp** |
| `assessment_upcoming` | Cron | Học viên trong lớp |
| `result_published` | Publish điểm/đánh giá | Học viên có kết quả |
| `attendance_absent` | Điểm danh `absent`/`late` | Học viên đó |
| `invoice_new` / `invoice_due` / `invoice_overdue` | Phát hành / cron | Học viên chủ hóa đơn |
| `announcement` | Super admin publish | Toàn hệ thống hoặc một lớp |

- Mỗi notification có `link` nội bộ. **Click vào link vẫn phải qua authorization** — link không phải là quyền.
- Cron dùng `dedupe_key` (vd `assignment_due:{assignment_id}:{user_id}`) → chạy lại **không sinh trùng** (UNIQUE partial index).
- V1 chỉ bắt buộc **in-app**. Email nghiệp vụ là phase sau — nhưng **email invite/reset của Supabase Auth phải hoạt động**.

**Failure path:** cron chạy 2 lần → dedupe chặn. Cron route (`/api/cron/*`) yêu cầu `CRON_SECRET` — thiếu/sai → 401.

---

## 10. Audit

Ghi audit cho: đổi role/khóa tài khoản · sửa hồ sơ GV/HV · sửa course/class/schedule · ghi danh/chuyển lớp/rút học · điểm danh · publish điểm/đánh giá · phát hành hóa đơn/ghi nhận thanh toán · đổi visibility file.

Mỗi dòng: `actor_id` (**actor thật đang đăng nhập**), `actor_role`, `action`, `resource_type`, `resource_id`, `before`/`after` (JSONB), `ip`, `user_agent`, `created_at`.

**Append-only.** Không role app nào update/delete được. **Chỉ super admin đọc.**
