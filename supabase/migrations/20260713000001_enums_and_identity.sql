-- =============================================================================
-- 01 — Enum types, schema `app`, và bảng danh tính
-- =============================================================================

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

-- --- Enums -------------------------------------------------------------------

create type public.user_role as enum ('super_admin', 'teacher', 'student');

create type public.course_type as enum (
  'hsk', 'communication', 'kids', 'exam_prep', 'business_custom', 'custom'
);
create type public.course_status as enum ('draft', 'active', 'archived');
create type public.material_visibility as enum ('staff_only', 'enrolled_students');

create type public.class_status as enum (
  'planned', 'active', 'paused', 'completed', 'cancelled'
);
create type public.delivery_mode as enum ('offline', 'online', 'hybrid', 'in_house');
create type public.assignment_role as enum ('primary', 'assistant');
create type public.session_status as enum (
  'scheduled', 'completed', 'cancelled', 'rescheduled'
);

create type public.enrollment_status as enum (
  'pending', 'active', 'paused', 'completed', 'withdrawn', 'transferred'
);
create type public.attendance_status as enum ('present', 'late', 'absent', 'excused');
create type public.lesson_progress_status as enum (
  'not_started', 'in_progress', 'completed'
);

create type public.assignment_status as enum ('draft', 'published', 'closed');
create type public.submission_status as enum ('submitted', 'graded', 'returned');

create type public.assessment_type as enum (
  'quiz', 'midterm', 'final', 'mock_hsk', 'speaking', 'custom'
);
create type public.evaluation_rating as enum ('weak', 'average', 'good', 'excellent');
create type public.note_visibility as enum ('staff_only', 'student_visible');

create type public.invoice_status as enum (
  'draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'
);
create type public.payment_method as enum (
  'cash', 'bank_transfer', 'card', 'e_wallet', 'other'
);

create type public.notification_type as enum (
  'session_upcoming', 'session_changed',
  'assignment_new', 'assignment_due',
  'assessment_upcoming', 'result_published',
  'attendance_absent',
  'invoice_new', 'invoice_due', 'invoice_overdue',
  'announcement'
);

-- --- Trigger dùng chung: updated_at ------------------------------------------

create or replace function app.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --- profiles ----------------------------------------------------------------
-- 1-1 với auth.users. Nguồn sự thật DUY NHẤT về role.
-- (KHÔNG dùng auth.users.raw_user_meta_data — client sửa được nó.)

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null,
  full_name   text not null,
  phone       text,
  avatar_path text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ix_profiles_role on public.profiles (role);
create index ix_profiles_is_active on public.profiles (is_active);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

-- Chặn tự nâng quyền.
--
-- RLS cho phép user tự sửa profile của mình (đổi tên, số điện thoại). Nếu chỉ
-- dựa vào RLS, họ vẫn gửi kèm được `role = 'super_admin'` trong cùng request đó.
-- Trigger này chặn ở tầng dưới cùng: role và is_active chỉ đổi được bởi
-- service_role (admin flow server-only), bất kể policy viết thế nào.
create or replace function app.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role'
     or current_setting('request.jwt.claims', true) is null then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Không được tự đổi vai trò tài khoản';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Không được tự đổi trạng thái kích hoạt tài khoản';
  end if;

  return new;
end;
$$;

create trigger trg_profiles_no_self_escalation
  before update on public.profiles
  for each row execute function app.prevent_self_privilege_escalation();

-- --- teachers ----------------------------------------------------------------

create table public.teachers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users (id) on delete restrict,
  teacher_code   text not null unique,
  specialization text,
  bio            text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index ix_teachers_user_id on public.teachers (user_id);
create index ix_teachers_is_active on public.teachers (is_active);

create trigger trg_teachers_updated_at
  before update on public.teachers
  for each row execute function app.set_updated_at();

-- --- levels ------------------------------------------------------------------
-- Bảng danh mục, KHÔNG phải enum — trung tâm phải tạo được level nội bộ mà
-- không cần sửa code.

create table public.levels (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  framework   text not null default 'HSK',
  order_index integer not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_levels_updated_at
  before update on public.levels
  for each row execute function app.set_updated_at();

-- --- students ----------------------------------------------------------------
-- user_id NULLABLE: trung tâm nhập danh sách lớp trước, mời tài khoản sau.
--
-- guardian_* chỉ là THÔNG TIN LIÊN HỆ. Không có role phụ huynh (D-2).

create table public.students (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique references auth.users (id) on delete set null,
  student_code      text not null unique,
  full_name         text not null,
  dob               date,
  gender            text,
  phone             text,
  email             text,
  address           text,
  guardian_name     text,
  guardian_phone    text,
  guardian_relation text,
  current_level_id  uuid references public.levels (id) on delete set null,
  target_level_id   uuid references public.levels (id) on delete set null,
  learning_goal     text,
  joined_on         date not null default current_date,
  status            text not null default 'active',
  note              text,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index ix_students_user_id on public.students (user_id);
create index ix_students_status on public.students (status);
create index ix_students_current_level on public.students (current_level_id);

create trigger trg_students_updated_at
  before update on public.students
  for each row execute function app.set_updated_at();
