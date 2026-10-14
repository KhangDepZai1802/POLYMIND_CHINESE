# 03 — Workflow nghiệp vụ

## Xếp lịch lặp và sinh buổi B2C (2026-10-14)

Chi tiết lớp → Lịch học → Lịch lặp & sinh buổi → thứ/giờ/từ ngày/đến ngày/phòng tùy chọn → kiểm số buổi dự kiến → Lưu lịch & sinh buổi. Xem lịch đã lưu và các buổi có nhãn Sinh từ lịch lặp, phòng hoặc Chưa xếp phòng. Sinh lại cùng kế hoạch bỏ qua buổi đã có, không hồi sinh buổi hủy. Conflict lớp/phòng/khác buổi cũ hiển thị lỗi và không lưu phần nào. Tên phòng cần ghi cùng cơ sở, nhất quán.

GV → Hôm nay/chi tiết lớp → lịch buổi thực tế kèm phòng, không lặp thêm dòng lịch tuần cũ. Hủy buổi cập nhật Hôm nay; không thay lương/chấm công. Buổi tự sinh giữ ngày/giờ gốc, hủy và thêm buổi bù khi thay đổi; không sửa đè lịch sử đã điểm danh.

## Giáo viên mở lớp B2C (2026-10-14)

Hôm nay → Lịch dạy hôm nay hiện thêm lớp B2C có thứ trùng ngày Việt Nam (active, đã khai giảng). Ví dụ Starter Hero T2-T4 hiện vào thứ Tư, kèm giờ18h-19h30 và nút Xem lịch lớp. Dòng Theo lịch tuần là dự kiến; lịch lớp vẫn giữ các buổi cụ thể do quản lý tạo. Không sinh chấm công/điểm danh/lương khi tải trang.

Đăng nhập giáo viên → trang Hôm nay có thẻ Lớp trung tâm B2C → bấm lớp hoặc vào Lớp của tôi → xem Học viên / Lịch học / Nhận xét. Học viên tìm theo mã/tên, 25 dòng/trang. Lớp không phân công trả trang404 kể cả dán URL. Thiếu liên kết tài khoản, GV bị khóa/ngưng hoạt động hoặc tên phân công không khớp duy nhất thì không cấp quyền. B2B vẫn dùng luồng cũ. Không tạo lịch buổi tự động từ chuỗi lịch tuần; lịch trống khi quản lý chưa tạo buổi.

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

**Cách xem buổi học:** admin, giáo viên trong tab `Lịch / Buổi` của lớp và học viên tại `Lịch học` dùng chung ba chế độ. Mặc định mở tuần chứa buổi sắp tới gần nhất (nếu khóa đã kết thúc thì mở tuần của buổi cuối). Mũi tên trái/phải đổi tuần hoặc tháng; nút “Hôm nay” quay về kỳ hiện tại. `Tối giản` giữ danh sách đầy đủ; admin giữ hành động hủy/xóa, giáo viên mở nhật ký buổi, học viên xem kết quả điểm danh đã có. `Tuần` giữ các thao tác phù hợp vai trò ngay trên card; `Tháng` ưu tiên tổng quan, có thể chuyển về tuần/tối giản để thao tác.

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
- Sau đăng nhập, middleware/server guard dùng `getClaims()` để xác minh JWT ES256 mà không gọi Auth server lặp lại; sau đó vẫn đọc `profiles.role` + `profiles.is_active`. Claims hợp lệ nhưng profile thiếu/bị khóa/role lạ → deny; RLS tiếp tục chặn ở DB.

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
- Điểm chuyên cần hiển thị theo thang 10: `max(0, 10 - absent_count × 0,5)`. Chỉ bản ghi `absent` bị trừ; `late` và `excused` vẫn được thống kê riêng nhưng không làm giảm điểm này.

**Đổi lịch / nghỉ / học bù:**

```text
Manager chọn buổi scheduled cần nghỉ + ngày/giờ bù + lý do
  → RPC khóa lớp và chuỗi session từ buổi nghỉ tới cuối khóa
  → từ chối nếu buổi/chuỗi đã dạy, có điểm danh, ngày bù không ở sau ngày nghỉ
    hoặc trùng lịch lớp/giáo viên
  → bỏ time slot ngày nghỉ, thêm time slot ngày bù, sắp thời gian tăng dần
  → gán lại time slot trên CHÍNH các row hiện hữu
  → tổng row, ID, session_number 1…N, bài học/nội dung/điểm danh không đổi
  → ghi class_session_schedule_changes + audit + một thông báo cho học viên
```

