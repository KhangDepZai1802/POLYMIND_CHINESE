-- 38 — Assessment engine additive: Question Bank, Builder, Bài tập và Thi

create type public.question_type as enum (
  'single_choice', 'multiple_choice', 'true_false', 'fill_blank',
  'short_text', 'ordering', 'matching', 'reading_group',
  'listening_choice', 'dictation', 'essay_translation'
);
create type public.question_skill as enum ('listening', 'speaking', 'reading', 'writing', 'vocabulary', 'grammar');
create type public.question_difficulty as enum ('easy', 'medium', 'hard');
create type public.question_visibility as enum ('private', 'shared', 'pending_global_review', 'global', 'rejected', 'archived');
create type public.question_status as enum ('draft', 'ready', 'archived');
create type public.question_set_kind as enum ('exercise', 'exam');
create type public.question_set_status as enum ('draft', 'ready', 'archived');
create type public.exercise_delivery_status as enum ('draft', 'scheduled', 'open', 'closed', 'grading', 'results_published', 'cancelled', 'archived');
create type public.exam_delivery_status as enum ('draft', 'scheduled', 'open', 'closed', 'grading', 'results_published', 'cancelled', 'archived');
create type public.attempt_status as enum ('in_progress', 'submitted', 'pending_manual_grading', 'graded', 'returned_for_revision', 'invalidated');
create type public.submission_reason as enum ('manual', 'duration_expired', 'exam_window_closed', 'system_finalize');
create type public.result_release_mode as enum ('after_graded', 'after_due', 'manual');
create type public.answer_release_mode as enum ('after_submit', 'after_due', 'with_results', 'never');
create type public.question_share_permission as enum ('read', 'clone');
create type public.exercise_grading_method as enum ('first', 'latest', 'highest');

create sequence public.question_code_seq start with 1;

alter type public.notification_type add value if not exists 'exercise_assigned';
alter type public.notification_type add value if not exists 'exercise_returned';
alter type public.notification_type add value if not exists 'exercise_result_published';
alter type public.notification_type add value if not exists 'exam_scheduled';
alter type public.notification_type add value if not exists 'exam_opening';
alter type public.notification_type add value if not exists 'exam_result_published';

create table public.question_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  parent_id uuid references public.question_collections(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, parent_id, name)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('CH-' || lpad(nextval('public.question_code_seq')::text, 6, '0')),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 200),
  current_version_id uuid,
  course_id uuid references public.courses(id) on delete set null,
  module_id uuid references public.course_modules(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  skill public.question_skill not null,
  difficulty public.question_difficulty not null default 'medium',
  visibility public.question_visibility not null default 'private',
  status public.question_status not null default 'draft',
  collection_id uuid references public.question_collections(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'archived') = (archived_at is not null))
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  question_type public.question_type not null,
  prompt_text text not null check (length(trim(prompt_text)) > 0),
  prompt_content jsonb not null default '{}'::jsonb check (jsonb_typeof(prompt_content) = 'object'),
  normalization_config jsonb not null default '{}'::jsonb check (jsonb_typeof(normalization_config) = 'object'),
  explanation_text text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (question_id, version_no)
);

alter table public.questions
  add constraint fk_questions_current_version foreign key (current_version_id)
  references public.question_versions(id) on delete restrict;

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  option_key text not null,
  content text not null,
  order_index integer not null check (order_index >= 0),
  unique (question_version_id, option_key),
  unique (question_version_id, order_index)
);

