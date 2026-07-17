begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- =============================================================================
-- GATE PHASE 5: học viên KHÔNG thấy dữ liệu của học viên khác.
-- Kiểm bằng chính JWT của học viên, quét thẳng bảng — không phải "ẩn UI".
-- HV-A và HV-B học CÙNG MỘT LỚP: đây mới là ca khó, vì cùng lớp thì mọi điều kiện
-- theo `class_id` đều đúng cho cả hai.
-- =============================================================================

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
    'a0000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'hv.a@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'hv.b@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'gv.iso@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'student', 'Học viên A', 'hv.a@polymind.test'),
  ('a0000000-0000-0000-0000-000000000002', 'student', 'Học viên B', 'hv.b@polymind.test'),
  ('a0000000-0000-0000-0000-000000000003', 'teacher', 'Giáo viên ISO', 'gv.iso@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'GV-ISO');

insert into public.courses (id, code, title, course_type, status)
values
  ('a2000000-0000-0000-0000-000000000001', 'TEST-ISO', 'Khóa cách ly', 'custom', 'active'),
  ('a2000000-0000-0000-0000-000000000002', 'TEST-ISO-OTHER', 'Khóa lớp khác', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  ('a3000000-0000-0000-0000-000000000001', 'TEST-ISO-01',
   'a2000000-0000-0000-0000-000000000001', 'Lớp chung của A và B',
   10, 10, 90, date '2026-07-20', 'offline', 'planned'),
  ('a3000000-0000-0000-0000-000000000002', 'TEST-ISO-02',
   'a2000000-0000-0000-0000-000000000002', 'Lớp KHÔNG liên quan',
   10, 10, 90, date '2026-07-20', 'offline', 'planned');

insert into public.class_teachers (class_id, teacher_id)
values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003'),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003');

insert into public.students (id, student_code, full_name, user_id)
values
  ('a4000000-0000-0000-0000-000000000001', 'HV-ISO-A', 'Học viên A', 'a0000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000002', 'HV-ISO-B', 'Học viên B', 'a0000000-0000-0000-0000-000000000002');

-- A và B CÙNG lớp.
insert into public.enrollments (id, student_id, class_id, status)
values
  ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'active'),
  ('a5000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'active');

insert into public.class_sessions (id, class_id, session_number, starts_at, ends_at)
values (
  'a6000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1,
  timestamptz '2026-07-21 01:00:00+00', timestamptz '2026-07-21 02:30:00+00'
);

-- Điểm danh: A có mặt, B vắng.
insert into public.attendance_records (session_id, enrollment_id, status, marked_by)
values
  ('a6000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'present',
   'a0000000-0000-0000-0000-000000000003'),
  ('a6000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002', 'absent',
   'a0000000-0000-0000-0000-000000000003');

-- =============================================================================
-- Đăng nhập bằng HỌC VIÊN A
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::integer from public.students),
  1,
  '🔒 A quét bảng students chỉ thấy hồ sơ CỦA CHÍNH MÌNH (không thấy B cùng lớp)'
);

select is(
  (select student_code from public.students),
  'HV-ISO-A',
  'Hồ sơ A đọc được đúng là của A'
);

select is(
  (select count(*)::integer from public.enrollments),
  1,
  '🔒 A chỉ thấy ghi danh của mình, không thấy ghi danh của B cùng lớp'
);

select is(
  (select count(*)::integer from public.attendance_records),
  1,
  '🔒 A chỉ thấy điểm danh của mình (1 dòng), không thấy của B'
);

select is(
  (select status::text from public.attendance_records),
  'present',
  'Điểm danh A đọc được đúng là của A'
);

-- A tự nâng quyền.
select throws_ok(
  $$update public.profiles set role = 'super_admin'
    where id = 'a0000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không được tự đổi vai trò tài khoản',
  '🔒 A KHÔNG tự nâng vai trò lên super_admin'
);

reset role;

select * from finish();
rollback;