Hủy hẳn buổi và xóa buổi sinh nhầm là luồng riêng. Không xóa rồi “Thêm buổi” để học bù; thao tác thêm tay chỉ dành cho lớp linh hoạt còn thiếu so với `planned_session_count`, và DB chặn mọi `session_number > planned_session_count`.

---

## 5. Bài tập

```text
Giáo viên tạo/version câu hỏi → tạo bộ bài tập → thêm section/câu
  → nếu là câu Nghe: server cấp vé, browser upload MP3/M4A thẳng vào Storage, server xác minh rồi gắn media
  → preview bằng cùng renderer học viên → kiểm tra & khóa version
  → giao cho một hoặc nhiều lớp phụ trách (mỗi lớp một delivery)
  → đặt window, số lượt, late penalty, grading/release mode → publish

Học viên mở delivery của lớp mình → bấm bắt đầu: UI khóa nút + báo đang mở → start_attempt idempotent
  → audio đề được ký URL private chỉ khi question thuộc đúng lượt đang mở của học viên
  → nếu có câu Nói: kiểm tra/cho phép micro ngay trên trang
  → autosave từng câu; dừng thu âm thì browser upload thẳng Storage bằng vé ký, server xác minh rồi gắn đáp án
  → resume được → chỉ cho submit khi mọi bản ghi đang thu/tải đã lưu → submit idempotent
  → UI khóa nút + báo đang nộp → thành công chuyển sang tab Đã nộp
  → DB chấm tự động phần objective, chuyển phần rubric/essay sang chờ chấm

Giáo viên mở từng học viên → câu thủ công chưa có điểm hiện "Chưa chấm"
  → audio đề Nghe/Chép và bản ghi câu Nói đều được ký theo delivery/lớp để nghe ngay trong màn chấm
  → nhập điểm/nhận xét cho nhiều câu → bấm một nút lưu toàn bộ phần đã nhập
  → nếu còn sót: cảnh báo, giữ các câu đó ở "Chưa chấm" và chặn công bố
  → RPC bulk lưu atomic → DB tính lại tổng → giáo viên vẫn ở học viên hiện tại để kiểm tra
  → công bố theo manual / after_graded / after_due
  → học viên xem kết quả vẫn nghe được audio đề của đúng attempt và bản ghi Nói của chính mình
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
| Học viên đổi path audio sang lượt khác | Metadata + Storage RLS fail-closed, không ký URL   |
| Blob audio vượt giới hạn Server Action | Không đi qua action; direct upload rồi kiểm 25 MB  |

---

## 6. Kiểm tra/thi và đánh giá tiến độ

```text
Giáo viên tạo và khóa bộ đề thi → tick chọn một hoặc nhiều lớp phụ trách
  → tạo kỳ thi riêng cho từng lớp trong một transaction → lên lịch window (có thể nhiều ngày, EX-12 đã đảo)
  → duration không vượt window → publish
Học viên vào phòng chờ → kiểm tra audio; nếu đề có câu Nói thì kiểm tra micro → xác nhận quy định → start
  → MP3 đề chỉ được ký khi câu thuộc đúng lượt thi `in_progress` và còn deadline
  → bật chế độ tập trung (ẩn dashboard, thử fullscreen, cảnh báo rời/tải lại)
  → timer dùng deadline DB, autosave, cảnh báo 10/5/1 phút
  → nộp chủ động hoặc pg_cron finalize khi hết hạn/browser đóng
Giáo viên chấm phần thủ công bằng một lần lưu atomic → chấm đủ → hoàn tất điểm → công bố
  → màn chấm có audio đề + bản ghi Nói; kết quả học viên có lại hai loại audio trong đúng phạm vi attempt
  → điểm 0–100 + classification + notification dedupe
  → regrade bắt buộc lý do và audit trước/sau
