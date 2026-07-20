# 02 — Thiết kế Database

> Nguồn sự thật về **yêu cầu schema**. Khi đã có migration, **migration là nguồn sự thật về implementation** — nếu lệch, sửa cho khớp và cập nhật file này trong cùng bộ thay đổi để user commit cùng nhau.

---

## 1. Quy ước chung

| Hạng mục   | Quy ước                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khóa chính | `uuid` mặc định `gen_random_uuid()`. Riêng `profiles.id` = `auth.users.id`.                                                                                     |
| Đặt tên    | `snake_case`, bảng số nhiều (`students`, `class_sessions`)                                                                                                      |
| Thời gian  | `timestamptz`, **luôn lưu UTC**. Ngày thuần (không giờ) dùng `date`.                                                                                            |
| Timestamps | Mọi bảng nghiệp vụ có `created_at`, `updated_at`; `updated_at` do trigger `set_updated_at()` tự cập nhật                                                        |
| Enum       | **PostgreSQL enum type** (không dùng text + CHECK), đặt trong schema `public`. Mở rộng bằng `ALTER TYPE ... ADD VALUE` — migration-safe.                        |
| Tiền       | `numeric(14,2)` — không dùng float                                                                                                                              |
| Điểm       | `numeric(5,2)`, CHECK `0..100` (hoặc `0..max_score` với bài tập)                                                                                                |
| Xóa        | **Không hard delete dữ liệu lịch sử.** Dùng `status`/`archived_at`. FK mặc định `ON DELETE RESTRICT`; `CASCADE` chỉ cho child thuần (attachment, invoice item). |
| Index      | Bắt buộc index mọi FK, mọi cột dùng trong RLS policy, và cột filter chính                                                                                       |
| Schema phụ | `app` — chứa helper function `SECURITY DEFINER` cho RLS. Revoke `EXECUTE` khỏi `anon`.                                                                          |

**Múi giờ:** DB lưu UTC. Tầng ứng dụng hiển thị và sinh recurrence theo `Asia/Ho_Chi_Minh`. Không lưu giờ địa phương xuống DB.

---

## 2. Enum types

```sql
user_role            : super_admin | teacher | student
course_program       : core | business
course_type          : hsk | communication | kids | exam_prep | custom
course_status        : draft | active | archived
material_visibility  : staff_only | enrolled_students   -- ai được thấy tài liệu
class_status         : planned | active | paused | completed | cancelled
delivery_mode        : offline | online | hybrid | in_house
session_status       : scheduled | completed | cancelled | rescheduled
enrollment_status    : pending | active | paused | completed | withdrawn | transferred
attendance_status    : present | late | absent | excused
lesson_progress_status : not_started | in_progress | completed
assignment_status    : draft | published | closed
submission_status    : submitted | graded | returned
assessment_type      : quiz | midterm | final | mock_hsk | speaking | custom
evaluation_rating    : weak | average | good | excellent
note_visibility      : staff_only | student_visible
invoice_status       : draft | issued | partial | paid | overdue | cancelled | refunded
payment_method       : cash | bank_transfer | card | e_wallet | other
notification_type    : session_upcoming | session_changed | assignment_new | assignment_due
                     | assessment_upcoming | result_published | attendance_absent
                     | invoice_new | invoice_due | invoice_overdue | announcement
```

---

## 3. ERD

```mermaid
erDiagram
    auth_users ||--|| profiles : "id"
    profiles ||--o| teachers : "user_id"
    profiles ||--o| students : "user_id"

    levels ||--o{ courses : "level_id"
    levels ||--o{ students : "current/target_level_id"
    courses ||--o{ course_modules : ""
    course_modules ||--o{ lessons : ""
    courses ||--o{ course_materials : ""
    course_modules ||--o{ course_materials : ""
    lessons ||--o{ course_materials : ""

    courses ||--o{ classes : ""
    classes ||--o{ class_teachers : ""
    teachers ||--o{ class_teachers : ""
    classes ||--o{ class_schedules : ""
    classes ||--o{ class_sessions : ""
    class_schedules ||--o{ class_sessions : "schedule_id"
    lessons ||--o{ class_sessions : "lesson_id"
    class_sessions ||--o{ class_sessions : "original_session_id"

    students ||--o{ enrollments : ""
    classes ||--o{ enrollments : ""
    enrollments ||--o{ enrollment_status_history : ""

    class_sessions ||--o{ attendance_records : ""
    enrollments ||--o{ attendance_records : ""
    enrollments ||--o{ lesson_progress : ""
    lessons ||--o{ lesson_progress : ""

    profiles ||--o{ questions : "owns"
    questions ||--o{ question_versions : "versions"
    question_versions ||--o{ question_options : "options"
    question_versions ||--|| question_answer_keys : "private key"
    question_sets ||--o{ question_set_versions : "versions"
    question_set_versions ||--o{ question_set_items : "items"
    classes ||--o{ exercise_deliveries : ""
    exercise_deliveries ||--o{ exercise_attempts : ""
    classes ||--o{ exam_deliveries : ""
    exam_deliveries ||--o{ exam_attempts : ""
    enrollments ||--o{ learning_evaluations : ""
    enrollments ||--o{ student_notes : ""

    students ||--o{ tuition_invoices : ""
    enrollments ||--o{ tuition_invoices : ""
    tuition_invoices ||--o{ tuition_invoice_items : ""
    tuition_invoices ||--o{ tuition_payments : ""
    tuition_payments ||--|| tuition_receipts : "1-1"

    profiles ||--o{ notifications : ""
    profiles ||--o{ notification_preferences : ""
    classes ||--o{ announcements : "class_id (null = toàn hệ thống)"
    profiles ||--o{ audit_logs : "actor_id"
```

---

## 4. Chi tiết bảng

### 4.1 Danh tính

#### `profiles`

| Cột                         | Kiểu        | Ràng buộc                                   |
| --------------------------- | ----------- | ------------------------------------------- |
| `id`                        | uuid        | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `role`                      | `user_role` | NOT NULL                                    |
| `full_name`                 | text        | NOT NULL                                    |
| `phone`                     | text        |                                             |
| `avatar_path`               | text        | object path trong bucket `avatars`          |
| `is_active`                 | boolean     | NOT NULL DEFAULT true                       |
| `created_at` / `updated_at` | timestamptz | NOT NULL DEFAULT now()                      |

