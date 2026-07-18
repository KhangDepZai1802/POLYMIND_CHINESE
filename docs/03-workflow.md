# 03 — Workflow nghiệp vụ

> Mô tả các luồng thật của hệ thống, kèm **failure path**. Không có workflow XKLĐ, không có 17/20 bước, không có COE.

---

## 1. Thiết lập chương trình và lớp

```text
Super Admin tạo Level (HSK 1–6 đã seed sẵn)
  → tạo Course: chọn Chương trình cốt lõi/doanh nghiệp
      → cốt lõi: chọn thêm Loại HSK/giao tiếp/thiếu nhi/luyện thi/tùy chỉnh
      → doanh nghiệp: không có Loại
      → DB tự sinh mã khóa học
  → tạo Module → Lesson (giáo trình)
  → tạo Class (lớp triển khai từ Course; DB tự sinh mã lớp)
  → cấu hình sĩ số, số buổi, thời lượng, hình thức, địa điểm
  → gán một giáo viên phụ trách (bắt buộc trước khi kích hoạt)
  → cấu hình lịch lặp  HOẶC  đánh dấu lịch linh hoạt
  → sinh buổi học (generate_class_sessions)
  → ghi danh học viên
  → kích hoạt lớp (status → active)
```

Mã giáo viên và học viên cũng được DB tự sinh khi tạo hồ sơ. Form không nhận mã nghiệp vụ do người dùng tự đặt; sequence + UNIQUE ở DB xử lý an toàn cả khi có nhiều request tạo đồng thời.

**Điều kiện kích hoạt lớp** (`planned → active`), kiểm ở server **và** trigger DB:

- Có `planned_session_count` và `session_duration_minutes`.
- Có đúng 1 giáo viên `primary`.
- Có `start_date`.

**Lịch linh hoạt:** `LOP-01` (Ban Giám đốc VCB) **không có row `class_schedules`**. Buổi học được admin tạo tay từng buổi khi khách hàng chốt lịch. Hệ thống **không** được ép mọi lớp phải có recurrence — đây là yêu cầu nghiệp vụ, không phải thiếu dữ liệu.

**Cách xem buổi học:** mặc định mở tuần chứa buổi sắp tới gần nhất (nếu khóa đã kết thúc thì mở tuần của buổi cuối). Mũi tên trái/phải đổi tuần hoặc tháng; nút “Hôm nay” quay về kỳ hiện tại. `Tối giản` giữ danh sách đầy đủ và các hành động hủy/xóa; `Tuần` cũng cho thao tác ngay trên card buổi; `Tháng` ưu tiên tổng quan, có thể chuyển về tuần/tối giản để thao tác.

**Sinh buổi học — `generate_class_sessions(class_id)`:**

1. Đọc `class_schedules` của lớp (nếu rỗng → trả về 0 buổi, không lỗi).
2. Duyệt từ `start_date`, theo `weekday` của từng schedule, sinh tuần tự tới khi đủ `planned_session_count`.
3. Chuyển giờ địa phương `Asia/Ho_Chi_Minh` → **UTC** khi ghi `starts_at`/`ends_at`.
4. `INSERT ... ON CONFLICT (class_id, session_number) DO NOTHING`.

**Failure path:**

| Tình huống                                   | Xử lý                                                          |
| -------------------------------------------- | -------------------------------------------------------------- |
| Chạy lại lần 2                               | Không sinh buổi trùng (idempotent nhờ UNIQUE + ON CONFLICT)    |
| Lớp chưa có `planned_session_count`          | RAISE EXCEPTION, không sinh gì                                 |
| Lớp không có lịch lặp                        | Trả về 0 buổi, **không phải lỗi**                              |
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

| Tình huống                       | Xử lý                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email đã có tài khoản            | Link hồ sơ vào user cũ (không tạo user mới), báo rõ cho admin                                                                                              |
| Gửi email thất bại               | Rollback link? **Không** — giữ hồ sơ, cho phép "Gửi lại lời mời"                                                                                           |
| Tài khoản bị `is_active = false` | Server guard (`requireUser`/`requireRole`) fail-closed và RLS chặn bằng `app.is_active()`; middleware sign out khi user quay về `/login`. Không chỉ ẩn UI. |
| Quên mật khẩu                    | Supabase Auth reset flow chuẩn; thông báo lỗi login luôn **generic** (không tiết lộ email có tồn tại hay không)                                            |

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

