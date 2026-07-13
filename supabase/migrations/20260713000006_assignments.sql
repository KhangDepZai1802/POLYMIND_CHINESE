-- =============================================================================
-- 06 — Bài tập và bài nộp
-- =============================================================================

create table public.assignments (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete set null,
  session_id uuid references public.class_sessions (id) on delete set null,

  title        text not null,
  instructions text,
  due_at       timestamptz,

  max_score numeric(5, 2) not null default 100 check (max_score > 0),

  allow_late_submission boolean not null default true,
  max_attempts          integer not null default 1 check (max_attempts > 0),

  status public.assignment_status not null default 'draft',

  -- Học viên CHỈ thấy bài có published_at IS NOT NULL.
  -- Cưỡng chế bằng RLS, không bằng `WHERE` ở tầng app (app quên là lộ).
  published_at timestamptz,

  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_assignments_class on public.assignments (class_id);
create index ix_assignments_class_published on public.assignments (class_id, published_at);
create index ix_assignments_due_at on public.assignments (due_at);

create trigger trg_assignments_updated_at
  before update on public.assignments
  for each row execute function app.set_updated_at();

-- --- assignment_attachments ---------------------------------------------------

create table public.assignment_attachments (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,

  object_path text not null,   -- bucket `assignment-files`, path do SERVER sinh
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint check (size_bytes >= 0),

  uploaded_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index ix_assignment_attachments_assignment
  on public.assignment_attachments (assignment_id);

-- --- submissions --------------------------------------------------------------

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,

  attempt_no  integer not null default 1 check (attempt_no > 0),
  text_answer text,

  submitted_at timestamptz,
  is_late      boolean not null default false,
  status       public.submission_status not null default 'submitted',

  -- Học viên KHÔNG sửa được 4 cột dưới (chặn bằng trigger + RLS WITH CHECK).
  score     numeric(5, 2) check (score >= 0),
  feedback  text,
  graded_by uuid references auth.users (id) on delete set null,
  graded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Bấm Nộp 2 lần → upsert, không sinh 2 bản ghi.
  constraint uq_submissions unique (assignment_id, enrollment_id)
);

create index ix_submissions_assignment on public.submissions (assignment_id);
create index ix_submissions_enrollment on public.submissions (enrollment_id);
create index ix_submissions_status on public.submissions (status);

create trigger trg_submissions_updated_at
  before update on public.submissions
  for each row execute function app.set_updated_at();

-- score <= assignment.max_score
-- CHECK constraint không tham chiếu được bảng khác → phải dùng trigger.
create or replace function app.enforce_submission_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_score numeric(5, 2);
begin
  if new.score is null then
    return new;
  end if;

  select max_score into v_max_score
  from public.assignments where id = new.assignment_id;

  if new.score > v_max_score then
    raise exception 'Điểm (%) vượt quá điểm tối đa của bài tập (%)',
      new.score, v_max_score;
  end if;

  return new;
end;
$$;

create trigger trg_submissions_score
  before insert or update on public.submissions
  for each row execute function app.enforce_submission_score();

-- Học viên không được tự chấm điểm cho mình.
--
-- RLS cho phép học viên UPDATE bài nộp của chính mình (để sửa nội dung trước
-- hạn). Nếu không chặn thêm, họ gửi kèm `score = 100` trong cùng request đó.
create or replace function app.prevent_student_grading()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_student boolean;
begin
  -- service_role (admin flow) và các đường ghi không có JWT thì bỏ qua.
  if current_setting('request.jwt.claims', true) is null then
    return new;
  end if;

  select (role = 'student') into v_is_student
  from public.profiles where id = auth.uid();

  if coalesce(v_is_student, false) then
    if new.score      is distinct from old.score
    or new.feedback   is distinct from old.feedback
    or new.graded_by  is distinct from old.graded_by
    or new.graded_at  is distinct from old.graded_at
    or new.status     is distinct from old.status then
      raise exception 'Học viên không được sửa điểm, nhận xét hoặc trạng thái chấm bài';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_submissions_no_student_grading
  before update on public.submissions
  for each row execute function app.prevent_student_grading();

-- --- submission_files ---------------------------------------------------------

create table public.submission_files (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,

  object_path text not null,   -- bucket `submissions`, path do SERVER sinh
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint check (size_bytes >= 0),

  created_at timestamptz not null default now()
);

create index ix_submission_files_submission on public.submission_files (submission_id);