- **Role chỉ được set/đổi bởi admin function server-only.** Policy UPDATE của chính chủ **không cho** đụng vào `role` và `is_active` (chặn bằng trigger `prevent_self_privilege_escalation`).
- `is_active = false` → chặn ở cả middleware lẫn RLS (helper `app.is_active()`).
- Index: `role`, `is_active`.

#### `teachers`

`id` uuid PK · `user_id` uuid **UNIQUE NOT NULL** FK → `auth.users(id)` ON DELETE RESTRICT · `teacher_code` text **UNIQUE NOT NULL DEFAULT mã DB tự sinh** (`GV000001`…) · `specialization` text · `bio` text · `is_active` boolean NOT NULL DEFAULT true · timestamps.

Index: `user_id`, `is_active`.

#### `students`

`id` uuid PK · `user_id` uuid **UNIQUE, NULL được** FK → `auth.users(id)` ON DELETE SET NULL — _cho phép tạo hồ sơ trước, invite sau_ · `student_code` text **UNIQUE NOT NULL DEFAULT mã DB tự sinh** (`HV000001`…) · `full_name` text NOT NULL · `dob` date · `gender` text · `phone` text · `email` text · `address` text · `guardian_name` / `guardian_phone` / `guardian_relation` text _(chỉ là thông tin liên hệ — **không** phải tài khoản)_ · `current_level_id` / `target_level_id` uuid FK → `levels` ON DELETE SET NULL · `learning_goal` text · `joined_on` date · `status` text NOT NULL DEFAULT `'active'` · `note` text · `archived_at` timestamptz · timestamps.

Index: `user_id`, `student_code`, `status`, `current_level_id`.

---

### 4.2 Chương trình đào tạo

#### `levels`

`id` uuid PK · `code` text UNIQUE NOT NULL · `name` text NOT NULL · `framework` text DEFAULT `'HSK'` · `order_index` int NOT NULL · `description` text · `is_active` boolean DEFAULT true · timestamps.

Danh mục cấu hình được — **không hard-code HSK thành enum** để trung tâm còn tạo được level nội bộ.

#### `courses`

| Cột                                  | Kiểu                                       | Ghi chú                                       |
| ------------------------------------ | ------------------------------------------ | --------------------------------------------- |
| `id`                                 | uuid PK                                    |                                               |
| `code`                               | text UNIQUE NOT NULL                       | DB tự sinh `KH000001`…; mã seed cũ được giữ   |
| `title`                              | text NOT NULL                              |                                               |
| `title_en`                           | text                                       |                                               |
| `program`                            | `course_program` NOT NULL DEFAULT `core`   | `core` hoặc `business`                        |
| `course_type`                        | `course_type` nullable                     | bắt buộc với `core`; luôn null với `business` |
| `level_id`                           | uuid FK → `levels` ON DELETE SET NULL      | **nullable** — khóa tùy chỉnh không gắn level |
| `target_audience`                    | text                                       |                                               |
| `objectives` / `description`         | text                                       |                                               |
| `default_session_count`              | int CHECK > 0                              | **nullable** ở catalog                        |
| `default_session_duration_minutes`   | int CHECK > 0                              | **nullable** ở catalog                        |
| `default_tuition_amount`             | numeric(14,2) CHECK ≥ 0                    | nullable                                      |
| `completion_min_attendance_rate`     | numeric(5,2) CHECK 0..100                  | DEFAULT 80                                    |
| `completion_min_overall_score`       | numeric(5,2) CHECK 0..100                  | DEFAULT 50                                    |
| `completion_require_all_exercises`   | boolean                                    | DEFAULT false                                 |
| `status`                             | `course_status` NOT NULL DEFAULT `'draft'` |                                               |
| `created_by`                         | uuid FK → `auth.users` ON DELETE SET NULL  |                                               |
| timestamps                           |                                            |                                               |

CHECK `courses_program_type_check` cưỡng chế hai trạng thái hợp lệ: `core` + đúng một `course_type`, hoặc `business` + `course_type IS NULL`. Giá trị enum cũ `business_custom` đã bị loại bằng forward migration sau khi dữ liệu hiện hữu được chuyển sang `program = business`.

#### `course_modules`

`id` uuid PK · `course_id` FK → `courses` ON DELETE **CASCADE** · `title` NOT NULL · `description` · `order_index` int NOT NULL · **UNIQUE `(course_id, order_index)`** · timestamps.

#### `lessons`

`id` uuid PK · `module_id` FK → `course_modules` ON DELETE **CASCADE** · `title` NOT NULL · `objectives` · `content_summary` · `planned_duration_minutes` int · `order_index` int NOT NULL · **UNIQUE `(module_id, order_index)`** · timestamps.

> `course_id` truy được qua `module_id` → **không** lưu lặp `course_id` ở `lessons` (tránh hai nguồn sự thật lệch nhau).

#### `course_materials`

`id` uuid PK · `course_id` FK NOT NULL (ON DELETE CASCADE) · `module_id` FK nullable · `lesson_id` FK nullable · `title` NOT NULL · `object_path` text NOT NULL (bucket `course-materials`) · `mime_type` · `size_bytes` bigint · `visibility` `material_visibility` NOT NULL DEFAULT `'enrolled_students'` · `uploaded_by` uuid FK · timestamps.

FK thật cho cả 3 cấp — **không dùng polymorphic UUID mềm** như hệ cũ. CHECK: `module_id`/`lesson_id` nếu có phải thuộc đúng `course_id` (kiểm bằng trigger `enforce_material_hierarchy`).

**`uploaded_by` do DB quyết định, không phải app** _(migration 21, `force_material_uploader`)_: trigger ghi đè bằng `auth.uid()` khi INSERT và giữ **bất biến** khi UPDATE. Lý do: RLS cho phép admin/giáo viên INSERT thẳng qua PostgREST bằng JWT của họ — đường đó không đi qua server action, nên nếu tin vào app thì client tự khai `uploaded_by` là ai cũng được (đã kiểm chứng: insert thẳng qua PostgREST → `uploaded_by` = NULL). Đây đúng lớp bug `BUG_M06_01`/`BUG_M12_01` của hệ XKLĐ cũ.