create table public.question_answer_keys (
  question_version_id uuid primary key references public.question_versions(id) on delete cascade,
  answer_key jsonb not null,
  grading_config jsonb not null default '{}'::jsonb check (jsonb_typeof(grading_config) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_media (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  media_role text not null check (media_role in ('prompt_audio', 'prompt_image', 'shared_passage_media')),
  object_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  duration_ms integer check (duration_ms is null or duration_ms > 0),
  uploaded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.question_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique nulls not distinct (owner_id, name)
);
create table public.question_tag_links (
  question_id uuid not null references public.questions(id) on delete cascade,
  tag_id uuid not null references public.question_tags(id) on delete cascade,
  primary key (question_id, tag_id)
);
create table public.question_shares (
  question_id uuid not null references public.questions(id) on delete cascade,
  shared_with_teacher_id uuid not null references public.teachers(id) on delete cascade,
  permission public.question_share_permission not null default 'read',
  shared_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (question_id, shared_with_teacher_id)
);
create table public.question_review_requests (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  review_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (question_id, status)
);

create table public.question_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  kind public.question_set_kind not null,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  course_id uuid references public.courses(id) on delete set null,
  module_id uuid references public.course_modules(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  status public.question_set_status not null default 'draft',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.question_set_versions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.question_sets(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  title_snapshot text not null,
  instructions_snapshot text,
  raw_max_score numeric(10,2) not null default 0 check (raw_max_score >= 0),
  rubric_config jsonb not null default '{}'::jsonb check (jsonb_typeof(rubric_config) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (question_set_id, version_no)
);
alter table public.question_sets
  add constraint fk_question_sets_current_version foreign key (current_version_id)
  references public.question_set_versions(id) on delete restrict;

create table public.question_set_sections (
  id uuid primary key default gen_random_uuid(),
  set_version_id uuid not null references public.question_set_versions(id) on delete cascade,
  title text not null,
  instructions text,
  order_index integer not null check (order_index >= 0),
  stimulus_config jsonb not null default '{}'::jsonb check (jsonb_typeof(stimulus_config) = 'object'),
  unique (set_version_id, order_index)
);
create table public.question_set_items (
  id uuid primary key default gen_random_uuid(),
  set_version_id uuid not null references public.question_set_versions(id) on delete cascade,
  section_id uuid references public.question_set_sections(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  order_index integer not null check (order_index >= 0),
  points numeric(10,2) not null check (points > 0),
  required boolean not null default true,
  display_config jsonb not null default '{}'::jsonb check (jsonb_typeof(display_config) = 'object'),
  unique (set_version_id, order_index)
);
create table public.question_set_shares (
  question_set_id uuid not null references public.question_sets(id) on delete cascade,
  shared_with_teacher_id uuid not null references public.teachers(id) on delete cascade,
  permission public.question_share_permission not null default 'read',
  shared_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (question_set_id, shared_with_teacher_id)
);

create table public.exercise_deliveries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  set_version_id uuid not null references public.question_set_versions(id) on delete restrict,
  title text not null,
  instructions text,
  available_from timestamptz not null,
  due_at timestamptz not null,
  allow_late_submission boolean not null default false,
  late_penalty_percent numeric(5,2) not null default 0 check (late_penalty_percent between 0 and 100),
  attempt_limit integer not null default 1 check (attempt_limit between 1 and 20),
  grading_method public.exercise_grading_method not null default 'latest',
  max_score numeric(10,2) not null check (max_score > 0),
  result_release_mode public.result_release_mode not null default 'manual',
  answer_release_mode public.answer_release_mode not null default 'with_results',
  status public.exercise_delivery_status not null default 'draft',
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_at > available_from)
);
create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.exercise_deliveries(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  attempt_no integer not null check (attempt_no > 0),
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  is_late boolean not null default false,
  raw_score numeric(10,2),
  final_score numeric(10,2),
  graded_at timestamptz,
  results_published_at timestamptz,
  invalidated_at timestamptz,
  invalidated_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_id, enrollment_id, attempt_no)
);
create table public.exercise_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exercise_attempts(id) on delete cascade,
  set_item_id uuid not null references public.question_set_items(id) on delete restrict,
  answer_payload jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default clock_timestamp(),
  auto_score numeric(10,2), manual_score numeric(10,2), final_score numeric(10,2),
  is_correct boolean, feedback text, override_reason text,
  graded_by uuid references auth.users(id) on delete restrict,
  graded_at timestamptz,
  unique (attempt_id, set_item_id),
  check (coalesce(auto_score, 0) >= 0 and coalesce(manual_score, 0) >= 0 and coalesce(final_score, 0) >= 0)
);

create table public.exam_deliveries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  set_version_id uuid not null references public.question_set_versions(id) on delete restrict,
  title text not null,
  exam_type public.assessment_type not null default 'custom',
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  passing_score numeric(5,2) check (passing_score between 0 and 100),
  answer_release_mode public.answer_release_mode not null default 'with_results',
  status public.exam_delivery_status not null default 'draft',
  published_at timestamptz,
  results_published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at),
  check ((opens_at at time zone 'Asia/Ho_Chi_Minh')::date = (closes_at at time zone 'Asia/Ho_Chi_Minh')::date)
);
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_delivery_id uuid not null references public.exam_deliveries(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default clock_timestamp(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  submission_reason public.submission_reason,
  raw_score numeric(10,2),
  final_score_100 numeric(5,2) check (final_score_100 between 0 and 100),
  classification_rule_id uuid references public.grading_scale_rules(id) on delete set null,
  graded_at timestamptz,
  invalidated_at timestamptz,
  invalidated_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ux_exam_attempts_one_valid on public.exam_attempts(exam_delivery_id, enrollment_id)
  where status <> 'invalidated';
create table public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  set_item_id uuid not null references public.question_set_items(id) on delete restrict,
  answer_payload jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default clock_timestamp(),
  auto_score numeric(10,2), manual_score numeric(10,2), final_score numeric(10,2),
  is_correct boolean, feedback text, override_reason text,
  graded_by uuid references auth.users(id) on delete restrict,
  graded_at timestamptz,
  unique (attempt_id, set_item_id),
  check (coalesce(auto_score, 0) >= 0 and coalesce(manual_score, 0) >= 0 and coalesce(final_score, 0) >= 0)
);
create table public.exam_integrity_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  event_type text not null check (event_type in ('exam_started','copy_blocked','paste_blocked','cut_blocked','tab_hidden','window_blurred','window_focused','network_offline','network_online','attempt_resumed','auto_submitted')),
  occurred_at timestamptz not null default clock_timestamp(),
  client_context jsonb not null default '{}'::jsonb check (jsonb_typeof(client_context) = 'object' and not client_context ?| array['clipboard','content','text'])
);
create table public.exam_regrade_runs (
  id uuid primary key default gen_random_uuid(),
  exam_delivery_id uuid not null references public.exam_deliveries(id) on delete restrict,
  reason text not null,
  rule_override jsonb not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  started_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  changed_attempt_count integer not null default 0
);

