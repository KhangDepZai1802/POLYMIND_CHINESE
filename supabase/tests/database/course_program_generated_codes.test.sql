begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_column('public', 'courses', 'program', 'courses có cột chương trình');
select col_is_null('public', 'courses', 'course_type', 'Loại khóa học cho phép rỗng với chương trình doanh nghiệp');

insert into public.courses (id, title, program, course_type)
values (
  'f1000000-0000-0000-0000-000000000001',
  'Khóa cốt lõi tự sinh mã',
  'core',
  'hsk'
);

insert into public.courses (id, title, program)
values (
  'f1000000-0000-0000-0000-000000000002',
  'Chương trình doanh nghiệp tự sinh mã',
  'business'
);

select matches(
  (select code from public.courses where id = 'f1000000-0000-0000-0000-000000000001'),
  '^KH[0-9]{6}$',
  'Mã khóa học do DB tự sinh'
);
select isnt(
  (select code from public.courses where id = 'f1000000-0000-0000-0000-000000000001'),
  (select code from public.courses where id = 'f1000000-0000-0000-0000-000000000002'),
  'Hai khóa học tạo liên tiếp có mã khác nhau'
);
select is(
  (select course_type from public.courses where id = 'f1000000-0000-0000-0000-000000000002'),
  null::public.course_type,
  'Chương trình doanh nghiệp không có Loại'
);

select throws_ok(
  $$insert into public.courses (title, program) values ('Core thiếu loại', 'core')$$,
  '23514',
  null,
  'Chương trình cốt lõi bắt buộc có Loại'
);
select throws_ok(
  $$insert into public.courses (title, program, course_type) values ('Doanh nghiệp có loại', 'business', 'custom')$$,
  '23514',
  null,
  'Chương trình doanh nghiệp từ chối Loại'
);
select throws_ok(
  $$insert into public.courses (title, program, course_type) values ('Core dùng loại B2B cũ', 'core', 'business_custom')$$,
  '22P02',
  null,
  'Loại business_custom đã bị loại khỏi enum'
);

insert into auth.users (id, email)
values ('f2000000-0000-0000-0000-000000000001', 'generated-code-teacher@polymind.test');
insert into public.profiles (id, role, full_name)
values ('f2000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên mã tự sinh');

insert into public.teachers (id, user_id)
values (
  'f3000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000001'
);
insert into public.students (id, full_name)
values ('f4000000-0000-0000-0000-000000000001', 'Học viên mã tự sinh');
insert into public.classes (id, course_id, name, capacity, delivery_mode)
values (
  'f5000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001',
  'Lớp tự sinh mã',
  10,
  'offline'
);

select matches(
  (select code from public.classes where id = 'f5000000-0000-0000-0000-000000000001'),
  '^LOP-[0-9]{6}$',
  'Mã lớp do DB tự sinh'
);
select matches(
  (select teacher_code from public.teachers where id = 'f3000000-0000-0000-0000-000000000001'),
  '^GV[0-9]{6}$',
  'Mã giáo viên do DB tự sinh'
);
select matches(
  (select student_code from public.students where id = 'f4000000-0000-0000-0000-000000000001'),
  '^HV[0-9]{6}$',
  'Mã học viên do DB tự sinh'
);

select has_function('app', 'next_business_code', array['text'], 'Có hàm sinh mã tập trung');
select function_privs_are(
  'app',
  'next_business_code',
  array['text'],
  'anon',
  array[]::text[],
  'Anonymous không được gọi hàm sinh mã'
);
select function_privs_are(
  'app',
  'next_business_code',
  array['text'],
  'authenticated',
  array['EXECUTE'],
  'Authenticated chỉ được EXECUTE hàm sinh mã'
);

select * from finish();
rollback;
