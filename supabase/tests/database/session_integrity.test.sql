begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into public.courses (id, code, title, course_type, status)
values (
  '60000000-0000-0000-0000-000000000001',
  'TEST-SESSION-INT',
  'Khóa kiểm tra toàn vẹn buổi học',
  'custom',
  'active'
);

insert into public.classes (
  id, code, course_id, name, capacity,
  planned_session_count, session_duration_minutes, start_date,
  delivery_mode, status
)
values (
  '61000000-0000-0000-0000-000000000001',
  'TEST-SESSION-01',
  '60000000-0000-0000-0000-000000000001',
  'Lớp kiểm tra buổi học',
  10, 10, 90, date '2026-07-20', 'offline', 'planned'
);

-- Actor: super admin.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '62000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin.session-int-test@polymind.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values (
  '62000000-0000-0000-0000-000000000001',
  'super_admin',
  'Quản trị viên kiểm tra buổi học',
  'admin.session-int-test@polymind.test'
);

-- Người bị mạo danh.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '63000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'other.session-int-test@polymind.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values (
  '63000000-0000-0000-0000-000000000001',
  'teacher',
  'Người bị mạo danh',
  'other.session-int-test@polymind.test'
);

-- Học viên + ghi danh (để tạo được điểm danh).
insert into public.students (id, student_code, full_name)
values (
  '64000000-0000-0000-0000-000000000001',
  'HV-TEST-SESSION',
  'Học viên kiểm tra'
);

insert into public.enrollments (id, student_id, class_id, status)
values (
  '65000000-0000-0000-0000-000000000001',
  '64000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  'active'
);

-- --- Đóng vai actor đã đăng nhập ---------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"62000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- 1. Mạo danh `created_by` khi INSERT → bị ghi đè bằng auth.uid().
insert into public.class_sessions
  (id, class_id, session_number, starts_at, ends_at, created_by)
values (
  '66000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  1,
  timestamptz '2026-07-21 11:00:00+00',
  timestamptz '2026-07-21 12:30:00+00',
  '63000000-0000-0000-0000-000000000001'   -- khai là NGƯỜI KHÁC
);

select is(
  (select created_by from public.class_sessions
   where id = '66000000-0000-0000-0000-000000000001'),
  '62000000-0000-0000-0000-000000000001'::uuid,
  'Client khai created_by là người khác → DB ghi đè bằng auth.uid()'
);

-- 2. UPDATE cố đổi `created_by` → bất biến.
update public.class_sessions
set created_by = '63000000-0000-0000-0000-000000000001',
    topic = 'Đổi chủ đề'
where id = '66000000-0000-0000-0000-000000000001';

select is(
  (select created_by from public.class_sessions
   where id = '66000000-0000-0000-0000-000000000001'),
  '62000000-0000-0000-0000-000000000001'::uuid,
  'UPDATE không sửa được created_by — attribution là bất biến'
);

-- 3. Buổi `scheduled` chưa điểm danh → XÓA ĐƯỢC (buổi sinh nhầm, chưa có lịch sử).
insert into public.class_sessions
  (id, class_id, session_number, starts_at, ends_at)
values (
  '66000000-0000-0000-0000-000000000002',
  '61000000-0000-0000-0000-000000000001',
  2,
  timestamptz '2026-07-28 11:00:00+00',
  timestamptz '2026-07-28 12:30:00+00'
);

select lives_ok(
  $$delete from public.class_sessions
    where id = '66000000-0000-0000-0000-000000000002'$$,
  'Xóa được buổi scheduled chưa có điểm danh (sinh nhầm thì phải sửa được)'
);

-- 4. Buổi ĐÃ CÓ ĐIỂM DANH → không xóa được.
--    `attendance_records.session_id` là ON DELETE CASCADE: nếu không chặn thì
--    xóa buổi sẽ âm thầm cuốn theo toàn bộ điểm danh.
insert into public.attendance_records
  (session_id, enrollment_id, status, marked_by)
values (
  '66000000-0000-0000-0000-000000000001',
  '65000000-0000-0000-0000-000000000001',
  'present',
  '62000000-0000-0000-0000-000000000001'
);

select throws_ok(
  $$delete from public.class_sessions
    where id = '66000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không thể xóa buổi đã có điểm danh. Hãy hủy buổi (giữ lại lịch sử).',
  'Không xóa được buổi đã có điểm danh (chặn CASCADE nuốt lịch sử)'
);

select is(
  (select count(*)::int from public.attendance_records
   where session_id = '66000000-0000-0000-0000-000000000001'),
  1,
  'Điểm danh vẫn còn nguyên sau khi lệnh xóa bị từ chối'
);

-- 5. Buổi ĐÃ DẠY → không xóa được, kể cả khi chưa điểm danh ai.
insert into public.class_sessions
  (id, class_id, session_number, starts_at, ends_at, status)
values (
  '66000000-0000-0000-0000-000000000003',
  '61000000-0000-0000-0000-000000000001',
  3,
  timestamptz '2026-08-04 11:00:00+00',
  timestamptz '2026-08-04 12:30:00+00',
  'completed'
);

select throws_ok(
  $$delete from public.class_sessions
    where id = '66000000-0000-0000-0000-000000000003'$$,
  'P0001',
  'Không thể xóa buổi đã dạy. Hãy hủy buổi (giữ lại lịch sử).',
  'Không xóa được buổi đã dạy'
);

reset role;

select * from finish();

rollback;