create index ix_questions_owner_status on public.questions(owner_id, status);
create index ix_question_versions_question on public.question_versions(question_id, version_no desc);
create index ix_question_items_version on public.question_set_items(question_version_id);
create index ix_question_sets_owner_status on public.question_sets(owner_id, status);
create index ix_exercise_deliveries_class_status_due on public.exercise_deliveries(class_id, status, due_at);
create index ix_exercise_attempts_delivery_enrollment on public.exercise_attempts(delivery_id, enrollment_id);
create index ix_exercise_answers_attempt on public.exercise_answers(attempt_id, set_item_id);
create index ix_exam_deliveries_class_status_opens on public.exam_deliveries(class_id, status, opens_at);
create index ix_exam_attempts_delivery_enrollment on public.exam_attempts(exam_delivery_id, enrollment_id);
create index ix_exam_answers_attempt on public.exam_answers(attempt_id, set_item_id);
create index ix_exam_integrity_attempt_time on public.exam_integrity_events(attempt_id, occurred_at);

create or replace function app.prevent_locked_assessment_content_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'question_versions' and exists (
    select 1 from public.question_set_items i
    join public.question_set_versions sv on sv.id = i.set_version_id
    where i.question_version_id = old.id and sv.locked_at is not null
  ) then raise exception 'Phiên bản câu hỏi đã được khóa'; end if;
  if tg_table_name in ('question_set_sections','question_set_items') and exists (
    select 1 from public.question_set_versions sv
    where sv.id = old.set_version_id and sv.locked_at is not null
  ) then raise exception 'Phiên bản bộ câu hỏi đã được khóa'; end if;
  if tg_table_name = 'question_set_versions' and old.locked_at is not null then
    raise exception 'Phiên bản bộ câu hỏi đã được khóa';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger trg_question_versions_immutable before update or delete on public.question_versions for each row execute function app.prevent_locked_assessment_content_change();
create trigger trg_set_versions_immutable before update or delete on public.question_set_versions for each row execute function app.prevent_locked_assessment_content_change();
create trigger trg_set_sections_immutable before update or delete on public.question_set_sections for each row execute function app.prevent_locked_assessment_content_change();
create trigger trg_set_items_immutable before update or delete on public.question_set_items for each row execute function app.prevent_locked_assessment_content_change();

