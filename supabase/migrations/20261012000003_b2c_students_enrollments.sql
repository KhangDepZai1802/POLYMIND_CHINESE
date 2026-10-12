-- Hồ sơ học viên và đăng ký học B2C tách riêng hoàn toàn khỏi students/enrollments của VCB.
alter table public.b2c_classes
  add column if not exists source_key text;

create unique index if not exists ux_b2c_classes_source_key
  on public.b2c_classes (source_key);

create table if not exists public.b2c_students (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  full_name text not null,
  date_of_birth date,
  birth_year integer check (birth_year between 1900 and 2100),
  guardian_name text,
  email text,
  address text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.b2c_enrollments (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  class_id uuid not null references public.b2c_classes (id) on delete cascade,
  student_id uuid not null references public.b2c_students (id) on delete cascade,
  salesperson text,
  enrollment_date date,
  payment_date date,
  learning_start_date date,
  tuition_end_date date,
  registered_sessions integer check (registered_sessions > 0),
  sessions_per_week integer check (sessions_per_week > 0),
  notes text,
  source_file text,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_b2c_enrollments_class_student unique (class_id, student_id)
);

create index if not exists ix_b2c_enrollments_class on public.b2c_enrollments (class_id);
create index if not exists ix_b2c_enrollments_student on public.b2c_enrollments (student_id);

drop trigger if exists trg_b2c_students_updated_at on public.b2c_students;
create trigger trg_b2c_students_updated_at before update on public.b2c_students
  for each row execute function app.set_updated_at();
drop trigger if exists trg_b2c_enrollments_updated_at on public.b2c_enrollments;
create trigger trg_b2c_enrollments_updated_at before update on public.b2c_enrollments
  for each row execute function app.set_updated_at();

alter table public.b2c_students enable row level security;
alter table public.b2c_enrollments enable row level security;

drop policy if exists b2c_students_manager_all on public.b2c_students;
create policy b2c_students_manager_all on public.b2c_students
  for all to authenticated using (app.is_manager()) with check (app.is_manager());
drop policy if exists b2c_enrollments_manager_all on public.b2c_enrollments;
create policy b2c_enrollments_manager_all on public.b2c_enrollments
  for all to authenticated using (app.is_manager()) with check (app.is_manager());

grant select, insert, update, delete on public.b2c_students, public.b2c_enrollments to authenticated;

notify pgrst, 'reload schema';