**`object_path` do SERVER sinh**, dạng `{course_id}/{uuid}.{ext}`, đuôi file lấy từ allowlist (`lib/domain/files.ts`). Không bao giờ nhận path client gửi lên — thư mục gốc chính là thứ policy Storage soi để phân quyền.

---

### 4.3 Lớp, lịch, ghi danh

#### `classes`

| Cột                                                           | Kiểu                                            | Ghi chú                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `id`                                                          | uuid PK                                         |                                                                               |
| `code`                                                        | text UNIQUE NOT NULL                            | DB tự sinh `LOP-000001`…; mã seed cũ được giữ                                 |
| `course_id`                                                   | uuid FK → `courses` ON DELETE RESTRICT NOT NULL |                                                                               |
| `name`                                                        | text NOT NULL                                   |                                                                               |
| `target_audience`                                             | text                                            | override của course, nullable                                                 |
| `capacity`                                                    | int NOT NULL **CHECK > 0**                      |                                                                               |
| `planned_session_count`                                       | int CHECK > 0                                   | phải có giá trị trước khi `active`                                            |
| `session_duration_minutes`                                    | int CHECK > 0                                   | phải có giá trị trước khi `active`                                            |
| `start_date`                                                  | date                                            |                                                                               |
| `expected_end_date`                                           | date CHECK ≥ `start_date`                       |                                                                               |
| `delivery_mode`                                               | `delivery_mode` NOT NULL                        |                                                                               |
| `location_name` / `address` / `meeting_url` / `location_note` | text                                            | nullable theo mode; `location_note` cho phép **mô tả tự do** (lớp `in_house`) |
| `status`                                                      | `class_status` NOT NULL DEFAULT `'planned'`     |                                                                               |
| `created_by`                                                  | uuid FK                                         |                                                                               |
| timestamps                                                    |                                                 |                                                                               |

Index: `course_id`, `status`, `start_date`.

Mã hệ thống dùng bốn sequence riêng (`course_code_seq`, `class_code_seq`, `teacher_code_seq`, `student_code_seq`) qua `app.next_business_code(text)` `SECURITY DEFINER`, `search_path = ''`. `anon` không có EXECUTE; cột có DEFAULT nên form/action không gửi mã. UNIQUE trên từng cột là chốt cuối chống trùng khi tạo đồng thời. Production seed vẫn được phép chỉ định mã ổn định để giữ các liên kết nghiệp vụ đã công bố.

#### `class_teachers`

`id` uuid PK · `class_id` FK ON DELETE CASCADE · `teacher_id` FK → `teachers` ON DELETE RESTRICT · **UNIQUE `class_id`** · timestamps.

```sql
-- Mỗi lớp tối đa MỘT giáo viên chính
ALTER TABLE class_teachers
  ADD CONSTRAINT uq_class_teachers_one_teacher UNIQUE (class_id);
```

Đây là **bảng trung tâm của toàn bộ RLS giáo viên**. Index `(teacher_id, class_id)` bắt buộc.

#### `class_schedules`

`id` uuid PK · `class_id` FK ON DELETE CASCADE · `weekday` smallint NOT NULL **CHECK 1..7** (ISO: 1 = Thứ Hai) · `start_time` time NOT NULL · `end_time` time NOT NULL **CHECK `end_time > start_time`** · `effective_from` date · `effective_to` date CHECK ≥ `effective_from` · `timezone` text NOT NULL DEFAULT `'Asia/Ho_Chi_Minh'` · timestamps.

**Lớp linh hoạt (`LOP-01`) được phép không có row nào.**

#### `class_sessions`

| Cột                                     | Kiểu                                            | Ghi chú                                 |
| --------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| `id`                                    | uuid PK                                         |                                         |
| `class_id`                              | uuid FK ON DELETE CASCADE NOT NULL              |                                         |
| `schedule_id`                           | uuid FK → `class_schedules` ON DELETE SET NULL  | nguồn sinh ra buổi này                  |
| `lesson_id`                             | uuid FK → `lessons` ON DELETE SET NULL          | bài học dự kiến                         |
| `session_number`                        | int NOT NULL                                    | **UNIQUE `(class_id, session_number)`** |
| `starts_at` / `ends_at`                 | timestamptz NOT NULL                            | **UTC**, CHECK `ends_at > starts_at`    |
| `topic` / `lesson_log` / `teacher_note` | text                                            | `lesson_log` = nội dung **thực dạy**    |
| `status`                                | `session_status` NOT NULL DEFAULT `'scheduled'` |                                         |
| `original_session_id`                   | uuid FK → `class_sessions` ON DELETE SET NULL   | buổi gốc, cho học bù/đổi lịch           |
| `completed_at` / `completed_by`         |                                                 |                                         |
| timestamps                              |                                                 |                                         |

Index: `class_id`, `starts_at`, `(class_id, starts_at)`, `status`.

> **Idempotency khi sinh buổi:** UNIQUE `(class_id, session_number)` là chốt chặn ở DB. RPC `generate_class_sessions` phải `INSERT ... ON CONFLICT DO NOTHING` và dừng đúng `planned_session_count`.

#### `enrollments`

`id` uuid PK · `student_id` FK → `students` ON DELETE RESTRICT · `class_id` FK → `classes` ON DELETE RESTRICT · ~~UNIQUE `(student_id, class_id)`~~ **(đã gỡ ở migration 23 — xem D-19 bên dưới)** · `status` `enrollment_status` NOT NULL DEFAULT `'pending'` · `enrolled_on` date NOT NULL DEFAULT current_date · `started_on` / `ended_on` date · `reason` text · `tuition_override_amount` numeric(14,2) CHECK ≥ 0 nullable · `created_by` uuid FK · timestamps.

