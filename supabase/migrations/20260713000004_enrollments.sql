-- =============================================================================
-- 04 — Ghi danh
--
-- Enrollment nối một Student vào một Class. Nó là "hộ chiếu" để học viên đó tồn
-- tại trong lớp: điểm danh, bài nộp, điểm, đánh giá, học phí đều treo vào
-- enrollment_id — KHÔNG treo thẳng vào student_id.
--
-- Vì sao? Một học viên học được NHIỀU LỚP cùng lúc. Treo vào student_id thì
-- không biết điểm danh đó thuộc lớp nào.
-- =============================================================================

create table public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  class_id   uuid not null references public.classes (id) on delete restrict,

  status public.enrollment_status not null default 'pending',

  enrolled_on date not null default current_date,
  started_on  date,
  ended_on    date,
  reason      text,

  tuition_override_amount numeric(14, 2) check (tuition_override_amount >= 0),

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Một học viên chỉ ghi danh MỘT LẦN vào MỘT lớp (nhưng được vào nhiều lớp khác).
  constraint uq_enrollments_student_class unique (student_id, class_id)
);

create index ix_enrollments_student on public.enrollments (student_id);
create index ix_enrollments_class on public.enrollments (class_id);
create index ix_enrollments_status on public.enrollments (status);
create index ix_enrollments_class_status on public.enrollments (class_id, status);

create trigger trg_enrollments_updated_at
  before update on public.enrollments
  for each row execute function app.set_updated_at();

-- --- enrollment_status_history ------------------------------------------------
-- APPEND-ONLY. Không có policy UPDATE/DELETE cho bất kỳ role app nào.
--
-- Chuyển lớp KHÔNG xóa enrollment cũ: đánh dấu `transferred` + tạo enrollment
-- mới + ghi 2 dòng ở đây, tất cả trong MỘT transaction (RPC transfer_enrollment).

create table public.enrollment_status_history (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,

  old_status public.enrollment_status,       -- null khi vừa tạo enrollment
  new_status public.enrollment_status not null,
  reason     text,

  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index ix_enrollment_history_enrollment
  on public.enrollment_status_history (enrollment_id, changed_at desc);
