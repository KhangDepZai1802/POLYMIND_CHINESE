-- =============================================================================
-- 11 — Row Level Security
--
-- ĐÂY LÀ CHỐT CHẶN CUỐI CÙNG CỦA HỆ THỐNG.
--
-- Giả định làm việc: server SẼ có lúc sai. Middleware quên guard, server action
-- quên kiểm quyền, UI quên ẩn nút. Khi đó RLS là thứ duy nhất đứng giữa kẻ tấn
-- công và dữ liệu học viên.
--
-- Quy tắc:
--   • MỌI bảng public đều ENABLE RLS. Không ngoại lệ.
--   • `anon` KHÔNG có policy nào → deny toàn bộ (mặc định của Postgres).
--   • Mutation phải có cả USING và WITH CHECK — thiếu WITH CHECK thì user sửa
--     được row rồi đẩy nó ra ngoài scope của chính mình.
--   • Teacher: chỉ lớp ĐƯỢC PHÂN CÔNG. Student: chỉ dữ liệu CỦA CHÍNH MÌNH.
-- =============================================================================

alter table public.profiles                  enable row level security;
alter table public.teachers                  enable row level security;
alter table public.students                  enable row level security;
alter table public.levels                    enable row level security;
alter table public.courses                   enable row level security;
alter table public.course_modules            enable row level security;
alter table public.lessons                   enable row level security;
alter table public.course_materials          enable row level security;
alter table public.classes                   enable row level security;
alter table public.class_teachers            enable row level security;
alter table public.class_schedules           enable row level security;
alter table public.class_sessions            enable row level security;
alter table public.enrollments               enable row level security;
alter table public.enrollment_status_history enable row level security;
alter table public.attendance_records        enable row level security;
alter table public.lesson_progress           enable row level security;
alter table public.assignments               enable row level security;
alter table public.assignment_attachments    enable row level security;
alter table public.submissions               enable row level security;
alter table public.submission_files          enable row level security;
alter table public.assessments               enable row level security;
alter table public.assessment_results        enable row level security;
alter table public.grading_scale_rules       enable row level security;
alter table public.learning_evaluations      enable row level security;
alter table public.student_notes             enable row level security;
alter table public.tuition_invoices          enable row level security;
alter table public.tuition_invoice_items     enable row level security;
alter table public.tuition_payments          enable row level security;
alter table public.tuition_receipts          enable row level security;
alter table public.announcements             enable row level security;
alter table public.notifications             enable row level security;
alter table public.notification_preferences  enable row level security;
alter table public.audit_logs                enable row level security;

-- =============================================================================
-- profiles
-- =============================================================================

create policy "admin toàn quyền profiles" on public.profiles
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc profile của chính mình" on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Sửa profile của chính mình. `role` và `is_active` bị trigger
-- app.prevent_self_privilege_escalation() chặn riêng — WITH CHECK ở đây không
-- so sánh được với giá trị cũ nên không tự làm việc đó được.
create policy "sửa profile của chính mình" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Giáo viên xem được profile của học viên/đồng nghiệp trong lớp mình dạy
-- (để hiển thị tên, avatar trong roster).
create policy "giáo viên đọc profile người trong lớp mình" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.user_id = public.profiles.id and app.teaches_student(s.id)
    )
    or exists (
      select 1
      from public.teachers t
      join public.class_teachers ct on ct.teacher_id = t.id
      where t.user_id = public.profiles.id
        and app.teaches_class(ct.class_id)
    )
  );

-- Học viên xem được profile của giáo viên dạy lớp mình.
create policy "học viên đọc profile giáo viên của mình" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.teachers t
      join public.class_teachers ct on ct.teacher_id = t.id
      where t.user_id = public.profiles.id
        and app.studies_class(ct.class_id)
    )
  );

-- =============================================================================
-- teachers
-- =============================================================================

create policy "admin toàn quyền teachers" on public.teachers
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên đọc hồ sơ của chính mình" on public.teachers
  for select to authenticated
  using (user_id = auth.uid());

