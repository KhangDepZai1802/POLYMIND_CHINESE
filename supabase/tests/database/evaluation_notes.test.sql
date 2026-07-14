begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'teacher.eval@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'teacher.outside-eval@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'student.eval@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('90000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên đánh giá', 'teacher.eval@polymind.test'),
  ('90000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên ngoài lớp', 'teacher.outside-eval@polymind.test'),
  ('90000000-0000-0000-0000-000000000003', 'student', 'Học viên được đánh giá', 'student.eval@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'GV-EVAL-1'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'GV-EVAL-2');

insert into public.courses (id, code, title, course_type, status)
values ('92000000-0000-0000-0000-000000000001', 'TEST-EVAL', 'Khóa đánh giá', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values (
  '93000000-0000-0000-0000-000000000001', 'TEST-EVAL-01',
  '92000000-0000-0000-0000-000000000001', 'Lớp đánh giá',
  10, 10, 90, date '2026-07-20', 'offline', 'planned'
);

insert into public.class_teachers (class_id, teacher_id, assignment_role)
values ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'primary');

insert into public.students (id, student_code, full_name, user_id)
values ('94000000-0000-0000-0000-000000000001', 'HV-EVAL-1', 'Học viên được đánh giá', '90000000-0000-0000-0000-000000000003');

insert into public.enrollments (id, student_id, class_id, status)
values (
  '95000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'active'
);

-- --- Giáo viên của lớp -------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Ghi chú nội bộ + ghi chú chia sẻ. created_by khai giả người khác.
insert into public.student_notes (id, enrollment_id, body, visibility, created_by)
values
  (
    '96000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    'Ghi chú nội bộ: gia đình đang có chuyện, cần nhẹ nhàng.',
    'staff_only',
    '90000000-0000-0000-0000-000000000002'
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '95000000-0000-0000-0000-000000000001',
    'Em tiến bộ rõ ở phần nghe, giữ nhịp này nhé.',
    'student_visible',
    '90000000-0000-0000-0000-000000000002'
  );

select is(
  (select created_by from public.student_notes where id = '96000000-0000-0000-0000-000000000001'),
  '90000000-0000-0000-0000-000000000001'::uuid,
  'created_by của ghi chú bị ép về actor thật, không phải giá trị client khai'
);

select is(
  (select visibility::text from public.student_notes where id = '96000000-0000-0000-0000-000000000001'),
  'staff_only',
  'Ghi chú mặc định/được chọn staff_only giữ nguyên phạm vi'
);

select throws_ok(
  $$update public.student_notes
    set enrollment_id = '95000000-0000-0000-0000-000000000001',
        created_by = '90000000-0000-0000-0000-000000000002'
    where id = '96000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không thể đổi người viết ghi chú',
  'Không sửa được created_by của ghi chú'
);

-- Đánh giá: client khai sẵn published_at + visible_to_student.
insert into public.learning_evaluations (
  id, enrollment_id, evaluation_date, overall_rating, listening_rating,
  teacher_comment, created_by, published_at, visible_to_student
)
values (
  '97000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  date '2026-07-20', 'good', 'excellent',
  'Tiến bộ tốt, cần luyện nói thêm.',
  '90000000-0000-0000-0000-000000000002',
  now(),
  true
);

select is(
  (select created_by from public.learning_evaluations where id = '97000000-0000-0000-0000-000000000001'),
  '90000000-0000-0000-0000-000000000001'::uuid,
  'created_by của đánh giá bị ép về actor thật'
);

select ok(
  (select published_at is null and not visible_to_student
   from public.learning_evaluations where id = '97000000-0000-0000-0000-000000000001'),
  'Đánh giá luôn sinh ra ở trạng thái NHÁP dù client khai đã công bố'
);

-- Công bố không phải là một cột form.
select throws_ok(
  $$update public.learning_evaluations set visible_to_student = true
    where id = '97000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'Không bật được visible_to_student bằng UPDATE trực tiếp'
);

select throws_ok(
  $$update public.learning_evaluations set published_at = now()
    where id = '97000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'Không set được published_at bằng UPDATE trực tiếp'
);

-- --- HỌC VIÊN: ranh giới staff_only (điểm cốt lõi của P4-T8) -----------------

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*)::integer from public.student_notes
   where id = '96000000-0000-0000-0000-000000000001'),
  0,
  '🔒 Học viên KHÔNG đọc được ghi chú staff_only của chính mình'
);