```

**Draft, khóa version, publish delivery, khóa kết quả và publish result là các bước tách biệt.** Học viên chỉ thấy điểm sau release; xếp loại do DB tính từ `grading_scale_rules`. Integrity event chỉ để tham khảo, không tự động kết luận gian lận.

Danh sách delivery của giáo viên luôn chia theo lớp và dùng dòng gọn. Trang kết quả học viên chuyển payload lựa chọn thành nội dung đáp án đọc được; tuyệt đối không lộ JSON, enum tiếng Anh hoặc thuật ngữ nội bộ. Nếu câu Nói cần micro, header website phải cho phép chính origin dùng micro; quyền site, quyền trình duyệt và quyền hệ điều hành vẫn là ba lớp độc lập.

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

---

## 11. “Lớp của tôi” và ôn tập

```text
Học viên mở /student/class
  → server lấy enrollment đang mở của chính user
  → song song tải lớp/lịch/tài liệu/chuyên cần/tiến độ/tóm tắt assessment qua user client
  → RLS chỉ trả lớp và dữ liệu own
  → 7 tab chỉ đọc; Bài tập/Kiểm tra dẫn về module nguồn

Link cũ /student/schedule
  → redirect /student/class (giữ tương thích notification/bookmark cũ)
```

Thiếu enrollment/class mapping → empty state “chưa được xếp lớp”. Không fallback sang lớp đầu tiên, không dùng admin client, không hiển thị roster.

```text
Super Admin mở /admin/flashcards
  → chọn Course đã có default_session_count
  → tạo/lấy deck → chọn Buổi N
  → trang mở đầu: tạo page id + ký 2 vé ảnh front/back
  → trang từ vựng: nhập Hán tự · Pinyin tách âm tiết · nghĩa · 3 danh sách con
      → ảnh hai mặt/audio/ảnh câu ví dụ là các slot upload trực tiếp bucket private
      → ảnh hai mặt tuỳ chọn; audio có thể bổ sung sau khi import nhưng bắt buộc trước publish
  → hoặc dán nhiều dòng để import; unique DB + ON CONFLICT báo created/duplicate theo dòng
  → server kiểm namespace + metadata thật; trigger tự tổng hợp mọi path vào media_paths
  → sắp xếp atomic → publish section
      → DB kiểm cover + vocabulary + audio của mọi thẻ + thứ tự + số buổi
      → student của Course mới đọc/ký được

Học viên mở /student/review, tab Flashcard
  → lấy các section đã publish của Course lớp mình
  → bookmark nhảy buổi
  → trang 1 là trang mở đầu; phải/trái lật cả flashcard quanh tâm để đổi page, không mô phỏng trang sách
  → click/Enter/Space lật front/back dưới↔trên quanh tâm
  → trang mở đầu render hai ảnh; vocabulary render chữ tự xuống dòng + mặt sau 5 khối, ảnh chỉ minh hoạ
  → audio là một nút mang đúng tiêu đề trang, phát từ signed URL (trang mở đầu không có audio)
  → ★ gọi set_flashcard_star theo trạng thái mong muốn; RLS chặn hàng/page của học viên khác
  → xáo trộn chỉ buổi hiện tại trong state React; context đăng nhập mới trở về thứ tự gốc
  → đổi page tự do ở bất kỳ mặt nào; trang vừa rời luôn reset về mặt trước cho lần xem sau
```

**Failure path Flashcard:** section nháp/khác Course → RLS trả 0; path giả/MIME sai/file quá giới hạn → không finalize page và dọn orphan; ảnh câu ví dụ chưa nằm trong `media_paths` → không ký được; publish thiếu cover/vocabulary/audio → rollback; import không phải Super Admin hoặc section không còn draft → từ chối; dòng trùng → báo `duplicate` và không tiêu `order_index`; ★ mang `student_id` khác hoặc page ngoài Course → RLS từ chối; reorder thiếu/thừa page → RPC từ chối toàn bộ.

```text
Khi submit Bài tập/Thi
  → DB chấm answer objective
  → answer is_correct=false + loại máy chấm
      → trigger upsert (student, question_version) vào wrong_answer_queue

Học viên mở tab Ôn câu sai
  → RPC chỉ trả queue unresolved own + prompt/options, không answer key
  → nhập đáp án qua renderer dùng chung → submit RPC
  → DB auto-grade + append wrong_answer_review_attempts
      → đúng: resolved_at=now(), item rời danh sách
      → sai: queue vẫn mở, tăng lịch sử, cho thử lại