```sql
-- MỘT HỌC VIÊN CHỈ MỘT LỚP TẠI MỘT THỜI ĐIỂM (user chốt 2026-07-13,
-- đảo ngược yêu cầu ban đầu của đặc tả gốc).
--
-- Partial index: lớp đã ĐÓNG (completed/withdrawn/transferred) KHÔNG tính
--   → học xong HSK 1 vẫn đăng ký được HSK 2 (lịch sử lớp cũ giữ nguyên)
--   → chuyển lớp vẫn chạy (lớp cũ thành `transferred` = đã đóng)
--   → D-19: học viên RỚT được HỌC LẠI chính lớp đó (migration 23 gỡ
--     `uq_enrollments_student_class`). Index này vẫn chặn hai ghi danh cùng mở,
--     kể cả trong cùng một lớp — nên D-18 không bị phá.
--     Mỗi lần học là MỘT enrollment riêng; điểm danh/điểm/bài nộp treo vào
--     `enrollment_id` nên lịch sử lần trước không trộn với lần học lại.
CREATE UNIQUE INDEX ux_enrollments_one_open_per_student
  ON enrollments (student_id)
  WHERE status IN ('pending', 'active', 'paused');
```

Index: `student_id`, `class_id`, `status`, `(class_id, status)`.

#### `enrollment_status_history`

`id` uuid PK · `enrollment_id` FK ON DELETE CASCADE · `old_status` `enrollment_status` (null khi tạo mới) · `new_status` `enrollment_status` NOT NULL · `reason` text · `changed_by` uuid FK · `changed_at` timestamptz NOT NULL DEFAULT now().

**Append-only** (không policy UPDATE/DELETE cho bất kỳ role nào).

---

### 4.4 Điểm danh & tiến độ

#### `attendance_records`

`id` uuid PK · `session_id` FK → `class_sessions` ON DELETE CASCADE · `enrollment_id` FK → `enrollments` ON DELETE CASCADE · **UNIQUE `(session_id, enrollment_id)`** ← _khóa chống trùng cho bulk upsert_ · `status` `attendance_status` NOT NULL · `check_in_at` timestamptz · `note` text · `marked_by` uuid FK NOT NULL · `marked_at` timestamptz NOT NULL DEFAULT now() · timestamps.

Trigger `enforce_attendance_class_match`: chặn tạo bản ghi mà `enrollment.class_id ≠ session.class_id`.

⚠️ `session_id` là **ON DELETE CASCADE** → xóa một buổi học sẽ cuốn theo toàn bộ điểm danh của buổi đó. Vì vậy migration 22 thêm trigger `prevent_session_delete_with_history`: **không xóa được** buổi đã dạy (`completed`) hoặc buổi đã có điểm danh — muốn bỏ thì **hủy** (`status = 'cancelled'`), giữ lại vết. Buổi `scheduled` chưa ai điểm danh vẫn xóa được (đó là buổi sinh nhầm do cấu hình lịch sai, chưa có lịch sử gì để mất).

#### `lesson_progress`

`id` uuid PK · `enrollment_id` FK ON DELETE CASCADE · `lesson_id` FK ON DELETE CASCADE · **UNIQUE `(enrollment_id, lesson_id)`** · `status` `lesson_progress_status` NOT NULL DEFAULT `'not_started'` · `completed_at` timestamptz · `teacher_note` text · `updated_by` uuid FK · timestamps.

> **Không có cột "% tiến độ" nhập tay.** Tiến độ tổng hợp được **tính** ở view `v_enrollment_assessment_progress` từ lesson hoàn thành + chuyên cần + bài tập engine mới + điểm đã công bố.

---

### 4.5 Assessment engine: ngân hàng câu hỏi và bộ đề

- `questions` giữ metadata/owner/scope; `question_versions` là version nội dung bất biến khi đã được dùng trong bộ khóa.
- `question_options`, `question_answer_keys`, `question_media`, `question_tags`, `question_tag_links` tách lựa chọn, đáp án riêng tư, media và taxonomy.
- `question_shares` và `question_review_requests` thực hiện chia sẻ giáo viên, clone và duyệt kho chung; không nới owner policy mặc định.
- `question_sets` → `question_set_versions` → `question_set_sections`/`question_set_items`; version chỉ được giao khi đã khóa, có câu và tổng điểm dương.
- Hỗ trợ 11 dạng câu Q1–Q11. Answer key không nằm trong payload học viên; renderer preview và renderer làm bài dùng cùng registry.

Chi tiết field, enum, state machine và rule từng dạng câu nằm tại [`09-ke-hoach-trien-khai-module-bai-tap-kiem-tra-thi.md`](09-ke-hoach-trien-khai-module-bai-tap-kiem-tra-thi.md). Migration nguồn sự thật: 38–53.

### 4.6 Bài tập và kiểm tra/thi

- Bài tập: `exercise_deliveries`, `exercise_attempts`, `exercise_answers`. Mỗi lớp nhận delivery riêng; nhiều lượt được khóa bằng unique `(delivery_id, enrollment_id, attempt_no)`; DB chấm tự động, giữ phần thủ công, phạt trễ và công bố điểm/đáp án theo mode.
- Kiểm tra/thi: `exam_deliveries`, `exam_attempts`, `exam_answers`, `exam_integrity_events`, `exam_regrade_runs`. Window có thể kéo dài nhiều ngày (EX-12 đã đảo 2026-07-18, chỉ còn `opens_at < closes_at`); deadline là `min(started_at + duration, closes_at)`; submit/finalize idempotent.
- Câu Nói lưu object private ở `answer-media`; `answer_media` ánh xạ object path với đúng attempt/item. Blob upload thẳng từ browser bằng vé server ký, sau đó server kiểm path/MIME/size thật và RPC `attach_answer_media` mới ghi `answer_payload.audio_path`. `authenticated` chỉ có `SELECT` metadata qua RLS; mọi mutation vẫn qua RPC fail-closed.
- Kết quả chỉ hiện sau công bố. Regrade và override có actor/lý do/audit; integrity event là tín hiệu tham khảo, không tự kết luận gian lận.
- `grade_exercise_answers_bulk` / `grade_exam_answers_bulk` nhận danh sách điểm của một delivery và lưu trong **một transaction**; mọi answer phải thuộc đúng delivery và vẫn đi qua kiểm quyền/chặn điểm vượt giới hạn của RPC chấm từng câu. Lỗi một câu rollback cả lần lưu.
- `get_my_assessment_result` chỉ trả kết quả đã công bố của chính học viên, kèm prompt/loại câu/options/thứ tự/điểm tối đa để UI hiển thị thân thiện; `answer_key` và giải thích vẫn bị cắt theo release mode ở DB.
- `pg_cron` gọi `finalize_assessment_attempts()` mỗi phút để xử lý browser đã đóng và công bố kết quả bài tập đến hạn.

