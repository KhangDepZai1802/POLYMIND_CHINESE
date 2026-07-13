-- =============================================================================
-- 10 — Helper functions cho RLS (schema `app`)
--
-- ⚠️ NGUYÊN TẮC SỐ 1: FAIL-CLOSED.
--
-- Mọi hàm ở đây trả `false` / `null` khi thiếu mapping hoặc tài khoản bị khóa.
-- KHÔNG hàm nào có nhánh `return true` mặc định.
--
-- Đây không phải sự cẩn thận thừa: hệ cũ có `MessagingPolicy.CanMessage` với
-- fallback `return true` → mọi cặp người dùng không khớp rule nào đều được cho
-- qua, dẫn tới "nhắn loạn xạ" (CR-M14-3). Một dòng `return true` là đủ để vô
-- hiệu hóa cả hệ thống phân quyền.
--
-- Kỹ thuật:
--   SECURITY DEFINER  → đọc được profiles/teachers/students mà không kích hoạt
--                        lại RLS của chính các bảng đó (tránh đệ quy vô hạn).
--   SET search_path=''→ chống search_path hijack; mọi tên phải schema-qualified.
--   STABLE            → Postgres cache được trong cùng một câu lệnh.
-- =============================================================================

create or replace function app.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active;      -- tài khoản khóa → trả null → mọi thứ phía sau deny
$$;

create or replace function app.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select is_active from public.profiles where id = auth.uid()),
    false               -- không có profile → false, KHÔNG phải true
  );
$$;

create or replace function app.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_role() = 'super_admin', false);
$$;

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
    and p.role = 'teacher';
$$;

create or replace function app.my_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.students s
  join public.profiles p on p.id = s.user_id
  where s.user_id = auth.uid()
    and p.is_active
    and p.role = 'student';
$$;

-- Giáo viên hiện tại có được phân công dạy lớp này không?
create or replace function app.teaches_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_teachers ct
    where ct.class_id = p_class_id
      and ct.teacher_id = app.my_teacher_id()
  );
$$;

-- Học viên hiện tại có đang/đã học lớp này không?
--
-- `pending` KHÔNG được tính: người mới đăng ký chưa được kích hoạt thì chưa
-- được xem tài liệu/roster của lớp.
create or replace function app.studies_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.class_id = p_class_id
      and e.student_id = app.my_student_id()
      and e.status in ('active', 'paused', 'completed')
  );
$$;

-- Enrollment này có phải của học viên hiện tại không?
create or replace function app.owns_enrollment(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.id = p_enrollment_id
      and e.student_id = app.my_student_id()
  );
$$;

-- Enrollment này có thuộc lớp mà giáo viên hiện tại dạy không?
create or replace function app.teaches_enrollment(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.class_teachers ct on ct.class_id = e.class_id
    where e.id = p_enrollment_id
      and ct.teacher_id = app.my_teacher_id()
  );
$$;

-- Học viên (students.id) này có nằm trong lớp nào mà giáo viên hiện tại dạy không?
create or replace function app.teaches_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.class_teachers ct on ct.class_id = e.class_id
    where e.student_id = p_student_id
      and ct.teacher_id = app.my_teacher_id()
  );
$$;

-- Giáo viên hiện tại có dạy lớp nào dùng course này không?
create or replace function app.teaches_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.class_teachers ct on ct.class_id = c.id
    where c.course_id = p_course_id
      and ct.teacher_id = app.my_teacher_id()
  );
$$;

-- Học viên hiện tại có học lớp nào dùng course này không?
create or replace function app.studies_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes c
    join public.enrollments e on e.class_id = c.id
    where c.course_id = p_course_id
      and e.student_id = app.my_student_id()
      and e.status in ('active', 'paused', 'completed')
  );
$$;

-- --- Quyền thực thi -----------------------------------------------------------
-- `anon` KHÔNG được gọi bất kỳ hàm nào — chưa đăng nhập thì không có gì để hỏi.

revoke all on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated, service_role;
