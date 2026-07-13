-- =============================================================================
-- 05 — Điểm danh và tiến độ bài học
-- =============================================================================

create table public.attendance_records (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.class_sessions (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,

  status public.attendance_status not null,

  check_in_at timestamptz,
  note        text,

  -- ACTOR THẬT đang đăng nhập. Không bao giờ là "user đầu tiên tìm thấy trong DB"
  -- (lỗi attribution có thật ở hệ cũ: BUG_M06_01, BUG_M12_01).
  marked_by uuid not null references auth.users (id) on delete restrict,
  marked_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Chốt chặn IDEMPOTENCY cho điểm danh hàng loạt.
  -- RPC bulk_mark_attendance dùng `ON CONFLICT ... DO UPDATE` trên key này →
  -- giáo viên bấm Lưu 2 lần vẫn chỉ có 1 bản ghi/học viên.
  constraint uq_attendance_session_enrollment unique (session_id, enrollment_id)
);

create index ix_attendance_session on public.attendance_records (session_id);
create index ix_attendance_enrollment on public.attendance_records (enrollment_id);
create index ix_attendance_status on public.attendance_records (status);

create trigger trg_attendance_updated_at
  before update on public.attendance_records
  for each row execute function app.set_updated_at();

-- Điểm danh chỉ được tạo cho enrollment THUỘC ĐÚNG LỚP của session.
--
-- Nếu chỉ kiểm ở app: một bug (hoặc một request giả mạo) là điểm danh học viên
-- lớp A vào buổi học lớp B. Trigger này chặn ở tầng dưới cùng — dù server sai,
-- DB vẫn giữ được tính đúng đắn.
create or replace function app.enforce_attendance_class_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_class_id    uuid;
  v_enrollment_class_id uuid;
begin
  select class_id into v_session_class_id
  from public.class_sessions where id = new.session_id;

  select class_id into v_enrollment_class_id
  from public.enrollments where id = new.enrollment_id;

  if v_session_class_id is distinct from v_enrollment_class_id then
    raise exception 'Học viên không thuộc lớp của buổi học này';
  end if;

  return new;
end;
$$;

create trigger trg_attendance_class_match
  before insert or update on public.attendance_records
  for each row execute function app.enforce_attendance_class_match();

-- --- lesson_progress ----------------------------------------------------------
-- KHÔNG có cột "% tiến độ" nhập tay như hệ cũ.
-- Tiến độ tổng hợp được TÍNH ở view `v_enrollment_progress` từ:
--   bài học hoàn thành + chuyên cần + bài tập đã nộp + điểm đã publish.

create table public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,

  status public.lesson_progress_status not null default 'not_started',

  completed_at timestamptz,
  teacher_note text,

  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_lesson_progress unique (enrollment_id, lesson_id)
);

create index ix_lesson_progress_enrollment on public.lesson_progress (enrollment_id);
create index ix_lesson_progress_lesson on public.lesson_progress (lesson_id);

create trigger trg_lesson_progress_updated_at
  before update on public.lesson_progress
  for each row execute function app.set_updated_at();
