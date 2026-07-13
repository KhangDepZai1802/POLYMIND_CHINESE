-- =============================================================================
-- 03 — Lớp triển khai, phân công giáo viên, lịch lặp, buổi học
--
-- Class = MỘT LẦN MỞ LỚP cụ thể từ một Course. Học viên ghi danh vào Class.
-- Session = MỘT BUỔI HỌC CÓ THẬT trên trục thời gian của Class.
-- =============================================================================

create table public.classes (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,
  course_id uuid not null references public.courses (id) on delete restrict,
  name      text not null,

  target_audience text,   -- override của course, nullable

  capacity integer not null check (capacity > 0),

  -- Phải có giá trị TRƯỚC khi lớp chuyển sang `active` (cưỡng chế ở RPC).
  planned_session_count    integer check (planned_session_count > 0),
  session_duration_minutes integer check (session_duration_minutes > 0),

  start_date        date,
  expected_end_date date,

  delivery_mode public.delivery_mode not null,

  -- Địa điểm linh hoạt: lớp `in_house` của Ban Giám đốc VCB có thể học ở bất kỳ
  -- đâu khách hàng chỉ định → `location_note` cho mô tả tự do, KHÔNG ép chọn một
  -- cơ sở cố định.
  location_name text,
  address       text,
  meeting_url   text,
  location_note text,

  status     public.class_status not null default 'planned',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_classes_end_after_start
    check (expected_end_date is null or start_date is null or expected_end_date >= start_date)
);

create index ix_classes_course on public.classes (course_id);
create index ix_classes_status on public.classes (status);
create index ix_classes_start_date on public.classes (start_date);

create trigger trg_classes_updated_at
  before update on public.classes
  for each row execute function app.set_updated_at();

-- --- class_teachers -----------------------------------------------------------
-- BẢNG TRUNG TÂM CỦA TOÀN BỘ RLS GIÁO VIÊN.
-- Mọi câu hỏi "giáo viên này có được xem lớp kia không" đều quy về bảng này.

create table public.class_teachers (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes (id) on delete cascade,
  teacher_id      uuid not null references public.teachers (id) on delete restrict,
  assignment_role public.assignment_role not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint uq_class_teachers unique (class_id, teacher_id)
);

-- Mỗi lớp TỐI ĐA MỘT giáo viên chính. Trợ giảng thì không giới hạn.
-- Ràng buộc ở DB, không ở tầng app — app quên kiểm là lớp có 2 GV chính.
create unique index ux_class_teachers_one_primary
  on public.class_teachers (class_id)
  where assignment_role = 'primary';

create index ix_class_teachers_teacher on public.class_teachers (teacher_id, class_id);
create index ix_class_teachers_class on public.class_teachers (class_id);

create trigger trg_class_teachers_updated_at
  before update on public.class_teachers
  for each row execute function app.set_updated_at();

-- --- class_schedules (lịch lặp) -----------------------------------------------
-- Lớp LINH HOẠT được phép KHÔNG có row nào ở đây (LOP-01 — theo lịch Ban Giám
-- đốc VCB). Đó là yêu cầu nghiệp vụ, không phải dữ liệu thiếu.

create table public.class_schedules (
  id       uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,

  weekday    smallint not null check (weekday between 1 and 7),  -- ISO: 1 = Thứ Hai
  start_time time not null,
  end_time   time not null,

  effective_from date,
  effective_to   date,

  timezone   text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_class_schedules_time check (end_time > start_time),
  constraint ck_class_schedules_effective
    check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create index ix_class_schedules_class on public.class_schedules (class_id);

create trigger trg_class_schedules_updated_at
  before update on public.class_schedules
  for each row execute function app.set_updated_at();

-- --- class_sessions (buổi học) ------------------------------------------------

create table public.class_sessions (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  schedule_id uuid references public.class_schedules (id) on delete set null,
  lesson_id   uuid references public.lessons (id) on delete set null,

  session_number integer not null,

  -- LUÔN LƯU UTC. Hiển thị và sinh recurrence theo Asia/Ho_Chi_Minh ở tầng app.
  starts_at timestamptz not null,
  ends_at   timestamptz not null,

  topic        text,
  lesson_log   text,   -- nội dung THỰC DẠY (khác với `topic` là dự kiến)
  teacher_note text,

  status public.session_status not null default 'scheduled',

  -- Buổi gốc — cho học bù / đổi lịch. Nghỉ/đổi lịch là OVERRIDE, không xóa row.
  original_session_id uuid references public.class_sessions (id) on delete set null,

  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_class_sessions_time check (ends_at > starts_at),

  -- Chốt chặn IDEMPOTENCY cho việc sinh buổi học.
  -- RPC dùng `ON CONFLICT DO NOTHING` trên key này → chạy lại không sinh trùng.
  -- App-level check luôn thua race condition; unique index thì không.
  constraint uq_class_sessions_number unique (class_id, session_number)
);

create index ix_class_sessions_class on public.class_sessions (class_id);
create index ix_class_sessions_starts_at on public.class_sessions (starts_at);
create index ix_class_sessions_class_starts on public.class_sessions (class_id, starts_at);
create index ix_class_sessions_status on public.class_sessions (status);

create trigger trg_class_sessions_updated_at
  before update on public.class_sessions
  for each row execute function app.set_updated_at();