create policy "đọc giáo viên của lớp liên quan" on public.teachers
  for select to authenticated
  using (
    exists (
      select 1 from public.class_teachers ct
      where ct.teacher_id = public.teachers.id
        and (app.teaches_class(ct.class_id) or app.studies_class(ct.class_id))
    )
  );

-- =============================================================================
-- students
-- =============================================================================

create policy "admin toàn quyền students" on public.students
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "học viên đọc hồ sơ của chính mình" on public.students
  for select to authenticated
  using (user_id = auth.uid());

-- Giáo viên CHỈ thấy học viên có enrollment trong lớp mình dạy.
-- Học viên lớp khác → không tồn tại đối với giáo viên này.
create policy "giáo viên đọc học viên lớp mình" on public.students
  for select to authenticated
  using (app.teaches_student(id));

-- =============================================================================
-- levels · grading_scale_rules — danh mục, ai đăng nhập cũng đọc được
-- =============================================================================

create policy "admin toàn quyền levels" on public.levels
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "mọi người đọc levels" on public.levels
  for select to authenticated using (true);

create policy "admin toàn quyền grading scale" on public.grading_scale_rules
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "mọi người đọc grading scale" on public.grading_scale_rules
  for select to authenticated using (true);

-- =============================================================================
-- courses · course_modules · lessons · course_materials
-- =============================================================================

create policy "admin toàn quyền courses" on public.courses
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc course của lớp liên quan" on public.courses
  for select to authenticated
  using (app.teaches_course(id) or app.studies_course(id));

create policy "admin toàn quyền course_modules" on public.course_modules
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc module của course liên quan" on public.course_modules
  for select to authenticated
  using (app.teaches_course(course_id) or app.studies_course(course_id));

create policy "admin toàn quyền lessons" on public.lessons
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc bài học của course liên quan" on public.lessons
  for select to authenticated
  using (
    exists (
      select 1 from public.course_modules m
      where m.id = public.lessons.module_id
        and (app.teaches_course(m.course_id) or app.studies_course(m.course_id))
    )
  );

create policy "admin toàn quyền course_materials" on public.course_materials
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

-- Giáo viên thấy MỌI tài liệu của course mình dạy (kể cả `staff_only`).
create policy "giáo viên đọc tài liệu course mình dạy" on public.course_materials
  for select to authenticated
  using (app.teaches_course(course_id));

create policy "giáo viên thêm tài liệu course mình dạy" on public.course_materials
  for insert to authenticated
  with check (app.teaches_course(course_id));

create policy "giáo viên sửa tài liệu course mình dạy" on public.course_materials
  for update to authenticated
  using (app.teaches_course(course_id)) with check (app.teaches_course(course_id));

create policy "giáo viên xóa tài liệu course mình dạy" on public.course_materials
  for delete to authenticated
  using (app.teaches_course(course_id));

-- Học viên CHỈ thấy tài liệu `enrolled_students`. `staff_only` là vô hình.
create policy "học viên đọc tài liệu được công bố" on public.course_materials
  for select to authenticated
  using (app.studies_course(course_id) and visibility = 'enrolled_students');

-- =============================================================================
-- classes · class_teachers · class_schedules · class_sessions
-- =============================================================================

create policy "admin toàn quyền classes" on public.classes
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc lớp liên quan" on public.classes
  for select to authenticated
  using (app.teaches_class(id) or app.studies_class(id));

create policy "admin toàn quyền class_teachers" on public.class_teachers
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

-- Giáo viên CHỈ ĐỌC bảng phân công. KHÔNG có policy INSERT/UPDATE/DELETE.
-- Nếu cho ghi, giáo viên tự thêm mình vào lớp bất kỳ → toàn bộ RLS giáo viên
-- (vốn dựa hoàn toàn vào bảng này) sụp đổ.
create policy "đọc phân công của lớp liên quan" on public.class_teachers
  for select to authenticated
  using (app.teaches_class(class_id) or app.studies_class(class_id));

create policy "admin toàn quyền class_schedules" on public.class_schedules
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc lịch của lớp liên quan" on public.class_schedules
  for select to authenticated
  using (app.teaches_class(class_id) or app.studies_class(class_id));

