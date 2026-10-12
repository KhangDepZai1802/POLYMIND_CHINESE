-- B2C dùng bảng riêng; tuyệt đối không ghi vào public.classes của VCB.
create table public.b2c_programs (
  slug text primary key check (slug in ('tieng-anh', 'tieng-trung', 'tieng-viet', 'lop-ve', 'kem-1-1')),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.b2c_programs (slug, name, description, sort_order) values
  ('tieng-anh', 'Tiếng Anh', 'Các lớp tiếng Anh dành cho học viên đăng ký trực tiếp tại trung tâm.', 1),
  ('tieng-trung', 'Tiếng Trung', 'Các lớp tiếng Trung B2C, tách biệt với chương trình doanh nghiệp.', 2),
  ('tieng-viet', 'Tiếng Việt', 'Các lớp tiếng Việt dành cho học viên lẻ của trung tâm.', 3),
  ('lop-ve', 'Lớp Vẽ', 'Các lớp mỹ thuật và vẽ dành cho học viên lẻ.', 4),
  ('kem-1-1', 'Kèm 1-1', 'Các lớp cá nhân có lịch học và lộ trình riêng.', 5);

create sequence public.b2c_class_code_seq;

create table public.b2c_classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('B2C-' || lpad(nextval('public.b2c_class_code_seq')::text, 6, '0')),
  program_slug text not null references public.b2c_programs (slug) on update cascade on delete restrict,
  name text not null,
  level_name text,
  teacher_name text,
  weekdays_text text,
  time_text text,
  capacity integer not null default 15 check (capacity > 0),
  enrolled_count integer not null default 0 check (enrolled_count >= 0 and enrolled_count <= capacity),
  campus text,
  delivery_mode text not null default 'offline' check (delivery_mode in ('offline', 'online', 'hybrid')),
  start_date date,
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'completed', 'cancelled')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_b2c_classes_program on public.b2c_classes (program_slug, status);

create trigger trg_b2c_programs_updated_at before update on public.b2c_programs
  for each row execute function app.set_updated_at();
create trigger trg_b2c_classes_updated_at before update on public.b2c_classes
  for each row execute function app.set_updated_at();

alter table public.b2c_programs enable row level security;
alter table public.b2c_classes enable row level security;

create policy b2c_programs_manager_all on public.b2c_programs
  for all to authenticated using (app.is_manager()) with check (app.is_manager());
create policy b2c_classes_manager_all on public.b2c_classes
  for all to authenticated using (app.is_manager()) with check (app.is_manager());

grant select, insert, update, delete on public.b2c_programs, public.b2c_classes to authenticated;
grant usage, select on sequence public.b2c_class_code_seq to authenticated;