#### `grading_scale_rules`

`id` uuid PK · `label` text NOT NULL · `min_score` numeric(5,2) NOT NULL CHECK 0..100 · `max_score` numeric(5,2) NOT NULL CHECK 0..100 · CHECK `max_score > min_score` · `order_index` int · `is_active` boolean DEFAULT true · timestamps.

**EXCLUDE constraint chống chồng lấn ngưỡng:**

```sql
ALTER TABLE grading_scale_rules ADD CONSTRAINT ex_grading_no_overlap
  EXCLUDE USING gist (numrange(min_score, max_score, '[)') WITH &&) WHERE (is_active);
```

Seed mặc định: Yếu `[0,50)` · Trung bình `[50,65)` · Khá `[65,80)` · Giỏi `[80,90)` · Xuất sắc `[90,100]`.

#### `learning_evaluations`

`id` uuid PK · `enrollment_id` FK ON DELETE CASCADE · `period_start` / `period_end` date · `evaluation_date` date NOT NULL · `overall_rating` `evaluation_rating` · `listening_rating` … `grammar_rating` (`evaluation_rating`, nullable) · `strengths` / `areas_for_improvement` / `action_plan` / `teacher_comment` text · `visible_to_student` boolean NOT NULL DEFAULT false · `published_at` timestamptz · `created_by` uuid FK · timestamps.

**Không có tiêu chí tài chính.**

- **Hai cột cùng quyết định "học viên có thấy không"** (`published_at` + `visible_to_student`) là một cái bẫy: bật một cột, quên cột kia → giáo viên tưởng đã gửi mà học viên không thấy gì, hoặc ngược lại. Chốt ở migration 28: **chỉ RPC `publish_evaluation` được đặt hai cột này, và luôn đặt CÙNG NHAU.** Cả hai đã bị REVOKE khỏi `GRANT UPDATE` của `authenticated`.
- INSERT luôn ép về nháp (`published_at = null`, `visible_to_student = false`) và `created_by = auth.uid()` cho mọi user flow có JWT. `created_by` / `enrollment_id` bất biến — đổi enrollment là chuyển đánh giá sang hồ sơ người khác, không phải "sửa".
- Đánh giá **đã gửi cho học viên không hard delete** được.

#### `student_notes`

`id` uuid PK · `enrollment_id` FK ON DELETE CASCADE · `body` text NOT NULL · `visibility` `note_visibility` NOT NULL DEFAULT `'staff_only'` · `created_by` uuid FK NOT NULL · timestamps.

Học viên **tuyệt đối không đọc** `staff_only` — qua API, qua Supabase client trực tiếp, hay qua bất kỳ view nào. _(pgTAP `evaluation_notes.test.sql` kiểm bằng chính JWT của học viên: quét toàn bảng chỉ trả về ghi chú `student_visible`.)_

`created_by` do DB ghi đè bằng `auth.uid()` và bất biến; `enrollment_id` bất biến. Học viên **không** tạo/sửa được ghi chú trong hồ sơ của chính mình _(migration 28)_.

---

### 4.7 Học phí

#### `tuition_invoices`

`id` uuid PK · `invoice_code` text UNIQUE NOT NULL · `student_id` FK → `students` ON DELETE RESTRICT NOT NULL · `enrollment_id` / `class_id` FK nullable ON DELETE SET NULL · `issue_date` date NOT NULL DEFAULT current_date · `due_date` date CHECK ≥ `issue_date` · `subtotal` numeric(14,2) NOT NULL CHECK ≥ 0 · `discount` numeric(14,2) NOT NULL DEFAULT 0 CHECK ≥ 0 · `total` numeric(14,2) NOT NULL **CHECK ≥ 0** · `status` `invoice_status` NOT NULL DEFAULT `'draft'` · `note` text · `created_by` uuid FK · timestamps.

#### `tuition_invoice_items`

`id` uuid PK · `invoice_id` FK ON DELETE **CASCADE** · `description` NOT NULL · `quantity` numeric(10,2) NOT NULL DEFAULT 1 CHECK > 0 · `unit_amount` numeric(14,2) NOT NULL CHECK ≥ 0 · `line_total` numeric(14,2) NOT NULL CHECK ≥ 0 · `created_at`.

#### `tuition_payments`

`id` uuid PK · `payment_code` text UNIQUE NOT NULL · `invoice_id` FK → `tuition_invoices` ON DELETE RESTRICT NOT NULL · `student_id` FK NOT NULL · `amount` numeric(14,2) NOT NULL **CHECK > 0** · `paid_at` timestamptz NOT NULL DEFAULT now() · `method` `payment_method` NOT NULL · `reference` text · `note` text · `recorded_by` uuid FK NOT NULL · timestamps.

Trigger chặn tổng thanh toán vượt `invoice.total` (trừ khi đi qua flow refund tường minh).

#### `tuition_receipts`

`id` uuid PK · `receipt_code` text UNIQUE NOT NULL · `payment_id` uuid **UNIQUE NOT NULL** FK → `tuition_payments` ON DELETE RESTRICT ← _chống sinh phiếu trùng ở tầng DB_ · `issued_at` timestamptz NOT NULL DEFAULT now() · `issued_by` uuid FK · `snapshot` jsonb · `object_path` text nullable · timestamps.

> **Số dư học phí không có bảng riêng.** Tính ở view `v_tuition_balance`. Đây là ranh giới cứng: không để nó mọc thành module công nợ.

---

### 4.8 Thông báo & audit

#### `announcements`

`id` uuid PK · `class_id` FK nullable _(null = toàn hệ thống)_ · `title` NOT NULL · `body` text NOT NULL · `published_at` timestamptz · `expires_at` timestamptz CHECK > `published_at` · `created_by` uuid FK · timestamps. **Không reply/thread/chat.**

Mutation chỉ qua `save_announcement` / `publish_announcement` / `expire_announcement`. `created_by = auth.uid()`; bản đã publish khóa nội dung và không hard-delete. Publish theo lớp chỉ sinh notification cho giáo viên được phân công và học viên có enrollment `active/paused/completed` của lớp đó; publish toàn hệ thống gửi tới mọi teacher/student đang hoạt động.

