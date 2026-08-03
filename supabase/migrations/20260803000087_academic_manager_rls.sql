-- =============================================================================
-- 87 — Role "Giáo vụ": helper `app.is_manager()` + viết lại RLS quản lý
--
-- Task `GIAOVU-1a`/`GIAOVU-1b`, quyết định `D-2` (user chốt 2026-08-03).
--
-- Đọc `…086` trước: giá trị enum `academic_manager` phải nằm ở migration RIÊNG,
-- không gộp được vào file này.
--
-- -----------------------------------------------------------------------------
-- HAI KHÁI NIỆM, ĐỪNG TRỘN
--
--   app.is_super_admin()  = QUẢN TRỊ  — tài khoản, phân vai, audit.
--   app.is_manager()      = QUẢN LÝ   — nghiệp vụ đào tạo. super_admin ∪ giáo vụ.
--
-- `is_super_admin()` KHÔNG đổi nghĩa. Sửa nó thành "quản lý" là mở luôn
-- `audit_logs` và đường ghi `profiles` cho giáo vụ — đúng hai thứ user đã loại.
--
-- -----------------------------------------------------------------------------
-- 73 POLICY ĐANG DÙNG `is_super_admin()`, ĐO TỪ `pg_policies` CHỨ KHÔNG GREP.
--
-- Grep trên thư mục migrations cho ra danh sách SAI: nó đếm cả policy trên
-- `assignments`/`submissions`/`assessments` đã bị Phase 12 xoá cùng module cũ.
-- Chỉ `pg_policies` mới nói được cái gì còn sống.
--
--   42 policy → `is_manager()`   (35 ở `public`, 7 ở `storage`)
--   31 policy → GIỮ NGUYÊN       (22 ở `public`,  9 ở `storage`)
--
-- Vì sao từng nhóm bị GIỮ:
--   • `audit_logs`, `profiles`          — user loại thẳng (quản trị tài khoản/audit)
--   • `teachers`                        — xem khối riêng bên dưới
--   • `flashcard_*`, `question_*`       — user chốt điểm (3): hai mục "Flashcard"
--     và "Duyệt câu hỏi" KHÔNG thuộc menu giáo vụ. Ẩn menu mà vẫn mở RLS thì
--     đúng là thứ `D-13` gọi là "ẩn menu ≠ phân quyền".
--   • `storage` avatar/flashcard/question_media — cùng lý do trên.
--
-- Vì sao `exam_*`/`exercise_*`/`answer_media`/`wrong_answer_*` LẠI ĐƯỢC mở dù
-- không có mục menu riêng: hai mục "Lớp học" và "Báo cáo" (thuộc 9 mục user
-- liệt kê) đọc thẳng các bảng này. Đóng chúng lại thì menu hiện ra mà trang
-- rỗng — hỏng theo kiểu khó truy nhất.
-- =============================================================================

-- --- helper ------------------------------------------------------------------

-- QUẢN LÝ = super_admin ∪ academic_manager.
--
-- Fail-closed y hệt `…010`: `app.current_role()` trả null khi tài khoản bị khoá
-- hoặc không có profile ⇒ `coalesce(..., false)`. Không có nhánh `return true`.
create or replace function app.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    app.current_role() in ('super_admin', 'academic_manager'),
    false
  );
$$;

comment on function app.is_manager() is
  'Quyền QUẢN LÝ nghiệp vụ đào tạo: super_admin hoặc academic_manager (giáo vụ). '
  'KHÔNG bao gồm quản trị tài khoản và đọc audit — dùng app.is_super_admin() cho hai việc đó.';

-- --- giáo vụ dạy lớp ---------------------------------------------------------

-- ⚠️ VẾ NÀY QUYẾT ĐỊNH NHÁNH MENU THỨ HAI CÓ CHẠY HAY KHÔNG.
--
-- Bản cũ đòi `p.role = 'teacher'`. Giữ nguyên thì giáo vụ được phân công dạy lớp
-- vẫn nhận null ⇒ `teaches_class()`, `teaches_student()`, `teaches_course()`…
-- đồng loạt false ⇒ menu "Lớp được phân công" hiện ra nhưng mọi trang bên trong
-- đều rỗng, và không có thông báo lỗi nào để lần ra.
--
-- `t.is_active` và `p.is_active` GIỮ NGUYÊN — nới role không phải cớ để nới nốt
-- hai cửa khoá tài khoản.
create or replace function app.my_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.teachers t
  join public.profiles p on p.id = t.user_id
  where t.user_id = auth.uid()
    and t.is_active
    and p.is_active
    and p.role in ('teacher', 'academic_manager');
