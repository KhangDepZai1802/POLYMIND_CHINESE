begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into public.courses (id, code, title, course_type, status)
values (
  '40000000-0000-0000-0000-000000000001',
  'TEST-ACTIVE-CLASS',
  'Khóa kiểm tra điều kiện kích hoạt lớp',
  'custom',
  'active'
);

insert into public.classes (
  id,
  code,
  course_id,
  name,
  capacity,
  planned_session_count,
  session_duration_minutes,
  start_date,
  delivery_mode,
  status
)
values (
  '41000000-0000-0000-0000-000000000001',
  'TEST-ACTIVE-01',
  '40000000-0000-0000-0000-000000000001',
  'Lớp kiểm tra điều kiện kích hoạt',
  10,
  35,
  90,
  date '2026-07-20',
  'offline',
  'planned'
);

select throws_ok(
  $$update public.classes
    set status = 'active'
    where id = '41000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không thể kích hoạt: lớp phải có đúng một giáo viên chính',
  'Không kích hoạt lớp khi chưa có giáo viên chính'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '42000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'teacher.active-class-test@polymind.test',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values (
  '42000000-0000-0000-0000-000000000001',
  'teacher',
  'Giáo viên kiểm tra',
  'teacher.active-class-test@polymind.test'
);

insert into public.teachers (id, user_id, teacher_code)
values (
  '43000000-0000-0000-0000-000000000001',
  '42000000-0000-0000-0000-000000000001',
  'GV-TEST-ACTIVE'
);

insert into public.class_teachers (id, class_id, teacher_id, assignment_role)
values (
  '44000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  '43000000-0000-0000-0000-000000000001',
  'primary'
);

select lives_ok(
  $$update public.classes
    set status = 'active'
    where id = '41000000-0000-0000-0000-000000000001'$$,
  'Kích hoạt lớp khi đã đủ cấu hình và có giáo viên chính'
);

select throws_ok(
  $$update public.classes
    set planned_session_count = null
    where id = '41000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không thể kích hoạt: lớp chưa chốt số buổi',
  'Không xóa cấu hình bắt buộc của lớp đang hoạt động'
);

select throws_ok(
  $$update public.class_teachers
    set assignment_role = 'assistant'
    where id = '44000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không thể gỡ hoặc đổi vai trò giáo viên chính khi lớp đang hoạt động',
  'Không hạ vai trò giáo viên chính khi lớp đang hoạt động'
);

select lives_ok(
  $$update public.classes
    set status = 'paused'
    where id = '41000000-0000-0000-0000-000000000001'$$,
  'Cho phép tạm dừng lớp trước khi thay đổi giáo viên chính'
);

select lives_ok(
  $$update public.class_teachers
    set assignment_role = 'assistant'
    where id = '44000000-0000-0000-0000-000000000001'$$,
  'Cho phép đổi vai trò giáo viên chính sau khi lớp đã tạm dừng'
);

select * from finish();

rollback;