#### `notifications`

`id` uuid PK · `user_id` FK → `auth.users` ON DELETE CASCADE NOT NULL · `type` `notification_type` NOT NULL · `title` NOT NULL · `body` text · `link` text _(route nội bộ)_ · `resource_type` / `resource_id` · `dedupe_key` text nullable · `read_at` timestamptz · `created_at`.

Teacher/student chỉ có column privilege `UPDATE (read_at)` trên notification của mình. Nội dung/link/resource là bất biến với người nhận, kể cả gọi PostgREST trực tiếp.

```sql
-- Chống cron sinh trùng; chỉ áp dụng khi dedupe_key khác null
CREATE UNIQUE INDEX ux_notifications_dedupe
  ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
```

#### `notification_preferences`

`id` uuid PK · `user_id` FK NOT NULL · `type` `notification_type` NOT NULL · **UNIQUE `(user_id, type)`** · `in_app_enabled` boolean NOT NULL DEFAULT true · `email_enabled` boolean NOT NULL DEFAULT false _(chỗ mở cho phase sau — **không** thêm SMS/Zalo giả lập)_ · timestamps.

Trigger ép preference về actor thật và giữ `email_enabled = false` cho user flow thường. Trigger trước INSERT `notifications` đọc preference này; nếu loại tương ứng bị tắt thì bỏ bản ghi ngay tại DB. Không có preference = mặc định bật.

#### `audit_logs`

`id` uuid PK · `actor_id` uuid FK → `auth.users` ON DELETE SET NULL · `actor_role` `user_role` · `action` text NOT NULL · `resource_type` text NOT NULL · `resource_id` uuid · `before` jsonb · `after` jsonb · `ip` inet · `user_agent` text · `created_at` timestamptz NOT NULL DEFAULT now().

**Append-only.** Không có policy UPDATE/DELETE cho bất kỳ role app nào. **Chỉ `super_admin` SELECT.**

---

## 5. Helper functions cho RLS (schema `app`)

Đặt trong schema `app`, `SECURITY DEFINER`, `SET search_path = ''` (cố định, chống search_path hijack), `REVOKE EXECUTE FROM anon`, `STABLE`.

```sql
app.current_role()          -- user_role của người đang đăng nhập, đọc từ public.profiles
app.is_active()             -- profiles.is_active = true
app.is_super_admin()        -- current_role = 'super_admin' AND is_active
app.my_teacher_id()         -- teachers.id của auth.uid(), NULL nếu không phải teacher
app.my_student_id()         -- students.id của auth.uid(), NULL nếu không phải student
app.teaches_class(uuid)     -- EXISTS trong class_teachers cho teacher hiện tại
app.studies_class(uuid)     -- EXISTS enrollment (status IN active/paused/completed) cho student hiện tại
app.owns_enrollment(uuid)   -- enrollment thuộc student hiện tại
app.teaches_enrollment(uuid)-- enrollment thuộc lớp mà teacher hiện tại dạy
```

**Fail-closed:** mọi hàm trả `false`/`NULL` khi thiếu mapping hoặc `is_active = false`. Không có nhánh `return true` mặc định — đây đúng là lỗi đã gặp ở hệ cũ (`MessagingPolicy.CanMessage` fallback `return true`).

---

## 6. RLS matrix

**Mọi bảng `public` đều `ENABLE ROW LEVEL SECURITY`. Không bảng nào được để trần.**
`anon` = **DENY toàn bộ** (không viết policy nào cho `anon` → mặc định deny).

| Bảng                        | Super Admin           | Teacher                                                                                | Student                                                                 |
| --------------------------- | --------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `profiles`                  | ALL                   | SELECT: own + học viên/GV trong lớp mình dạy · UPDATE: own (trừ `role`, `is_active`)   | SELECT/UPDATE: own (trừ `role`, `is_active`)                            |
| `teachers`                  | ALL                   | SELECT: own + đồng nghiệp cùng lớp                                                     | SELECT: GV của lớp mình học                                             |
| `students`                  | ALL                   | SELECT: học viên có enrollment trong lớp mình dạy                                      | SELECT: own                                                             |
| `levels`                    | ALL                   | SELECT                                                                                 | SELECT                                                                  |
| `courses`                   | ALL                   | SELECT: course của lớp mình dạy                                                        | SELECT: course của lớp mình học                                         |
| `course_modules`, `lessons` | ALL                   | SELECT: qua course của lớp mình dạy                                                    | SELECT: qua course của lớp mình học                                     |
| `course_materials`          | ALL                   | SELECT: lớp mình dạy (mọi `visibility`) · INSERT/UPDATE: lớp mình dạy                  | SELECT: lớp mình học **AND `visibility = 'enrolled_students'`**         |
| `classes`                   | ALL                   | SELECT: `app.teaches_class(id)`                                                        | SELECT: `app.studies_class(id)`                                         |
| `class_teachers`            | ALL                   | SELECT: lớp mình dạy. **Không INSERT/UPDATE/DELETE** — không tự gán mình sang lớp khác | SELECT: lớp mình học                                                    |
| `class_schedules`           | ALL                   | SELECT: lớp mình dạy                                                                   | SELECT: lớp mình học                                                    |
| `class_sessions`            | ALL                   | SELECT + UPDATE (nhật ký, trạng thái): lớp mình dạy · INSERT: lớp mình dạy             | SELECT: lớp mình học                                                    |
| `enrollments`               | ALL                   | SELECT: lớp mình dạy                                                                   | SELECT: own                                                             |
| `enrollment_status_history` | SELECT                | SELECT: enrollment lớp mình dạy                                                        | SELECT: own. **Không ai UPDATE/DELETE**                                 |
| `attendance_records`        | ALL                   | SELECT/INSERT/UPDATE: session của lớp mình dạy                                         | SELECT: own                                                             |
| `lesson_progress`           | ALL                   | SELECT/INSERT/UPDATE: enrollment lớp mình dạy                                          | SELECT: own                                                             |
| Question bank/set tables    | ALL                   | Owner + share tường minh; kho chung chỉ bản đã duyệt; answer key không SELECT          | **DENY** trực tiếp                                                       |
| Exercise tables             | ALL                   | Lớp mình phụ trách; mutation qua RPC                                                   | Delivery lớp mình; attempt/answer của chính mình                         |
| Exam tables                 | ALL                   | Lớp mình phụ trách; mutation qua RPC                                                   | Delivery lớp mình; attempt/answer/integrity của chính mình               |
| `grading_scale_rules`       | ALL                   | SELECT                                                                                 | SELECT                                                                  |
| `learning_evaluations`      | ALL                   | ALL: enrollment lớp mình dạy                                                           | SELECT: own **AND `published_at IS NOT NULL` AND `visible_to_student`** |
| `student_notes`             | ALL                   | ALL: enrollment lớp mình dạy                                                           | SELECT: own **AND `visibility = 'student_visible'`**                    |
| `tuition_invoices`          | SELECT + RPC mutation | **DENY**                                                                               | SELECT: own **AND `status <> 'draft'`**                                 |
| `tuition_invoice_items`     | SELECT + RPC mutation | **DENY**                                                                               | SELECT: invoice đã phát hành của own                                    |
| `tuition_payments`          | ALL                   | **DENY**                                                                               | SELECT: own. **Không INSERT**                                           |
| `tuition_receipts`          | ALL                   | **DENY**                                                                               | SELECT: payment của own                                                 |
| `announcements`             | SELECT + RPC mutation | SELECT: toàn hệ thống + lớp mình dạy (đã publish, còn hiệu lực)                        | SELECT: toàn hệ thống + lớp mình học (đã publish, còn hiệu lực)         |
| `notifications`             | ALL                   | SELECT/UPDATE (`read_at`): own                                                         | SELECT/UPDATE (`read_at`): own                                          |
| `notification_preferences`  | ALL                   | ALL: own                                                                               | ALL: own                                                                |
| `audit_logs`                | **SELECT only**       | **DENY**                                                                               | **DENY**                                                                |