create policy "admin toàn quyền class_sessions" on public.class_sessions
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc buổi học của lớp liên quan" on public.class_sessions
  for select to authenticated
  using (app.teaches_class(class_id) or app.studies_class(class_id));

create policy "giáo viên tạo buổi cho lớp mình" on public.class_sessions
  for insert to authenticated
  with check (app.teaches_class(class_id));

-- WITH CHECK cũng phải là teaches_class: không cho giáo viên "đẩy" một buổi học
-- sang lớp khác bằng cách đổi class_id.
create policy "giáo viên cập nhật buổi lớp mình" on public.class_sessions
  for update to authenticated
  using (app.teaches_class(class_id)) with check (app.teaches_class(class_id));

-- =============================================================================
-- enrollments · enrollment_status_history
-- =============================================================================

create policy "admin toàn quyền enrollments" on public.enrollments
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên đọc enrollment lớp mình" on public.enrollments
  for select to authenticated
  using (app.teaches_class(class_id));

create policy "học viên đọc enrollment của mình" on public.enrollments
  for select to authenticated
  using (student_id = app.my_student_id());

-- APPEND-ONLY: chỉ SELECT. Không ai (kể cả admin qua RLS thường) update/delete.
-- Ghi vào bảng này chỉ qua RPC SECURITY DEFINER.
create policy "admin đọc lịch sử enrollment" on public.enrollment_status_history
  for select to authenticated using (app.is_super_admin());

create policy "giáo viên đọc lịch sử enrollment lớp mình" on public.enrollment_status_history
  for select to authenticated using (app.teaches_enrollment(enrollment_id));

create policy "học viên đọc lịch sử enrollment của mình" on public.enrollment_status_history
  for select to authenticated using (app.owns_enrollment(enrollment_id));

-- =============================================================================
-- attendance_records · lesson_progress
-- =============================================================================

create policy "admin toàn quyền attendance" on public.attendance_records
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên đọc điểm danh lớp mình" on public.attendance_records
  for select to authenticated
  using (app.teaches_enrollment(enrollment_id));

create policy "giáo viên điểm danh lớp mình" on public.attendance_records
  for insert to authenticated
  with check (app.teaches_enrollment(enrollment_id));

create policy "giáo viên sửa điểm danh lớp mình" on public.attendance_records
  for update to authenticated
  using (app.teaches_enrollment(enrollment_id))
  with check (app.teaches_enrollment(enrollment_id));

-- Học viên CHỈ ĐỌC. Không có policy INSERT/UPDATE → không tự điểm danh cho mình.
create policy "học viên đọc điểm danh của mình" on public.attendance_records
  for select to authenticated
  using (app.owns_enrollment(enrollment_id));

create policy "admin toàn quyền lesson_progress" on public.lesson_progress
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên đọc tiến độ lớp mình" on public.lesson_progress
  for select to authenticated using (app.teaches_enrollment(enrollment_id));

create policy "giáo viên ghi tiến độ lớp mình" on public.lesson_progress
  for insert to authenticated with check (app.teaches_enrollment(enrollment_id));

create policy "giáo viên sửa tiến độ lớp mình" on public.lesson_progress
  for update to authenticated
  using (app.teaches_enrollment(enrollment_id))
  with check (app.teaches_enrollment(enrollment_id));

create policy "học viên đọc tiến độ của mình" on public.lesson_progress
  for select to authenticated using (app.owns_enrollment(enrollment_id));

-- =============================================================================
-- assignments · attachments · submissions · submission_files
-- =============================================================================

create policy "admin toàn quyền assignments" on public.assignments
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên toàn quyền assignment lớp mình" on public.assignments
  for all to authenticated
  using (app.teaches_class(class_id)) with check (app.teaches_class(class_id));

-- Học viên CHỈ thấy bài ĐÃ PUBLISH. Bài draft là vô hình.
create policy "học viên đọc bài tập đã publish" on public.assignments
  for select to authenticated
  using (app.studies_class(class_id) and published_at is not null);

