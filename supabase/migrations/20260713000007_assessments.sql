-- =============================================================================
-- 07 — Kiểm tra, xếp loại, đánh giá định kỳ, ghi chú
-- =============================================================================

-- --- grading_scale_rules ------------------------------------------------------
-- Thang xếp loại CẤU HÌNH ĐƯỢC. Không hard-code label rải rác trong UI.

create table public.grading_scale_rules (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  min_score   numeric(5, 2) not null check (min_score between 0 and 100),
  max_score   numeric(5, 2) not null check (max_score between 0 and 100),
  order_index integer not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint ck_grading_scale_range check (max_score > min_score)
);

-- Ngưỡng KHÔNG được chồng lấn. Nếu chồng, một điểm số sẽ khớp 2 label → xếp loại
-- phụ thuộc thứ tự trả về của DB (không xác định).
-- `[)` = bao gồm min, loại trừ max → 50 thuộc "Trung bình", không thuộc "Yếu".
alter table public.grading_scale_rules
  add constraint ex_grading_no_overlap
  exclude using gist (numrange(min_score, max_score, '[)') with &&)
  where (is_active);

create trigger trg_grading_scale_updated_at
  before update on public.grading_scale_rules
  for each row execute function app.set_updated_at();

-- --- assessments --------------------------------------------------------------

create table public.assessments (
  id        uuid primary key default gen_random_uuid(),
  class_id  uuid not null references public.classes (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  module_id uuid references public.course_modules (id) on delete set null,

  type  public.assessment_type not null,
  title text not null,

  assessment_date date,
  max_score       numeric(5, 2) not null default 100 check (max_score > 0),

  -- vd {"listening":25,"speaking":25,"reading":25,"writing":25}
  skill_weights jsonb,

  published_at timestamptz,

  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_assessments_class on public.assessments (class_id);
create index ix_assessments_date on public.assessments (assessment_date);

create trigger trg_assessments_updated_at
  before update on public.assessments
  for each row execute function app.set_updated_at();

-- --- assessment_results -------------------------------------------------------

create table public.assessment_results (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,

  overall_score numeric(5, 2) check (overall_score between 0 and 100),

  -- 6 kỹ năng, nullable — không phải bài kiểm tra nào cũng chấm đủ.
  listening_score  numeric(5, 2) check (listening_score  between 0 and 100),
  speaking_score   numeric(5, 2) check (speaking_score   between 0 and 100),
  reading_score    numeric(5, 2) check (reading_score    between 0 and 100),
  writing_score    numeric(5, 2) check (writing_score    between 0 and 100),
  vocabulary_score numeric(5, 2) check (vocabulary_score between 0 and 100),
  grammar_score    numeric(5, 2) check (grammar_score    between 0 and 100),

  -- SERVER tính từ grading_scale_rules. Client gửi lên cũng bị trigger ghi đè.
  classification text,

  feedback  text,
  graded_by uuid references auth.users (id) on delete set null,
  graded_at timestamptz,

  -- Draft và publish là HAI hành động tách biệt.
  -- Học viên chỉ thấy row có published_at IS NOT NULL (cưỡng chế bằng RLS).
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_assessment_results unique (assessment_id, enrollment_id)
);

create index ix_assessment_results_assessment on public.assessment_results (assessment_id);
create index ix_assessment_results_enrollment on public.assessment_results (enrollment_id);
create index ix_assessment_results_published on public.assessment_results (published_at);

create trigger trg_assessment_results_updated_at
  before update on public.assessment_results
  for each row execute function app.set_updated_at();

-- Xếp loại LUÔN do server tính, tra từ grading_scale_rules.
-- Không tin `classification` client gửi lên — ghi đè vô điều kiện.
create or replace function app.compute_classification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.overall_score is null then
    new.classification := null;
    return new;
  end if;

  select label into new.classification
  from public.grading_scale_rules
  where is_active
    and new.overall_score >= min_score
    and (new.overall_score < max_score or (max_score = 100 and new.overall_score = 100))
  order by order_index
  limit 1;

  return new;
end;
$$;

create trigger trg_assessment_results_classification
  before insert or update on public.assessment_results
  for each row execute function app.compute_classification();

-- --- learning_evaluations -----------------------------------------------------
-- Nhận xét định kỳ (tuần/tháng). KHÔNG có tiêu chí "tài chính" —
-- học phí và học lực là hai chuyện tách rời.

create table public.learning_evaluations (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,

  period_start    date,
  period_end      date,
  evaluation_date date not null default current_date,

  overall_rating   public.evaluation_rating,
  listening_rating public.evaluation_rating,
  speaking_rating  public.evaluation_rating,
  reading_rating   public.evaluation_rating,
  writing_rating   public.evaluation_rating,
  vocabulary_rating public.evaluation_rating,
  grammar_rating   public.evaluation_rating,

  strengths             text,
  areas_for_improvement text,
  action_plan           text,
  teacher_comment       text,

  -- Giáo viên CHỦ ĐỘNG chọn nhận xét nào cho học viên xem.
  -- Học viên chỉ thấy khi: published_at IS NOT NULL AND visible_to_student.
  visible_to_student boolean not null default false,
  published_at       timestamptz,

  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_evaluation_period
    check (period_end is null or period_start is null or period_end >= period_start)
);

create index ix_learning_evaluations_enrollment
  on public.learning_evaluations (enrollment_id, evaluation_date desc);

create trigger trg_learning_evaluations_updated_at
  before update on public.learning_evaluations
  for each row execute function app.set_updated_at();

-- --- student_notes ------------------------------------------------------------
-- Ghi chú `staff_only`: học viên TUYỆT ĐỐI không đọc được — qua API, qua query
-- trực tiếp, hay qua bất kỳ view nào.

create table public.student_notes (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,

  body       text not null,
  visibility public.note_visibility not null default 'staff_only',

  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_student_notes_enrollment on public.student_notes (enrollment_id, created_at desc);

create trigger trg_student_notes_updated_at
  before update on public.student_notes
  for each row execute function app.set_updated_at();