$$;

-- =============================================================================
-- 35 policy `public` → quản lý
--
-- Dùng `alter policy` chứ không drop+create: giữ nguyên `cmd` và danh sách role
-- của policy, chỉ thay biểu thức. Drop+create là cơ hội để lỡ tay đổi `for all`
-- thành `for select` hoặc rơi mất `to authenticated` mà không ai thấy.
--
-- Tên policy còn chữ "admin" được đổi ở khối cuối file — đổi tên trước thì
-- `alter policy` bên dưới phải gọi tên mới, rối khi đọc diff.
-- =============================================================================

-- Danh mục & chương trình
alter policy "admin toàn quyền levels"              on public.levels              using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền grading scale"       on public.grading_scale_rules using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền courses"             on public.courses             using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền course_modules"      on public.course_modules      using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền lessons"             on public.lessons             using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền course_materials"    on public.course_materials    using (app.is_manager()) with check (app.is_manager());

-- Lớp, lịch, buổi học, phân công GV  ← điểm cốt lõi user yêu cầu
alter policy "admin toàn quyền classes"             on public.classes             using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền class_teachers"      on public.class_teachers      using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền class_schedules"     on public.class_schedules     using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền class_sessions"      on public.class_sessions      using (app.is_manager()) with check (app.is_manager());

-- Học viên & ghi danh
alter policy "admin toàn quyền students"            on public.students            using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền enrollments"         on public.enrollments         using (app.is_manager()) with check (app.is_manager());
-- SELECT-only ⇒ Postgres cấm `with check` ở đây.
alter policy "admin đọc lịch sử enrollment"         on public.enrollment_status_history using (app.is_manager());

-- Vận hành lớp
alter policy "admin toàn quyền attendance"          on public.attendance_records  using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền lesson_progress"     on public.lesson_progress     using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền learning_evaluations" on public.learning_evaluations using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền student_notes"       on public.student_notes       using (app.is_manager()) with check (app.is_manager());

-- Bài tập / kiểm tra: dữ liệu giao bài và bài làm (KHÁC ngân hàng câu hỏi)
alter policy admin_all_exercise_deliveries          on public.exercise_deliveries using (app.is_manager()) with check (app.is_manager());
alter policy admin_all_exercise_attempts            on public.exercise_attempts   using (app.is_manager()) with check (app.is_manager());
alter policy admin_all_exercise_answers             on public.exercise_answers    using (app.is_manager()) with check (app.is_manager());
alter policy admin_all_exam_deliveries              on public.exam_deliveries     using (app.is_manager()) with check (app.is_manager());
alter policy admin_all_exam_attempts                on public.exam_attempts       using (app.is_manager()) with check (app.is_manager());
alter policy admin_all_exam_answers                 on public.exam_answers        using (app.is_manager()) with check (app.is_manager());
alter policy admin_all_exam_integrity_events        on public.exam_integrity_events using (app.is_manager()) with check (app.is_manager());
alter policy admin_all_exam_regrade_runs            on public.exam_regrade_runs   using (app.is_manager()) with check (app.is_manager());
-- ⚠️ Chép nguyên vế giáo viên từ định nghĩa đang chạy (`pg_policies`), chỉ thay
-- đúng `is_super_admin` → `is_manager`. `answer_media` KHÔNG có cột `class_id`;
-- lớp phải suy qua attempt → delivery, và tách hai nhánh exercise/exam.
alter policy answer_media_teacher_read on public.answer_media
  using (
    app.is_manager()
    or (
      attempt_kind = 'exercise'
      and exists (
        select 1
        from public.exercise_attempts a
        join public.exercise_deliveries d on d.id = a.delivery_id
        where a.id = answer_media.attempt_id and app.teaches_class(d.class_id)
      )
    )
    or (
      attempt_kind = 'exam'
      and exists (
        select 1
        from public.exam_attempts a
        join public.exam_deliveries d on d.id = a.exam_delivery_id
        where a.id = answer_media.attempt_id and app.teaches_class(d.class_id)
      )
    )
  );

-- Ôn tập câu sai (chỉ đọc)
alter policy wrong_answer_queue_admin_read          on public.wrong_answer_queue  using (app.is_manager());
alter policy wrong_answer_review_attempts_admin_read on public.wrong_answer_review_attempts using (app.is_manager());