Ghi chú thi hành:

- `audit_logs`, `enrollment_status_history` **không có policy INSERT cho role app** — chỉ ghi qua RPC `SECURITY DEFINER` hoặc admin client.
- Bảng nào teacher/student chỉ được đọc một phần → policy phải dùng `USING` **và** `WITH CHECK` cho mutation, tránh sửa row rồi đẩy nó ra ngoài scope.
- Mọi view exposed dùng **`security_invoker = true`** để RLS của người gọi vẫn áp dụng.

---

## 7. Views

| View                           | Tính gì                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v_student_attendance_summary` | Theo `enrollment`: tổng buổi đã diễn ra, số `present`/`late`/`absent`/`excused`, **tỷ lệ chuyên cần**                                                            |
| `v_enrollment_assessment_progress` | Theo enrollment: lesson/chuyên cần/bài tập engine/điểm đã công bố và readiness |
| `v_class_assessment_progress`      | Tổng hợp tiến độ engine theo lớp                                                   |
| `v_at_risk_assessment_students`    | Học viên dưới ngưỡng chuyên cần/điểm hoặc thiếu bài tập                            |
| `v_tuition_balance`            | Theo invoice: `total`, `paid_amount` (SUM payments), `balance = total − paid`, `is_overdue`                                                                      |

Tất cả tạo với `WITH (security_invoker = true)`.

Công thức tiến độ tổng (`v_enrollment_assessment_progress.progress_percent`) — **công khai, không phải số nhập tay**:

```
progress = 0.40 × (bài học completed / tổng bài học)
         + 0.30 × (tỷ lệ chuyên cần)
         + 0.15 × (bài tập đã nộp / bài tập đã publish)
         + 0.15 × (điểm TB đã publish / 100)
```

---

## 8. RPC (transaction)

| RPC                                                                           | Vì sao phải là RPC                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enroll_student(student_id, class_id)`                                        | Kiểm `capacity` **có khóa hàng** (`SELECT ... FOR UPDATE` trên `classes`) rồi mới insert → hai người ghi danh đồng thời không vượt sĩ số                                                                                                            |
| `transfer_enrollment(enrollment_id, to_class_id, reason)`                     | Đánh dấu `transferred` + tạo enrollment mới + 2 dòng history — **một transaction**                                                                                                                                                                  |
| `change_enrollment_status(enrollment_id, new_status, reason)`                 | Đổi status + ghi history + audit, atomic                                                                                                                                                                                                            |
| `bulk_mark_attendance(session_id, records[])`                                 | `INSERT ... ON CONFLICT (session_id, enrollment_id) DO UPDATE` → chạy lại **không sinh trùng**                                                                                                                                                      |
| `generate_class_sessions(class_id)`                                           | Sinh buổi từ recurrence, `ON CONFLICT DO NOTHING`, dừng ở `planned_session_count` → **idempotent**                                                                                                                                                  |
| `save_session_log(session_id, lesson_id, lesson_log, teacher_note, complete)` | Lưu nội dung thực dạy; khi hoàn tất thì cập nhật `class_sessions` + upsert `lesson_progress` cho enrollment đang mở trong **một transaction**, actor lấy từ `auth.uid()`                                                                            |
| Assessment engine RPC                                                         | Create/version/share/import/set structure; publish/start/save/submit/grade/release/regrade/finalize. Chấm hàng loạt dùng `grade_*_answers_bulk` atomic; kết quả học viên qua `get_my_assessment_result` fail-closed theo owner/release. Tất cả kiểm scope, idempotency và actor ở DB; danh sách đầy đủ tại docs/09. |
| `publish_evaluation(evaluation_id)`                                           | Khóa hàng, đặt **cùng lúc** `published_at` + `visible_to_student = true` (không bao giờ lệch nửa vời) + notification (`dedupe_key` chặn trùng) + audit, atomic                                                                                      |
| `save_tuition_invoice(student_id, issue_date, discount, items, ...)`          | Tạo/cập nhật invoice draft + thay toàn bộ items trong **một transaction**; DB tính `line_total`, `subtotal`, `total`; enrollment phải thuộc đúng học viên                                                                                           |
| `issue_tuition_invoice(invoice_id)`                                           | Khóa invoice draft → `issued` + notification `invoice_new` + audit; gọi lại không sinh notification trùng                                                                                                                                           |
| `delete_tuition_invoice_draft(invoice_id)`                                    | Chỉ hard-delete draft chưa phát hành; invoice lịch sử bị từ chối                                                                                                                                                                                    |
| `record_tuition_payment(invoice_id, amount, method, ...)`                     | Chỉ nhận invoice `issued/partial/overdue`; insert payment + cập nhật `invoice.status` + sinh **đúng 1** receipt + notification — một transaction. UNIQUE `payment_id` ở `tuition_receipts` là chốt chặn cuối                                        |
| `save_announcement(title, body, class_id, expires_at, announcement_id)`       | Tạo/cập nhật draft; `created_by` là actor thật; bản đã publish bị khóa nội dung                                                                                                                                                                     |
| `publish_announcement(announcement_id)`                                       | Khóa draft → published, chọn audience toàn hệ thống/theo lớp và sinh notification idempotent trong một transaction                                                                                                                                  |
| `expire_announcement(announcement_id)`                                        | Kết thúc hiệu lực bản đã publish, giữ nguyên lịch sử và ghi audit                                                                                                                                                                                   |
| `admin_invite_user(email, role, ...)`                                         | Tạo `auth.users` (service role, server-only) + `profiles` + `teachers`/`students`, **idempotent**                                                                                                                                                   |