create policy "admin toàn quyền assignment_attachments" on public.assignment_attachments
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên toàn quyền file bài tập lớp mình" on public.assignment_attachments
  for all to authenticated
  using (
    exists (select 1 from public.assignments a
            where a.id = assignment_id and app.teaches_class(a.class_id))
  )
  with check (
    exists (select 1 from public.assignments a
            where a.id = assignment_id and app.teaches_class(a.class_id))
  );

create policy "học viên đọc file bài tập đã publish" on public.assignment_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and app.studies_class(a.class_id)
        and a.published_at is not null
    )
  );

create policy "admin đọc/sửa submissions" on public.submissions
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên đọc bài nộp lớp mình" on public.submissions
  for select to authenticated using (app.teaches_enrollment(enrollment_id));

-- Giáo viên chấm bài (UPDATE). KHÔNG cho INSERT — bài nộp phải do học viên tạo.
create policy "giáo viên chấm bài lớp mình" on public.submissions
  for update to authenticated
  using (app.teaches_enrollment(enrollment_id))
  with check (app.teaches_enrollment(enrollment_id));

create policy "học viên đọc bài nộp của mình" on public.submissions
  for select to authenticated using (app.owns_enrollment(enrollment_id));

-- BA điều kiện để học viên nộp bài (BR-6):
--   1. enrollment là của CHÍNH MÌNH
--   2. assignment ĐÃ PUBLISH
--   3. assignment thuộc lớp MÌNH ĐANG HỌC
-- Thiếu một trong ba → từ chối.
create policy "học viên nộp bài của mình" on public.submissions
  for insert to authenticated
  with check (
    app.owns_enrollment(enrollment_id)
    and exists (
      select 1 from public.assignments a
      join public.enrollments e on e.id = enrollment_id
      where a.id = assignment_id
        and a.published_at is not null
        and a.class_id = e.class_id
    )
  );

-- Học viên sửa bài nộp của mình. Điểm/nhận xét/trạng thái bị trigger
-- app.prevent_student_grading() chặn — WITH CHECK không so được với giá trị cũ.
create policy "học viên sửa bài nộp của mình" on public.submissions
  for update to authenticated
  using (app.owns_enrollment(enrollment_id))
  with check (app.owns_enrollment(enrollment_id));

create policy "admin toàn quyền submission_files" on public.submission_files
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên đọc file bài nộp lớp mình" on public.submission_files
  for select to authenticated
  using (
    exists (select 1 from public.submissions s
            where s.id = submission_id and app.teaches_enrollment(s.enrollment_id))
  );

create policy "học viên đọc file bài nộp của mình" on public.submission_files
  for select to authenticated
  using (
    exists (select 1 from public.submissions s
            where s.id = submission_id and app.owns_enrollment(s.enrollment_id))
  );

create policy "học viên thêm file vào bài nộp của mình" on public.submission_files
  for insert to authenticated
  with check (
    exists (select 1 from public.submissions s
            where s.id = submission_id and app.owns_enrollment(s.enrollment_id))
  );

-- Chỉ xóa được file khi bài CHƯA chấm — chấm rồi mà xóa file là phá bằng chứng.
create policy "học viên xóa file bài nộp chưa chấm" on public.submission_files
  for delete to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and app.owns_enrollment(s.enrollment_id)
        and s.graded_at is null
    )
  );

-- =============================================================================
-- assessments · assessment_results · learning_evaluations · student_notes
-- =============================================================================

create policy "admin toàn quyền assessments" on public.assessments
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên toàn quyền bài KT lớp mình" on public.assessments
  for all to authenticated
  using (app.teaches_class(class_id)) with check (app.teaches_class(class_id));

create policy "học viên đọc bài KT lớp mình" on public.assessments
  for select to authenticated using (app.studies_class(class_id));

create policy "admin toàn quyền assessment_results" on public.assessment_results
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên toàn quyền kết quả lớp mình" on public.assessment_results
  for all to authenticated
  using (app.teaches_enrollment(enrollment_id))
  with check (app.teaches_enrollment(enrollment_id));