-- Học phí
alter policy "admin toàn quyền invoices"            on public.tuition_invoices      using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền invoice_items"       on public.tuition_invoice_items using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền payments"            on public.tuition_payments      using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền receipts"            on public.tuition_receipts      using (app.is_manager()) with check (app.is_manager());

-- Thông báo
alter policy "admin toàn quyền announcements"          on public.announcements          using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền notifications"          on public.notifications          using (app.is_manager()) with check (app.is_manager());
alter policy "admin toàn quyền notification_preferences" on public.notification_preferences using (app.is_manager()) with check (app.is_manager());

-- =============================================================================
-- `profiles` — ĐỌC được, GHI thì không
--
-- Giáo vụ phải đọc `profiles` để dựng mọi danh sách người (tên hiển thị nằm ở
-- đây chứ không ở `students`/`teachers`). Nhưng `profiles` cũng là nơi giữ
-- `role` và `is_active` — hai cột định nghĩa "quản trị tài khoản".
--
-- Nên: THÊM một policy SELECT, KHÔNG đụng policy ALL của super_admin.
-- =============================================================================

drop policy if exists "giáo vụ đọc profiles" on public.profiles;
create policy "giáo vụ đọc profiles" on public.profiles
  for select to authenticated
  using (app.is_manager());

-- =============================================================================
-- `teachers` — SỬA hồ sơ được, TẠO/XOÁ thì không
--
-- Đây là chỗ cưỡng chế điểm (4) của `D-2` ở tầng DB.
--
-- `teachers.user_id` là `not null references auth.users` ⇒ mỗi hàng `teachers`
-- BẮT BUỘC gắn một tài khoản. Cho giáo vụ INSERT ở đây là cho họ tạo tài khoản
-- giáo viên bằng cửa sau, đúng thứ user đã loại. Chặn ở server action thôi thì
-- không đủ — RLS phải nói cùng một câu.
--
-- Hệ quả user đã nghe và vẫn chốt: giáo vụ KHÔNG thêm được giáo viên mới, và
-- không cho giáo viên nghỉ được. Hai việc đó vẫn qua super admin.
-- =============================================================================

drop policy if exists "giáo vụ đọc hồ sơ giáo viên" on public.teachers;
create policy "giáo vụ đọc hồ sơ giáo viên" on public.teachers
  for select to authenticated
  using (app.is_manager());

drop policy if exists "giáo vụ sửa hồ sơ giáo viên" on public.teachers;
create policy "giáo vụ sửa hồ sơ giáo viên" on public.teachers
  for update to authenticated
  using (app.is_manager()) with check (app.is_manager());

-- =============================================================================
-- 7 policy `storage` → quản lý
--
-- Mở: tài liệu khoá học · hồ sơ học viên · file bài nói (chấm/đối chiếu).
-- Giữ: avatar (gắn tài khoản) · flashcard_media · question_media (điểm 3).
-- =============================================================================

-- ⚠️ Cả 7 vế dưới đây chép từ `pg_policies` đang chạy, thay đúng một hàm.
-- Viết lại theo trí nhớ là sai: bucket thật tên `student-documents` (không phải
-- `student-docs`), `course_materials` khoá bằng `object_path` + `visibility`
-- (không phải `storage_path` + `is_published`), và course id lấy qua
-- `app.storage_root(name)::uuid` chứ không join bảng.

alter policy "tài liệu: đọc course liên quan" on storage.objects
  using (
    bucket_id = 'course-materials'
    and (
      app.is_manager()
      or app.teaches_course(app.storage_root(name)::uuid)
      or exists (
        select 1
        from public.course_materials m
        where m.object_path = storage.objects.name
          and m.visibility = 'enrolled_students'
          and app.studies_course(m.course_id)
      )
    )
  );

alter policy "tài liệu: giáo viên/admin tải lên" on storage.objects
  with check (
    bucket_id = 'course-materials'
    and (app.is_manager() or app.teaches_course(app.storage_root(name)::uuid))
  );

alter policy "tài liệu: giáo viên/admin xóa" on storage.objects
  using (
    bucket_id = 'course-materials'
    and (app.is_manager() or app.teaches_course(app.storage_root(name)::uuid))
  );

