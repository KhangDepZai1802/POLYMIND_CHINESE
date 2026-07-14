begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into public.courses (id, code, title, course_type, status)
values (
  '50000000-0000-0000-0000-000000000001',
  'TEST-MATERIAL-ATTR',
  'Khóa kiểm tra attribution tài liệu',
  'custom',
  'active'
);

-- Actor: super admin (người THẬT SỰ tải lên).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '51000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin.material-attr-test@polymind.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values (
  '51000000-0000-0000-0000-000000000001',
  'super_admin',
  'Quản trị viên kiểm tra',
  'admin.material-attr-test@polymind.test'
);

-- Nạn nhân: người mà client sẽ cố mạo danh khi khai `uploaded_by`.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '52000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'victim.material-attr-test@polymind.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values (
  '52000000-0000-0000-0000-000000000001',
  'teacher',
  'Người bị mạo danh',
  'victim.material-attr-test@polymind.test'
);

-- --- Từ đây trở đi: đóng vai actor đã đăng nhập ------------------------------
-- Đúng cách một request PostgREST chạy: role `authenticated` + JWT claims.

set local role authenticated;
set local request.jwt.claims = '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- 1. Client MẠO DANH: khai uploaded_by là người khác → phải bị ghi đè bằng actor.
insert into public.course_materials (id, course_id, title, object_path, visibility, uploaded_by)
values (
  '53000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Tài liệu khai mạo danh',
  '50000000-0000-0000-0000-000000000001/mao-danh.pdf',
  'enrolled_students',
  '52000000-0000-0000-0000-000000000001'   -- khai là NGƯỜI KHÁC
);

select is(
  (select uploaded_by from public.course_materials
   where id = '53000000-0000-0000-0000-000000000001'),
  '51000000-0000-0000-0000-000000000001'::uuid,
  'Client khai uploaded_by là người khác → DB ghi đè bằng auth.uid()'
);

-- 2. Client BỎ TRỐNG uploaded_by → DB vẫn điền actor thật (không để NULL).
insert into public.course_materials (id, course_id, title, object_path, visibility)
values (
  '53000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000001',
  'Tài liệu không khai người tải',
  '50000000-0000-0000-0000-000000000001/khong-khai.pdf',
  'enrolled_students'
);

select is(
  (select uploaded_by from public.course_materials
   where id = '53000000-0000-0000-0000-000000000002'),
  '51000000-0000-0000-0000-000000000001'::uuid,
  'Client bỏ trống uploaded_by → DB điền auth.uid(), không để NULL'
);

-- 3. UPDATE cố đổi uploaded_by → bất biến, giữ nguyên người tải lên ban đầu.
update public.course_materials
set uploaded_by = '52000000-0000-0000-0000-000000000001',
    title = 'Đổi tên và cố đổi luôn người tải'
where id = '53000000-0000-0000-0000-000000000001';

select is(
  (select uploaded_by from public.course_materials
   where id = '53000000-0000-0000-0000-000000000001'),
  '51000000-0000-0000-0000-000000000001'::uuid,
  'UPDATE không sửa được uploaded_by — attribution là bất biến'
);

-- 4. Nhưng các trường khác vẫn sửa bình thường (trigger không chặn nhầm).
select is(
  (select title from public.course_materials
   where id = '53000000-0000-0000-0000-000000000001'),
  'Đổi tên và cố đổi luôn người tải',
  'UPDATE các trường khác vẫn hoạt động bình thường'
);

reset role;

select * from finish();

rollback;