Tất cả RPC nghiệp vụ: `SECURITY DEFINER`, `SET search_path = ''`, **kiểm quyền ngay dòng đầu** (`IF NOT app.is_super_admin() THEN RAISE EXCEPTION`), `REVOKE EXECUTE FROM PUBLIC, anon` rồi `GRANT` đúng role cần.

---

## 9. Storage

| Bucket              | Private | Ai đọc                                                                            | Ai ghi                        |
| ------------------- | ------- | --------------------------------------------------------------------------------- | ----------------------------- |
| `avatars`           | ✅      | own + admin                                                                       | own                           |
| `course-materials`  | ✅      | teacher (lớp mình dạy) + student (lớp mình học, `visibility = enrolled_students`) | admin, teacher (lớp mình dạy) |
| `student-documents` | ✅      | admin + student (own)                                                             | admin                         |
| `question-media`    | ✅      | owner/share/scope delivery hợp lệ                                                  | admin, teacher owner          |
| `answer-media`      | ✅      | student owner + giáo viên phụ trách lớp của attempt                                | student owner qua signed ticket + RPC |

Quy tắc:

- **Không bucket public.** Truy cập qua **signed URL thời hạn ngắn** (≤ 5 phút).
- **`object_path` do server sinh**, theo cấu trúc `{bucket}/{class_id}/{entity_id}/{uuid}.{ext}`. **Không tin path client gửi lên** (chặn path traversal).
- Whitelist MIME/extension + giới hạn dung lượng (mặc định 20 MB; audio câu hỏi 50 MB; audio bài nói 25 MB). Tên file sanitize.
- Storage policy phải **soi cùng một điều kiện class/student như DB**, không chỉ check `auth.uid() IS NOT NULL`.
- `question-media` dùng path owner UUID và chỉ đọc khi owner/share/delivery cho phép; bucket luôn private.
- Học viên chỉ đọc metadata/object `question-media` khi question version nằm trong chính lượt Bài tập (`in_progress`/`returned_for_revision`), lượt Thi `in_progress` còn hạn, hoặc kết quả Bài tập/Thi của chính mình đã được công bố. Giáo viên phụ trách lớp đọc được media của đúng bộ đã giao để chấm; học viên/giáo viên ngoài phạm vi bị RLS từ chối.
- `get_my_assessment_result` trả `question_version_id` + `prompt_content` cùng snapshot từng câu để server ký audio đề private; object path không được đưa thẳng vào payload trình duyệt.
- Upload audio câu hỏi dùng hai bước: server xác thực/quota và sinh signed upload path trong namespace owner → browser upload trực tiếp → server đọc metadata thật từ Storage rồi mới insert `question_media`. Không gửi blob MP3/M4A qua Server Action.
- Upload câu Nói dùng cùng mẫu direct upload: path `{student_uid}/{attempt_id}/{item_id}/{uuid}.{ext}` do server sinh → browser upload → server xác minh object → RPC gắn metadata + đáp án. Không đưa Blob thu âm qua Server Action.
- Xóa object + metadata phải có transaction/compensation — **không để orphan im lặng**.
- Test IDOR: đổi `object_path` sang class/student khác → phải bị từ chối.

---

## 10. Seed strategy

`supabase/seed.sql` — **idempotent** (`ON CONFLICT DO NOTHING` / `DO UPDATE` theo business code, không theo uuid ngẫu nhiên).

Thứ tự: `levels` (HSK 1–6) → `grading_scale_rules` → `courses` (catalog cốt lõi + 2 chương trình VCB) → `classes` (`LOP-01/02/03`) → `class_schedules` (chỉ `LOP-02`, `LOP-03` — **`LOP-01` không có lịch lặp**) → _(chỉ ở môi trường dev)_ user demo + enrollment demo.

- Dữ liệu catalog và lớp VCB là **dữ liệu nghiệp vụ thật** → seed ở mọi môi trường.
- User demo, enrollment demo, điểm demo → **chỉ dev**, tách file `supabase/seed.dev.sql`. **Production không có user demo, không mật khẩu mặc định.**
- Danh tính demo phải rõ là giả: `gv.demo1@polymind.test`, "Giáo viên Demo A".

## 11. Migration rules

1. Migration SQL nằm trong `supabase/migrations/`, đặt tên `<timestamp>_<mô tả>.sql`. **Chỉ tiến, không sửa migration đã chạy production** — sai thì viết migration mới đè lên.
2. **Không chạy migration lúc app startup.** Chạy qua Supabase CLI/CI trước khi deploy.
3. Mỗi migration đổi schema phải có test kèm (pgTAP cho RLS/constraint, hoặc integration test).
4. `supabase db reset` phải chạy sạch từ đầu tới cuối, không lỗi, seed idempotent.
5. Thêm cột NOT NULL vào bảng có dữ liệu → phải có DEFAULT hoặc backfill trong cùng migration.