alter policy "hồ sơ HV: đọc của mình hoặc admin" on storage.objects
  using (
    bucket_id = 'student-documents'
    and (app.is_manager() or app.storage_root(name)::uuid = app.my_student_id())
  );

alter policy "hồ sơ HV: chỉ admin tải lên" on storage.objects
  with check (bucket_id = 'student-documents' and app.is_manager());

alter policy "hồ sơ HV: chỉ admin xóa" on storage.objects
  using (bucket_id = 'student-documents' and app.is_manager());

alter policy "bài nói: đọc của mình hoặc lớp mình dạy" on storage.objects
  using (
    bucket_id = 'answer-media'
    and (
      app.storage_root(name) = auth.uid()::text
      or app.is_manager()
      or exists (
        select 1
        from public.answer_media m
        where m.object_path = storage.objects.name
          and (
            (
              m.attempt_kind = 'exercise'
              and exists (
                select 1
                from public.exercise_attempts a
                join public.exercise_deliveries d on d.id = a.delivery_id
                where a.id = m.attempt_id and app.teaches_class(d.class_id)
              )
            )
            or (
              m.attempt_kind = 'exam'
              and exists (
                select 1
                from public.exam_attempts a
                join public.exam_deliveries d on d.id = a.exam_delivery_id
                where a.id = m.attempt_id and app.teaches_class(d.class_id)
              )
            )
          )
      )
    )
  );

-- =============================================================================
-- Đổi tên cho khỏi nói dối
--
-- Policy tên "admin toàn quyền X" mà thân là `is_manager()` chính là kiểu lệch
-- docs↔source mà `CLAUDE.md` liệt kê. Không test nào ghim các tên này (đã kiểm
-- `supabase/tests/database/`), nên đổi tên là an toàn.
-- =============================================================================

alter policy "admin toàn quyền levels"                   on public.levels                   rename to "quản lý toàn quyền levels";
alter policy "admin toàn quyền grading scale"            on public.grading_scale_rules      rename to "quản lý toàn quyền grading scale";
alter policy "admin toàn quyền courses"                  on public.courses                  rename to "quản lý toàn quyền courses";
alter policy "admin toàn quyền course_modules"           on public.course_modules           rename to "quản lý toàn quyền course_modules";
alter policy "admin toàn quyền lessons"                  on public.lessons                  rename to "quản lý toàn quyền lessons";
alter policy "admin toàn quyền course_materials"         on public.course_materials         rename to "quản lý toàn quyền course_materials";
alter policy "admin toàn quyền classes"                  on public.classes                  rename to "quản lý toàn quyền classes";
alter policy "admin toàn quyền class_teachers"           on public.class_teachers           rename to "quản lý toàn quyền class_teachers";
alter policy "admin toàn quyền class_schedules"          on public.class_schedules          rename to "quản lý toàn quyền class_schedules";
alter policy "admin toàn quyền class_sessions"           on public.class_sessions           rename to "quản lý toàn quyền class_sessions";
alter policy "admin toàn quyền students"                 on public.students                 rename to "quản lý toàn quyền students";
alter policy "admin toàn quyền enrollments"              on public.enrollments              rename to "quản lý toàn quyền enrollments";
alter policy "admin đọc lịch sử enrollment"              on public.enrollment_status_history rename to "quản lý đọc lịch sử enrollment";
alter policy "admin toàn quyền attendance"               on public.attendance_records       rename to "quản lý toàn quyền attendance";
alter policy "admin toàn quyền lesson_progress"          on public.lesson_progress          rename to "quản lý toàn quyền lesson_progress";
alter policy "admin toàn quyền learning_evaluations"     on public.learning_evaluations     rename to "quản lý toàn quyền learning_evaluations";
alter policy "admin toàn quyền student_notes"            on public.student_notes            rename to "quản lý toàn quyền student_notes";
alter policy "admin toàn quyền invoices"                 on public.tuition_invoices         rename to "quản lý toàn quyền invoices";
alter policy "admin toàn quyền invoice_items"            on public.tuition_invoice_items    rename to "quản lý toàn quyền invoice_items";
alter policy "admin toàn quyền payments"                 on public.tuition_payments         rename to "quản lý toàn quyền payments";
alter policy "admin toàn quyền receipts"                 on public.tuition_receipts         rename to "quản lý toàn quyền receipts";
alter policy "admin toàn quyền announcements"            on public.announcements            rename to "quản lý toàn quyền announcements";
alter policy "admin toàn quyền notifications"            on public.notifications            rename to "quản lý toàn quyền notifications";
alter policy "admin toàn quyền notification_preferences" on public.notification_preferences rename to "quản lý toàn quyền notification_preferences";