do $$ declare t text; begin
  foreach t in array array['question_collections','questions','question_answer_keys','question_sets','exercise_deliveries','exercise_attempts','exam_deliveries','exam_attempts'] loop
    execute format('create trigger %I before update on public.%I for each row execute function app.set_updated_at()', 'trg_' || t || '_updated_at', t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array[
    'question_collections','questions','question_versions','question_options','question_answer_keys','question_media','question_tags','question_tag_links','question_shares','question_review_requests',
    'question_sets','question_set_versions','question_set_sections','question_set_items','question_set_shares',
    'exercise_deliveries','exercise_attempts','exercise_answers','exam_deliveries','exam_attempts','exam_answers','exam_integrity_events','exam_regrade_runs'
  ] loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Admin policies.
do $$ declare t text; begin
  foreach t in array array[
    'question_collections','questions','question_versions','question_options','question_answer_keys','question_media','question_tags','question_tag_links','question_shares','question_review_requests',
    'question_sets','question_set_versions','question_set_sections','question_set_items','question_set_shares',
    'exercise_deliveries','exercise_attempts','exercise_answers','exam_deliveries','exam_attempts','exam_answers','exam_integrity_events','exam_regrade_runs'
  ] loop execute format('create policy %I on public.%I for all using (app.is_super_admin()) with check (app.is_super_admin())', 'admin_all_' || t, t); end loop;
end $$;

create policy questions_teacher_read on public.questions for select using (
  owner_id = auth.uid() or visibility = 'global' or exists (
    select 1 from public.question_shares qs where qs.question_id = questions.id and qs.shared_with_teacher_id = app.my_teacher_id()
  )
);
create policy questions_teacher_insert on public.questions for insert with check (app.current_role() = 'teacher' and owner_id = auth.uid() and created_by = auth.uid());
create policy questions_teacher_update on public.questions for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy questions_teacher_delete on public.questions for delete using (owner_id = auth.uid() and status = 'draft');
create policy question_versions_teacher_read on public.question_versions for select using (exists (select 1 from public.questions q where q.id = question_versions.question_id));
create policy question_versions_teacher_write on public.question_versions for all using (exists (select 1 from public.questions q where q.id = question_versions.question_id and q.owner_id = auth.uid())) with check (created_by = auth.uid() and exists (select 1 from public.questions q where q.id = question_versions.question_id and q.owner_id = auth.uid()));
create policy question_options_teacher_read on public.question_options for select using (exists (select 1 from public.question_versions qv join public.questions q on q.id=qv.question_id where qv.id=question_options.question_version_id));
create policy question_options_teacher_write on public.question_options for all using (exists (select 1 from public.question_versions qv join public.questions q on q.id=qv.question_id where qv.id=question_options.question_version_id and q.owner_id=auth.uid())) with check (exists (select 1 from public.question_versions qv join public.questions q on q.id=qv.question_id where qv.id=question_options.question_version_id and q.owner_id=auth.uid()));
create policy answer_keys_teacher_read on public.question_answer_keys for select using (exists (select 1 from public.question_versions qv join public.questions q on q.id=qv.question_id where qv.id=question_answer_keys.question_version_id));
create policy answer_keys_teacher_write on public.question_answer_keys for all using (exists (select 1 from public.question_versions qv join public.questions q on q.id=qv.question_id where qv.id=question_answer_keys.question_version_id and q.owner_id=auth.uid())) with check (created_by=auth.uid() and exists (select 1 from public.question_versions qv join public.questions q on q.id=qv.question_id where qv.id=question_answer_keys.question_version_id and q.owner_id=auth.uid()));

create policy question_sets_teacher_read on public.question_sets for select using (owner_id=auth.uid() or exists(select 1 from public.question_set_shares s where s.question_set_id=question_sets.id and s.shared_with_teacher_id=app.my_teacher_id()));
create policy question_sets_teacher_write on public.question_sets for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy set_versions_teacher_read on public.question_set_versions for select using (exists(select 1 from public.question_sets s where s.id=question_set_versions.question_set_id));
create policy set_versions_teacher_write on public.question_set_versions for all using (exists(select 1 from public.question_sets s where s.id=question_set_versions.question_set_id and s.owner_id=auth.uid())) with check (created_by=auth.uid() and exists(select 1 from public.question_sets s where s.id=question_set_versions.question_set_id and s.owner_id=auth.uid()));
create policy set_sections_teacher_read on public.question_set_sections for select using (exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=question_set_sections.set_version_id));
create policy set_sections_teacher_write on public.question_set_sections for all using (exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=question_set_sections.set_version_id and s.owner_id=auth.uid())) with check (exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=question_set_sections.set_version_id and s.owner_id=auth.uid()));
create policy set_items_teacher_read on public.question_set_items for select using (exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=question_set_items.set_version_id));
create policy set_items_teacher_write on public.question_set_items for all using (exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=question_set_items.set_version_id and s.owner_id=auth.uid())) with check (exists(select 1 from public.question_set_versions sv join public.question_sets s on s.id=sv.question_set_id where sv.id=question_set_items.set_version_id and s.owner_id=auth.uid()));

