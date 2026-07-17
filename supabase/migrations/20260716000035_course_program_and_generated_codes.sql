-- =============================================================================
-- 35 — Tách dòng chương trình và tự sinh mã nghiệp vụ
--
-- Course thuộc đúng một trong hai dòng:
--   • core     → bắt buộc có loại HSK/giao tiếp/thiếu nhi/luyện thi/tùy chỉnh
--   • business → không có loại; nội dung được thiết kế riêng theo doanh nghiệp
--
-- Mã khóa học/lớp/giáo viên/học viên là định danh do hệ thống quản lý. Sequence
-- ở DB chống trùng khi nhiều request tạo đồng thời; các mã seed/lịch sử giữ nguyên.
-- =============================================================================

create type public.course_program as enum ('core', 'business');

alter table public.courses
  add column program public.course_program not null default 'core';

alter table public.courses
  alter column course_type drop not null;

update public.courses
set program = 'business',
    course_type = null
where course_type = 'business_custom';

-- PostgreSQL không hỗ trợ DROP VALUE khỏi enum. Thay enum để loại hẳn giá trị
-- business_custom cũ, tránh source/type tiếp tục gợi ý một lựa chọn không hợp lệ.
create type public.course_type_v2 as enum (
  'hsk', 'communication', 'kids', 'exam_prep', 'custom'
);

alter table public.courses
  alter column course_type type public.course_type_v2
  using (course_type::text::public.course_type_v2);

drop type public.course_type;
alter type public.course_type_v2 rename to course_type;

alter table public.courses
  add constraint courses_program_type_check
  check (
    (program = 'business' and course_type is null)
    or
    (
      program = 'core'
      and course_type is not null
      and course_type in ('hsk', 'communication', 'kids', 'exam_prep', 'custom')
    )
  );

create index ix_courses_program on public.courses (program);

create sequence public.course_code_seq;
create sequence public.class_code_seq;
create sequence public.teacher_code_seq;
create sequence public.student_code_seq;

do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(code from '^KH([0-9]+)$')::bigint), 0)
  into v_max
  from public.courses;
  perform setval('public.course_code_seq', greatest(v_max, 1), v_max > 0);

  select coalesce(max(substring(code from '^LOP-([0-9]+)$')::bigint), 0)
  into v_max
  from public.classes;
  perform setval('public.class_code_seq', greatest(v_max, 1), v_max > 0);

  select coalesce(max(substring(teacher_code from '^GV([0-9]+)$')::bigint), 0)
  into v_max
  from public.teachers;
  perform setval('public.teacher_code_seq', greatest(v_max, 1), v_max > 0);

  select coalesce(max(substring(student_code from '^HV([0-9]+)$')::bigint), 0)
  into v_max
  from public.students;
  perform setval('public.student_code_seq', greatest(v_max, 1), v_max > 0);
end;
$$;

create function app.next_business_code(p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind = 'course' then
    return 'KH' || lpad(nextval('public.course_code_seq')::text, 6, '0');
  elsif p_kind = 'class' then
    return 'LOP-' || lpad(nextval('public.class_code_seq')::text, 6, '0');
  elsif p_kind = 'teacher' then
    return 'GV' || lpad(nextval('public.teacher_code_seq')::text, 6, '0');
  elsif p_kind = 'student' then
    return 'HV' || lpad(nextval('public.student_code_seq')::text, 6, '0');
  end if;

  raise exception 'Loại mã nghiệp vụ không hợp lệ';
end;
$$;

revoke all on function app.next_business_code(text) from public, anon;
grant execute on function app.next_business_code(text) to authenticated, service_role;

revoke all on sequence public.course_code_seq from public, anon, authenticated;
revoke all on sequence public.class_code_seq from public, anon, authenticated;
revoke all on sequence public.teacher_code_seq from public, anon, authenticated;
revoke all on sequence public.student_code_seq from public, anon, authenticated;
grant all on sequence public.course_code_seq to service_role;
grant all on sequence public.class_code_seq to service_role;
grant all on sequence public.teacher_code_seq to service_role;
grant all on sequence public.student_code_seq to service_role;

alter table public.courses
  alter column code set default app.next_business_code('course');
alter table public.classes
  alter column code set default app.next_business_code('class');
alter table public.teachers
  alter column teacher_code set default app.next_business_code('teacher');
alter table public.students
  alter column student_code set default app.next_business_code('student');
