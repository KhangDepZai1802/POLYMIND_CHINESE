begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

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
    '70000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'teacher.session-log@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'teacher.outside-session@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('70000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên nhật ký', 'teacher.session-log@polymind.test'),
  ('70000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên ngoài lớp', 'teacher.outside-session@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'GV-SESSION-1'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'GV-SESSION-2');

insert into public.courses (id, code, title, course_type, status)
values
  ('72000000-0000-0000-0000-000000000001', 'TEST-SESSION-LOG', 'Khóa kiểm tra nhật ký', 'custom', 'active'),
  ('72000000-0000-0000-0000-000000000002', 'TEST-OTHER-COURSE', 'Khóa khác', 'custom', 'active');

insert into public.course_modules (id, course_id, title, order_index)
values
  ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Chương kiểm tra', 1),
  ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', 'Chương khóa khác', 1);

insert into public.lessons (id, module_id, title, order_index)
values
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Bài thuộc lớp', 1),
  ('74000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', 'Bài khóa khác', 1);

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values (
  '75000000-0000-0000-0000-000000000001', 'TEST-SESSION-LOG-01',
  '72000000-0000-0000-0000-000000000001', 'Lớp kiểm tra nhật ký',
  10, 10, 90, date '2026-07-20', 'offline', 'planned'
);

insert into public.class_teachers (class_id, teacher_id, assignment_role)
values (
  '75000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  'primary'
);

insert into public.students (id, student_code, full_name)
values ('76000000-0000-0000-0000-000000000001', 'HV-SESSION-LOG', 'Học viên nhật ký');

insert into public.enrollments (id, student_id, class_id, status)
values (
  '77000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  '75000000-0000-0000-0000-000000000001',
  'active'
);

insert into public.class_sessions (
  id, class_id, session_number, starts_at, ends_at, topic
)
values (
  '78000000-0000-0000-0000-000000000001',
  '75000000-0000-0000-0000-000000000001',
  1,
  timestamptz '2026-07-21 11:00:00+00',
  timestamptz '2026-07-21 12:30:00+00',
  'Chủ đề dự kiến'
);

-- --- Giáo viên đúng lớp ------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  public.save_session_log(
    '78000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001',
    'Nội dung thực dạy nháp',
    'Ghi chú nội bộ',
    false
  ),
  0,
  'Lưu nháp nhật ký chưa cập nhật lesson progress'
);

select is(
  (select lesson_log from public.class_sessions where id = '78000000-0000-0000-0000-000000000001'),
  'Nội dung thực dạy nháp',
  'Nội dung thực dạy được lưu đúng'
);

select is(
  (select status::text from public.class_sessions where id = '78000000-0000-0000-0000-000000000001'),
  'scheduled',
  'Lưu nháp không tự hoàn tất buổi'
);

-- Không còn UPDATE policy trực tiếp cho teacher: lệnh chạy nhưng RLS lọc 0 row.
update public.class_sessions
set lesson_log = 'Cố lách RPC'
where id = '78000000-0000-0000-0000-000000000001';

select is(
  (select lesson_log from public.class_sessions where id = '78000000-0000-0000-0000-000000000001'),
  'Nội dung thực dạy nháp',
  'Giáo viên không thể update class_sessions trực tiếp để bỏ qua transaction'
);

-- Bài học của course khác phải bị từ chối dù UUID có thật.
select throws_ok(
  $$select public.save_session_log(
      '78000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000002',
      'Sai course', null, false)$$,
  'P0001',
  'Bài học không thuộc khóa học của lớp',
  'Không gắn được lesson của course khác vào session'
);

-- Giáo viên ngoài lớp không gọi được RPC.
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select public.save_session_log(
      '78000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000001',
      'Không được phép', null, false)$$,
  'P0001',
  'Không có quyền cập nhật nhật ký buổi học này',
  'Giáo viên ngoài lớp bị RPC từ chối'
);

-- Hoàn tất bằng đúng giáo viên của lớp.
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  public.save_session_log(
    '78000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001',
    'Nội dung thực dạy hoàn chỉnh',
    'Ghi chú sau buổi',
    true
  ),
  1,
  'Hoàn tất buổi cập nhật progress cho đúng một enrollment đang mở'
);

select is(
  (select status::text from public.class_sessions where id = '78000000-0000-0000-0000-000000000001'),
  'completed',
  'Session chuyển sang completed'
);

select is(
  (select completed_by from public.class_sessions where id = '78000000-0000-0000-0000-000000000001'),
  '70000000-0000-0000-0000-000000000001'::uuid,
  'completed_by là actor thật từ auth.uid()'
);

select ok(
  (select completed_at is not null from public.class_sessions where id = '78000000-0000-0000-0000-000000000001'),
  'completed_at do DB đặt'
);

select is(
  (select status::text from public.lesson_progress
   where enrollment_id = '77000000-0000-0000-0000-000000000001'
     and lesson_id = '74000000-0000-0000-0000-000000000001'),
  'completed',
  'Lesson progress được hoàn tất trong cùng transaction'
);

select is(
  (select updated_by from public.lesson_progress
   where enrollment_id = '77000000-0000-0000-0000-000000000001'
     and lesson_id = '74000000-0000-0000-0000-000000000001'),
  '70000000-0000-0000-0000-000000000001'::uuid,
  'updated_by của lesson progress là actor thật'
);

-- Replay đúng payload: không tạo trùng và không ghi đè lịch sử.
select is(
  public.save_session_log(
    '78000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001',
    'Nội dung thực dạy hoàn chỉnh',
    'Ghi chú sau buổi',
    true
  ),
  1,
  'Gửi lại đúng request hoàn tất trả kết quả hiện có'
);

select is(
  (select count(*)::integer from public.lesson_progress
   where enrollment_id = '77000000-0000-0000-0000-000000000001'
     and lesson_id = '74000000-0000-0000-0000-000000000001'),
  1,
  'Replay không sinh trùng lesson_progress'
);

reset role;

select * from finish();
rollback;