create policy exercise_delivery_scope on public.exercise_deliveries for select using (app.teaches_class(class_id) or (status not in ('draft','cancelled','archived') and app.studies_class(class_id)));
create policy exercise_delivery_teacher_write on public.exercise_deliveries for all using (app.teaches_class(class_id)) with check (app.teaches_class(class_id) and created_by=auth.uid());
create policy exercise_attempt_scope on public.exercise_attempts for select using (
  exists(select 1 from public.exercise_deliveries d where d.id=exercise_attempts.delivery_id and app.teaches_class(d.class_id))
  or exists(select 1 from public.enrollments e where e.id=exercise_attempts.enrollment_id and e.student_id=app.my_student_id())
);
create policy exercise_answers_scope on public.exercise_answers for select using (exists(select 1 from public.exercise_attempts a where a.id=exercise_answers.attempt_id));

create policy exam_delivery_scope on public.exam_deliveries for select using (app.teaches_class(class_id) or (status not in ('draft','cancelled','archived') and app.studies_class(class_id)));
create policy exam_delivery_teacher_write on public.exam_deliveries for all using (app.teaches_class(class_id)) with check (app.teaches_class(class_id) and created_by=auth.uid());
create policy exam_attempt_scope on public.exam_attempts for select using (
  exists(select 1 from public.exam_deliveries d where d.id=exam_attempts.exam_delivery_id and app.teaches_class(d.class_id))
  or exists(select 1 from public.enrollments e where e.id=exam_attempts.enrollment_id and e.student_id=app.my_student_id())
);
create policy exam_answers_scope on public.exam_answers for select using (exists(select 1 from public.exam_attempts a where a.id=exam_answers.attempt_id));
create policy exam_integrity_scope on public.exam_integrity_events for select using (exists(select 1 from public.exam_attempts a join public.exam_deliveries d on d.id=a.exam_delivery_id where a.id=exam_integrity_events.attempt_id and app.teaches_class(d.class_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('question-media','question-media',false,52428800,array['audio/mpeg','audio/mp4','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy question_media_owner_insert on storage.objects for insert to authenticated with check (bucket_id='question-media' and (storage.foldername(name))[1]=auth.uid()::text and app.current_role() in ('teacher','super_admin'));
create policy question_media_owner_read on storage.objects for select to authenticated using (bucket_id='question-media' and ((storage.foldername(name))[1]=auth.uid()::text or app.is_super_admin()));
create policy question_media_owner_delete on storage.objects for delete to authenticated using (bucket_id='question-media' and ((storage.foldername(name))[1]=auth.uid()::text or app.is_super_admin()));

do $$ declare t text; begin
  foreach t in array array[
    'question_collections','questions','question_versions','question_options','question_answer_keys','question_media','question_tags','question_tag_links','question_shares','question_review_requests',
    'question_sets','question_set_versions','question_set_sections','question_set_items','question_set_shares',
    'exercise_deliveries','exercise_attempts','exercise_answers','exam_deliveries','exam_attempts','exam_answers','exam_integrity_events','exam_regrade_runs'
  ] loop execute format('grant select, insert, update, delete on public.%I to authenticated', t); end loop;
end $$;

revoke all on function app.prevent_locked_assessment_content_change() from public, anon, authenticated;