-- =============================================================================
-- CỔNG FAIL-CLOSED
--
-- Cùng hình dạng với cổng của `…085`: migration phải tự chứng minh nó làm đúng
-- việc, chứ không để lần chạy sau mới lộ.
--
-- Điều kiện: tập policy CÒN dùng `is_super_admin()` phải TRÙNG KHÍT danh sách
-- giữ lại dưới đây. Lệch theo bất kỳ chiều nào cũng ném lỗi:
--   • thiếu  ⇒ một policy đáng lẽ giữ đã bị nới nhầm cho giáo vụ
--   • thừa   ⇒ còn policy quản lý chưa đổi, giáo vụ sẽ gặp trang rỗng
-- =============================================================================

do $$
declare
  v_expected text[] := array[
    -- quản trị tài khoản & audit
    'public.audit_logs.chỉ admin đọc audit log',
    'public.profiles.admin toàn quyền profiles',
    'public.teachers.admin toàn quyền teachers',
    -- Flashcard (điểm 3)
    'public.flashcard_decks.flashcard_decks_admin_all',
    'public.flashcard_pages.flashcard_pages_admin_all',
    'public.flashcard_sections.flashcard_sections_admin_all',
    'public.flashcard_public_links.flashcard_public_links_admin_read',
    -- Duyệt câu hỏi / ngân hàng câu hỏi (điểm 3)
    'public.questions.admin_all_questions',
    'public.question_versions.admin_all_question_versions',
    'public.question_options.admin_all_question_options',
    'public.question_answer_keys.admin_all_question_answer_keys',
    'public.question_collections.admin_all_question_collections',
    'public.question_media.admin_all_question_media',
    'public.question_review_requests.admin_all_question_review_requests',
    'public.question_sets.admin_all_question_sets',
    'public.question_set_items.admin_all_question_set_items',
    'public.question_set_sections.admin_all_question_set_sections',
    'public.question_set_shares.admin_all_question_set_shares',
    'public.question_set_versions.admin_all_question_set_versions',
    'public.question_shares.admin_all_question_shares',
    'public.question_tags.admin_all_question_tags',
    'public.question_tag_links.admin_all_question_tag_links',
    -- storage: avatar gắn tài khoản, flashcard/question media theo điểm 3
    'storage.objects.avatar: đọc của chính mình',
    'storage.objects.avatar: tải lên của chính mình',
    'storage.objects.avatar: cập nhật của chính mình',
    'storage.objects.avatar: xóa của chính mình',
    'storage.objects.flashcard_media_admin_read',
    'storage.objects.flashcard_media_admin_insert',
    'storage.objects.flashcard_media_admin_delete',
    'storage.objects.question_media_owner_read',
    'storage.objects.question_media_owner_delete'
  ];
  v_actual   text[];
  v_leftover text[];
  v_missing  text[];
begin
  select coalesce(array_agg(schemaname || '.' || tablename || '.' || policyname order by 1), '{}')
    into v_actual
  from pg_policies
  where coalesce(qual, '') like '%is_super_admin%'
     or coalesce(with_check, '') like '%is_super_admin%';

  select coalesce(array_agg(x order by x), '{}') into v_leftover
  from unnest(v_actual) x where x <> all (v_expected);

  select coalesce(array_agg(x order by x), '{}') into v_missing
  from unnest(v_expected) x where x <> all (v_actual);

  if array_length(v_leftover, 1) > 0 then
    raise exception
      'GIAOVU-1b: còn % policy dùng is_super_admin() ngoài danh sách giữ lại: %. '
      'Phân loại nó rồi thêm vào v_expected hoặc đổi sang app.is_manager().',
      array_length(v_leftover, 1), array_to_string(v_leftover, ', ');
  end if;

  if array_length(v_missing, 1) > 0 then
    raise exception
      'GIAOVU-1b: % policy đáng lẽ GIỮ is_super_admin() nhưng không còn: %. '
      'Giáo vụ vừa được cấp quyền quản trị — dừng lại, đừng push.',
      array_length(v_missing, 1), array_to_string(v_missing, ', ');
  end if;

  raise notice 'GIAOVU-1b OK: % policy giữ is_super_admin(), phần còn lại đã sang is_manager().',
    array_length(v_expected, 1);
end;
$$;
