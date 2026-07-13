-- =============================================================================
-- 02 — Chương trình đào tạo: Course → Module → Lesson → Material
--
-- Course = BẢN THIẾT KẾ chương trình. Không có ngày bắt đầu, không có học viên.
-- Việc mở lớp thật là `classes` (migration 03).
-- =============================================================================

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  title       text not null,
  title_en    text,
  course_type public.course_type not null,

  -- Nullable: khóa tùy chỉnh/B2B không gắn vào bậc HSK nào.
  level_id    uuid references public.levels (id) on delete set null,

  target_audience text,
  objectives      text,
  description     text,

  -- Nullable ở catalog: trung tâm chưa cung cấp số liệu cho các khóa cốt lõi.
  -- Số buổi/thời lượng THẬT được chốt ở từng lớp (`classes`) trước khi kích hoạt.
  default_session_count            integer check (default_session_count > 0),
  default_session_duration_minutes integer check (default_session_duration_minutes > 0),
  default_tuition_amount           numeric(14, 2) check (default_tuition_amount >= 0),

  -- Điều kiện hoàn thành khóa (BR-9). Chỉnh được TRƯỚC khi lớp bắt đầu.
  completion_min_attendance_rate    numeric(5, 2) not null default 80
    check (completion_min_attendance_rate between 0 and 100),
  completion_min_overall_score      numeric(5, 2) not null default 50
    check (completion_min_overall_score between 0 and 100),
  completion_require_all_assignments boolean not null default false,

  status     public.course_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_courses_level_id on public.courses (level_id);
create index ix_courses_status on public.courses (status);
create index ix_courses_type on public.courses (course_type);

create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function app.set_updated_at();

-- --- course_modules (chương) --------------------------------------------------

create table public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  description text,
  order_index integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uq_course_modules_order unique (course_id, order_index)
);

create index ix_course_modules_course on public.course_modules (course_id);

create trigger trg_course_modules_updated_at
  before update on public.course_modules
  for each row execute function app.set_updated_at();

-- --- lessons (bài học) --------------------------------------------------------
-- KHÔNG lưu lặp course_id ở đây — truy được qua module_id. Hai nguồn sự thật cho
-- cùng một quan hệ là công thức để chúng lệch nhau.

create table public.lessons (
  id                      uuid primary key default gen_random_uuid(),
  module_id               uuid not null references public.course_modules (id) on delete cascade,
  title                   text not null,
  objectives              text,
  content_summary         text,
  planned_duration_minutes integer check (planned_duration_minutes > 0),
  order_index             integer not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint uq_lessons_order unique (module_id, order_index)
);

create index ix_lessons_module on public.lessons (module_id);

create trigger trg_lessons_updated_at
  before update on public.lessons
  for each row execute function app.set_updated_at();

-- --- course_materials ---------------------------------------------------------
-- FK THẬT cho cả 3 cấp (course/module/lesson) — không dùng polymorphic UUID mềm
-- như hệ cũ (không FK được, không cascade được, không index được tử tế).

create table public.course_materials (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  module_id   uuid references public.course_modules (id) on delete cascade,
  lesson_id   uuid references public.lessons (id) on delete cascade,

  title       text not null,
  object_path text not null,          -- bucket `course-materials`, path do SERVER sinh
  mime_type   text,
  size_bytes  bigint check (size_bytes >= 0),
  visibility  public.material_visibility not null default 'enrolled_students',

  uploaded_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ix_course_materials_course on public.course_materials (course_id);
create index ix_course_materials_module on public.course_materials (module_id);
create index ix_course_materials_lesson on public.course_materials (lesson_id);

create trigger trg_course_materials_updated_at
  before update on public.course_materials
  for each row execute function app.set_updated_at();

-- Bảo đảm module/lesson (nếu có) THUỘC ĐÚNG course đã khai báo.
-- CHECK constraint không tham chiếu được bảng khác nên phải dùng trigger.
create or replace function app.enforce_material_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  if new.module_id is not null then
    select course_id into v_course_id
    from public.course_modules where id = new.module_id;

    if v_course_id is distinct from new.course_id then
      raise exception 'Module không thuộc khóa học đã chọn';
    end if;
  end if;

  if new.lesson_id is not null then
    select m.course_id into v_course_id
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    where l.id = new.lesson_id;

    if v_course_id is distinct from new.course_id then
      raise exception 'Bài học không thuộc khóa học đã chọn';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_course_materials_hierarchy
  before insert or update on public.course_materials
  for each row execute function app.enforce_material_hierarchy();