select is(
  (select count(*)::integer from public.student_notes
   where id = '96000000-0000-0000-0000-000000000002'),
  1,
  'Học viên đọc được ghi chú student_visible của chính mình'
);

select is(
  (select count(*)::integer from public.student_notes),
  1,
  'Quét toàn bảng student_notes bằng JWT học viên chỉ ra đúng ghi chú được chia sẻ'
);

select is(
  (select count(*)::integer from public.learning_evaluations),
  0,
  '🔒 Học viên KHÔNG đọc được đánh giá chưa công bố'
);

-- Học viên không được tự viết/sửa ghi chú về mình.
select throws_ok(
  $$insert into public.student_notes (enrollment_id, body, visibility, created_by)
    values ('95000000-0000-0000-0000-000000000001', 'Tự khen', 'student_visible',
            '90000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'Học viên không tạo được ghi chú trong hồ sơ của mình'
);

select lives_ok(
  $$update public.student_notes set body = 'Sửa trộm'
    where id = '96000000-0000-0000-0000-000000000002'$$,
  'Lệnh UPDATE của học viên chạy nhưng RLS lọc hết row'
);

select is(
  (select body from public.student_notes where id = '96000000-0000-0000-0000-000000000002'),
  'Em tiến bộ rõ ở phần nghe, giữ nhịp này nhé.',
  'Học viên không sửa được nội dung ghi chú (0 row qua RLS)'
);

-- --- IDOR: giáo viên ngoài lớp ----------------------------------------------

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::integer from public.student_notes),
  0,
  'Giáo viên lớp khác không đọc được ghi chú nào'
);

select throws_ok(
  $$select public.publish_evaluation('97000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Không có quyền công bố đánh giá này',
  'Giáo viên lớp khác không công bố được đánh giá'
);

-- --- Công bố đánh giá --------------------------------------------------------

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';

select ok(
  (public.publish_evaluation('97000000-0000-0000-0000-000000000001') ->> 'visible_to_student')::boolean,
  'RPC công bố bật visible_to_student'
);

select ok(
  (select published_at is not null and visible_to_student
   from public.learning_evaluations where id = '97000000-0000-0000-0000-000000000001'),
  'Công bố đặt CẢ HAI cột hiển thị cùng nhau (không lệch nửa vời)'
);

select throws_ok(
  $$delete from public.learning_evaluations where id = '97000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Đánh giá đã công bố nên không thể xóa',
  'Không hard delete được đánh giá đã công bố'
);

-- Thông báo: đúng 1, và công bố lại không sinh trùng.
set local role postgres;

select is(
  (select count(*)::integer from public.notifications
   where user_id = '90000000-0000-0000-0000-000000000003'
     and resource_id = '97000000-0000-0000-0000-000000000001'),
  1,
  'Học viên nhận đúng một thông báo đánh giá'
);

set local role authenticated;

select ok(
  (public.publish_evaluation('97000000-0000-0000-0000-000000000001') ->> 'already_published')::boolean,
  'Công bố lần hai báo đúng là đã công bố từ trước'
);

set local role postgres;

select is(
  (select count(*)::integer from public.notifications
   where user_id = '90000000-0000-0000-0000-000000000003'
     and resource_id = '97000000-0000-0000-0000-000000000001'),
  1,
  'Công bố lại không sinh thông báo trùng'
);

set local role authenticated;

-- --- Học viên sau khi công bố ------------------------------------------------

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select overall_rating::text from public.learning_evaluations
   where id = '97000000-0000-0000-0000-000000000001'),
  'good',
  'Học viên đọc được đánh giá SAU khi công bố'
);

reset role;

select * from finish();
rollback;