-- Học viên CHỈ thấy kết quả ĐÃ PUBLISH. Điểm draft là vô hình.
-- Đây là RLS, không phải `WHERE` ở tầng app — app quên thì lộ, RLS thì không.
create policy "học viên đọc kết quả đã publish" on public.assessment_results
  for select to authenticated
  using (app.owns_enrollment(enrollment_id) and published_at is not null);

create policy "admin toàn quyền learning_evaluations" on public.learning_evaluations
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên toàn quyền đánh giá lớp mình" on public.learning_evaluations
  for all to authenticated
  using (app.teaches_enrollment(enrollment_id))
  with check (app.teaches_enrollment(enrollment_id));

-- HAI điều kiện: đã publish VÀ giáo viên cho phép hiển thị.
create policy "học viên đọc đánh giá được công bố" on public.learning_evaluations
  for select to authenticated
  using (
    app.owns_enrollment(enrollment_id)
    and published_at is not null
    and visible_to_student
  );

create policy "admin toàn quyền student_notes" on public.student_notes
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "giáo viên toàn quyền ghi chú lớp mình" on public.student_notes
  for all to authenticated
  using (app.teaches_enrollment(enrollment_id))
  with check (app.teaches_enrollment(enrollment_id));

-- Ghi chú `staff_only` là VÔ HÌNH với học viên. Không API nào, không query nào,
-- không view nào cho họ thấy được.
create policy "học viên đọc ghi chú được chia sẻ" on public.student_notes
  for select to authenticated
  using (app.owns_enrollment(enrollment_id) and visibility = 'student_visible');

-- =============================================================================
-- HỌC PHÍ — giáo viên bị DENY TUYỆT ĐỐI (không có policy nào cho teacher)
-- =============================================================================

create policy "admin toàn quyền invoices" on public.tuition_invoices
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "học viên đọc hóa đơn của mình" on public.tuition_invoices
  for select to authenticated using (student_id = app.my_student_id());

create policy "admin toàn quyền invoice_items" on public.tuition_invoice_items
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "học viên đọc khoản mục hóa đơn của mình" on public.tuition_invoice_items
  for select to authenticated
  using (
    exists (select 1 from public.tuition_invoices i
            where i.id = invoice_id and i.student_id = app.my_student_id())
  );

create policy "admin toàn quyền payments" on public.tuition_payments
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

-- Học viên CHỈ ĐỌC. Không có policy INSERT → không tự ghi nhận "tôi đã đóng tiền".
create policy "học viên đọc thanh toán của mình" on public.tuition_payments
  for select to authenticated using (student_id = app.my_student_id());

create policy "admin toàn quyền receipts" on public.tuition_receipts
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "học viên đọc phiếu thu của mình" on public.tuition_receipts
  for select to authenticated
  using (
    exists (select 1 from public.tuition_payments p
            where p.id = payment_id and p.student_id = app.my_student_id())
  );

-- =============================================================================
-- announcements · notifications · notification_preferences
-- =============================================================================

create policy "admin toàn quyền announcements" on public.announcements
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc announcement liên quan" on public.announcements
  for select to authenticated
  using (
    published_at is not null
    and (expires_at is null or expires_at > now())
    and (
      class_id is null                       -- toàn hệ thống
      or app.teaches_class(class_id)
      or app.studies_class(class_id)
    )
  );

create policy "admin toàn quyền notifications" on public.notifications
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

create policy "đọc thông báo của mình" on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- Chỉ để đánh dấu đã đọc. WITH CHECK giữ user_id không đổi.
create policy "đánh dấu đã đọc thông báo của mình" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "quản lý tùy chọn thông báo của mình" on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "admin toàn quyền notification_preferences" on public.notification_preferences
  for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

-- =============================================================================
-- audit_logs — CHỈ super_admin ĐỌC. Không ai ghi/sửa/xóa qua RLS.
-- Ghi audit chỉ qua app.write_audit() (SECURITY DEFINER).
-- =============================================================================

create policy "chỉ admin đọc audit log" on public.audit_logs
  for select to authenticated using (app.is_super_admin());