| Trạng thái    | Ý nghĩa                  | Cho phép chuyển tới                               |
| ------------- | ------------------------ | ------------------------------------------------- |
| `pending`     | Đã đăng ký, chưa bắt đầu | `active`, `withdrawn`                             |
| `active`      | Đang học                 | `paused`, `completed`, `withdrawn`, `transferred` |
| `paused`      | Tạm dừng (bảo lưu)       | `active`, `withdrawn`, `transferred`              |
| `completed`   | Hoàn thành khóa          | _(cuối)_                                          |
| `withdrawn`   | Rút học                  | _(cuối)_                                          |
| `transferred` | Đã chuyển sang lớp khác  | _(cuối)_                                          |

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
Giáo viên tạo/version câu hỏi → tạo bộ bài tập → thêm section/câu
  → preview bằng cùng renderer học viên → kiểm tra & khóa version
  → giao cho một hoặc nhiều lớp phụ trách (mỗi lớp một delivery)
  → đặt window, số lượt, late penalty, grading/release mode → publish

Học viên mở delivery của lớp mình → start_attempt idempotent
  → nếu có câu Nói: kiểm tra/cho phép micro ngay trên trang
  → autosave từng câu → resume được → submit idempotent
  → UI khóa nút + báo đang nộp → thành công chuyển sang tab Đã nộp
  → DB chấm tự động phần objective, chuyển phần rubric/essay sang chờ chấm

Giáo viên chấm phần thủ công → DB tính lại tổng
  → công bố theo manual / after_graded / after_due
  → answer key chỉ xuất hiện đúng answer_release_mode
```

**Ba điều kiện để học viên làm/nộp được** (kiểm ở server, RPC và RLS):

1. `enrollment_id` thuộc **chính học viên đó**.
2. Delivery đã publish, đang trong window và còn lượt.
3. Delivery thuộc lớp có enrollment đang hoạt động của học viên.

**Failure path:**

| Tình huống                            | Xử lý                                              |
| ------------------------------------- | -------------------------------------------------- |
| Học viên đọc answer key trước release | RPC payload loại field + RLS answer key trả 0 dòng |
| Start đồng thời                       | Unique attempt + RPC khóa hàng → đúng một lượt     |
| Save/nộp sau deadline                 | RPC fail-closed; không tin đồng hồ client          |
| Giáo viên chấm bài lớp khác           | RLS/RPC `app.teaches_class` chặn                   |
| Bấm Nộp 2 lần                         | RPC idempotent, không chấm hoặc notification trùng |

---

## 6. Kiểm tra/thi và đánh giá tiến độ

```text
Giáo viên tạo và khóa bộ đề thi → tick chọn một hoặc nhiều lớp phụ trách
  → tạo kỳ thi riêng cho từng lớp trong một transaction → lên lịch window (có thể nhiều ngày, EX-12 đã đảo)
  → duration không vượt window → publish
Học viên vào phòng chờ → kiểm tra audio; nếu đề có câu Nói thì kiểm tra micro → xác nhận quy định → start
  → bật chế độ tập trung (ẩn dashboard, thử fullscreen, cảnh báo rời/tải lại)
  → timer dùng deadline DB, autosave, cảnh báo 10/5/1 phút
  → nộp chủ động hoặc pg_cron finalize khi hết hạn/browser đóng
Giáo viên chấm phần thủ công → khóa kết quả → công bố
  → điểm 0–100 + classification + notification dedupe
  → regrade bắt buộc lý do và audit trước/sau