```

**Failure path Ôn câu sai:** queue của student khác/đã resolved/loại manual → RPC từ chối; payload sai schema → không ghi history; answer key không có SELECT/payload; một question sai lại sau khi đã thành thạo → trigger mở lại đúng một queue row nhờ UNIQUE.

### Tốc độ audio do giáo viên/admin tải lên

```text
Học viên gặp audio nguồn trong Bài tập / Thi / Kết quả / Flashcard / Ôn câu sai
  → signed URL vẫn được cấp theo đúng RLS và vòng đời hiện có
  → player mặc định 1×, cho chọn 0.5× | 0.75× | 1×
  → client gán playbackRate và giữ cao độ nếu trình duyệt hỗ trợ
  → không upload lại, không tạo file chậm, không thay object_path hay signed URL
```

Bản ghi câu Nói do học viên tự thu không thuộc yêu cầu này. Nếu signed URL hết hạn hoặc audio lỗi, player báo lỗi/cho tải lại theo failure path hiện có; không tự chuyển sang URL hoặc object khác.


## Ứng viên XKLĐ — yêu cầu mới 14/10/2026

Nút module XKLĐ của super admin hoặc menu Ứng viên của nhân viên/điều hành → danh sách phân trang → Thêm ứng viên → nhập hồ sơ/chọn phụ trách → server validation → INSERT theo RLS, DB cấp mã và ghi actor thật → hiện hồ sơ. Sửa dùng updated_at từ lần đọc; nếu hồ sơ đã thay đổi thì báo tải lại thay vì ghi đè. Gửi lại cùng UUID tạo không sinh thêm hồ sơ. Executive chỉ đọc; role không được phép bị chuyển về trang chủ trước khi query. Đây là workflow XKLĐ đầu tiên theo phạm vi user mở rộng, thay thế mô tả loại toàn bộ XKLĐ ở đầu tài liệu đối với phần này.


## Thị trường và đơn hàng XKLĐ

Mở Thị trường & đơn hàng → chọn/thêm quốc gia và mã tiền tệ mặc định → Thêm đơn hàng → nhập chủ sử dụng/nghề/chỉ tiêu/lương/điều kiện/hạn/đối tác → server validation + RLS → DB cấp DH, ghi actor thật → danh sách. Chọn quốc gia mới gợi ý tiền tệ mặc định nhưng người dùng nhập rõ kỳ lương. Sửa giữ code, kiểm tra phiên bản updated_at; bản cũ báo tải lại. Gửi lại UUID tạo không sinh bản trùng. Ngừng thị trường giữ đơn cũ, không cho đơn mới; lỗi server giữ bản nhập để sửa. Executive chỉ xem. Không tự tạo gắn ứng viên, phiếu thu hoặc đổi trạng thái pipeline.


## Pipeline XKLĐ

Tạo ứng viên → Lead và event tiếp nhận → Tư vấn → Đăng ký/đặt cọc → chọn lớp B2C trước Đào tạo ngoại ngữ → Hoàn thiện hồ sơ → gắn đơn đang tuyển trước Phỏng vấn → Trúng tuyển → Visa/giấy phép → Xuất cảnh → Hậu xuất cảnh. Mỗi lần tiến một bước; quay lại bất kỳ bước trước phải nhập lý do. Chọn đơn/lớp và thay đổi bước được lưu atomically, kèm event người thao tác/từ-đến/links/ghi chú/time.

Failure paths: lớp/đơn không còn nhận mới → báo lỗi giữ bản nhập; chưa có lớp/đơn tại bước bắt buộc → không chuyển; đã có người sửa → tải lại; retry UUID đã thành công không tạo event trùng hoặc đổi về bước cũ; lỗi ghi history rollback cả thay đổi. Lịch sử chỉ xem, không có nút sửa/xóa. Trạng thái Đặt cọc không tạo phiếu thu; link lớp không ghi danh/học phí.


### XKLD-DOCUMENTS-1 — Checklist và tệp riêng tư

Chọn thị trường → cấu hình checklist → mở hồ sơ ứng viên → chọn thị trường → nhập ngày nộp/hết hạn/ghi chú. Checklist/hồ sơ25/trang, files20/trang. Ngày nộp tương lai bị từ chối; cho lưu giấy tờ cũ đã hết hạn. Upload: prepare RPC tạo claim/path → browser upload bằng session qua Storage RLS (upsert:false) → server kiểm kích thước và signature PDF/PNG/JPG → RPC xác minh object metadata rồi finalize ready. Lỗi tải/kiểm tra: cleanup object pending và cancel claim; nếu Storage cleanup lỗi có thể còn object cancelled riêng tư, cần vận hành dọn riêng. Tải xuống qua route xác thực, không có public URL trong UI. Tệp giả định dạng bị từ chối; kiểm tra signature không thay antivirus hoặc thẩm định pháp lý. Tệp ready không có luồng sửa/xóa; bổ sung bản mới. Hết hạn tính theo giờ VN, sắp hết hạn trong30 ngày gồm ngày cuối.


### XKLD-FINANCE-1 — Thu/chi và công nợ

Tài chính & công nợ → chọn ứng viên → nhóm phí ứng viên/đối tác/hoa hồng → thêm đợt có số tiền và hạn → thu hoặc chi từng phần. Công nợ = phí hiện tại - (thu - hoàn); với hoa hồng = phải chi - đã chi. Quá hạn khi còn nợ và hạn trước hôm nay giờ VN. Overview tổng theo bộ lọc,25 ứng viên/trang; detail25 đợt/trang; phiếu/lịch sử20/trang. Hoàn bắt đầu từ phiếu thu gốc, chọn rõ giảm phí hoặc giữ phí; không tạo doanh thu/phiếu B2C hoặc tự chuyển pipeline. Sửa đợt lưu lịch sử và chặn stale update. Hủy phiếu giữ nội dung và lý do, tự tính lại công nợ; hủy hoàn có giảm phí khôi phục phí, hủy thu cần hủy các hoàn liên quan trước. Số tiền0/âm/lẻ hoặc ngày cash tương lai bị chặn. Retry tạo/phiếu/hủy không ghi trùng; yêu cầu cùng UUID khác nội dung bị từ chối. Hai giao dịch đồng thời khóa nghĩa vụ nên không cùng thu vượt. Server action revalidate root và pattern detail page để cập nhật số dư, không refresh client trùng.


### B2C-CLASS-DETAIL-1

Lớp trung tâm → chương trình → bấm tên lớp hoặc con mắt → popup thông tin và học viên đúng lớp → tìm/page20 → đóng về danh sách, giữ bộ tìm lớp/tab. Chuyển sang lớp khác khởi tạo lại bộ tìm/page. Danh sách rỗng có thông báo, trường chưa cập nhật dùng nhãn rõ hoặc dấu gạch. Chỉ đọc, không thêm mutation/DB query trong client.


### B2C-CLASS-WORKSPACE-1

Popup lớp → chọn một trong5 mục → trang chi tiết. Lịch → thêm/sửa buổi hoặc giữ buổi liên kết lịch dạy → Mở điểm danh → chọn trạng thái từng học viên và lưu → Nhận xét từ hàng học viên, gắn buổi khi đang điểm danh. Tab Nhận xét cho xem theo buổi hoặc tất cả; chọn học viên để thêm đi đúng buổi đang chọn. Học phí → tạo/sửa gói bằng flow cũ → Phiếu thu → lưu và cập nhật số dư/lịch sử. Mọi danh sách25/trang, tìm học viên server. Buổi tương lai/hủy chặn điểm danh; roster lớp khác hoặc buổi lớp khác bị RPC chặn; học phí chưa cấu hình không là0đ miễn phí. Calendar/attendance/comments lưu request+history nguyên tử, retry không lặp và stale không ghi đè. Sửa lịch có roll-call/comment không cho đổi giờ/hủy. Revalidation vào pattern detail page từ save meeting/attendance/comment/tuition và tạo buổi dạy.


B2C-CLASS-WORKSPACE-1 cache: route force-dynamic/force-no-store cho dữ liệu riêng tư và kết quả RPC luôn mới; revalidate concrete class path sau lưu. Biểu mẫu học phí trong trang lớp truyền class_id chỉ phục vụ cache invalidation (không quyết định phân quyền/mutation); UUID được kiểm trước dùng path. Không refresh client trùng, tránh RSC cập nhật chồng.