```

**Draft, khóa version, publish delivery, khóa kết quả và publish result là các bước tách biệt.** Học viên chỉ thấy điểm sau release; xếp loại do DB tính từ `grading_scale_rules`. Integrity event chỉ để tham khảo, không tự động kết luận gian lận.

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
Super Admin lưu hóa đơn nháp → save_tuition_invoice(...)
  → tuition_invoices (draft) + tuition_invoice_items trong MỘT transaction
  → DB tính line_total, subtotal và total = subtotal − discount
  → ISSUE → status = 'issued', notification "Hóa đơn mới" tới học viên

Học viên không thấy draft; sau ISSUE mới xem số phải thu + hạn
trên /student/tuition, gồm khoản mục + payment + receipt của chính mình
(KHÔNG tự ghi nhận thanh toán được)

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

| Tình huống                                            | Xử lý                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Ghi payment vượt số phải thu                          | Trigger chặn, trừ khi đi qua flow refund tường minh                           |
| Ghi payment cho invoice draft/paid/cancelled/refunded | RPC từ chối trước khi sinh payment/receipt                                    |
| Client khai sai `line_total` / `total`                | Không nhận hai giá trị này; DB tính lại từ `quantity × unit_amount`           |
| Sửa/xóa hóa đơn đã phát hành                          | RPC từ chối; chỉ draft mới sửa hoặc hard-delete được                          |
| Gọi `record_tuition_payment` 2 lần đồng thời          | Transaction + UNIQUE `payment_id` trên receipts → **không sinh 2 phiếu thu**  |
| Giáo viên cố đọc hóa đơn                              | RLS **DENY** tuyệt đối trên toàn bộ 4 bảng tuition                            |
| Học viên gọi INSERT `tuition_payments`                | Không có policy INSERT cho student → từ chối                                  |
| Quá hạn                                               | Cron đánh dấu `overdue` + notification (có `dedupe_key`, chạy lại không spam) |

---

## 8. Hoàn thành khóa

```text
Hệ thống TÍNH readiness (view v_enrollment_assessment_progress):
    chuyên cần ≥ course.completion_min_attendance_rate  (mặc định 80%)
    điểm TB    ≥ course.completion_min_overall_score    (mặc định 50/100)
    [tùy chọn] đã nộp đủ bài tập engine mới
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

```text
Mọi role mở chuông trên header
  → RLS chỉ trả notifications của chính tài khoản
  → người nhận chỉ UPDATE read_at (không sửa nội dung/link)
  → lưu notification_preferences theo từng type
  → trigger DB bỏ notification mới nếu type đó bị tắt

Super Admin soạn announcement draft
  → chọn toàn hệ thống hoặc một lớp + thời điểm hết hiệu lực
  → PUBLISH qua publish_announcement
      → khóa nội dung + chọn đúng teacher/student audience
      → sinh notification có dedupe_key announcement:{id}
  → giáo viên/học viên chỉ thấy bản đã publish, còn hiệu lực, đúng lớp
  → KẾT THÚC qua expire_announcement; không hard-delete lịch sử
```

| Loại                                              | Kích hoạt bởi             | Người nhận                 |
| ------------------------------------------------- | ------------------------- | -------------------------- |
| `session_upcoming`                                | Cron (trước buổi học)     | Học viên trong lớp         |
| `session_changed`                                 | Đổi/hủy/học bù            | Học viên trong lớp         |
| `assignment_new`                                  | Publish bài tập           | Học viên trong lớp         |
| `assignment_due`                                  | Cron (trước hạn nộp)      | Học viên **chưa nộp**      |
| `assessment_upcoming`                             | Cron                      | Học viên trong lớp         |
| `result_published`                                | Publish điểm/đánh giá     | Học viên có kết quả        |
| `attendance_absent`                               | Điểm danh `absent`/`late` | Học viên đó                |
| `invoice_new` / `invoice_due` / `invoice_overdue` | Phát hành / cron          | Học viên chủ hóa đơn       |
| `announcement`                                    | Super admin publish       | Toàn hệ thống hoặc một lớp |

- Mỗi notification có `link` nội bộ. **Click vào link vẫn phải qua authorization** — link không phải là quyền.
- UI chỉ render link bắt đầu bằng `/` và nằm trong đúng khu vực role; route đích vẫn kiểm role + RLS như mọi truy cập trực tiếp khác.
- Cron dùng `dedupe_key` (vd `assignment_due:{assignment_id}:{user_id}`) → chạy lại **không sinh trùng** (UNIQUE partial index).
- V1 chỉ bắt buộc **in-app**. Email nghiệp vụ là phase sau — nhưng **email invite/reset của Supabase Auth phải hoạt động**.

**Failure path:** cron chạy 2 lần → dedupe chặn. Cron route (`/api/cron/*`) yêu cầu `CRON_SECRET` — thiếu/sai → 401.

---

## 10. Audit

Ghi audit cho: đổi role/khóa tài khoản · sửa hồ sơ GV/HV · sửa course/class/schedule · ghi danh/chuyển lớp/rút học · điểm danh · publish điểm/đánh giá · phát hành hóa đơn/ghi nhận thanh toán · đổi visibility file.

Mỗi dòng: `actor_id` (**actor thật đang đăng nhập**), `actor_role`, `action`, `resource_type`, `resource_id`, `before`/`after` (JSONB), `ip`, `user_agent`, `created_at`.

**Append-only.** Không role app nào update/delete được. **Chỉ super admin đọc.**
