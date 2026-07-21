-- 67 — Hàng đợi ôn câu sai objective: trigger, RLS, RPC chấm atomic và media private.

create table public.wrong_answer_queue (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  source_kind public.question_set_kind not null,
  source_set_item_id uuid not null references public.question_set_items(id) on delete restrict,
  first_seen_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  wrong_count integer not null default 1 check (wrong_count > 0),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_wrong_answer_queue_student_version
    unique (student_id, question_version_id),
  constraint wrong_answer_queue_seen_order
    check (first_seen_at <= last_seen_at),
  constraint wrong_answer_queue_resolved_order
    check (resolved_at is null or resolved_at >= first_seen_at)
);

create table public.wrong_answer_review_attempts (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.wrong_answer_queue(id) on delete cascade,
  answer_payload jsonb not null check (jsonb_typeof(answer_payload) = 'object'),
  score numeric(10,2),
  is_correct boolean not null,
  attempted_at timestamptz not null default clock_timestamp(),
  constraint wrong_answer_review_score_nonnegative
    check (score is null or score >= 0)
);

create index ix_wrong_answer_queue_student_open
  on public.wrong_answer_queue(student_id, last_seen_at desc)
  where resolved_at is null;
create index ix_wrong_answer_review_attempts_queue_time
  on public.wrong_answer_review_attempts(queue_id, attempted_at desc);

create trigger trg_wrong_answer_queue_updated_at
before update on public.wrong_answer_queue
for each row execute function app.set_updated_at();

create or replace function app.enqueue_wrong_answer_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_question_version_id uuid;
  v_question_type public.question_type;
  v_source_kind public.question_set_kind;
begin
  if new.is_correct is distinct from false then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.is_correct is not distinct from new.is_correct then
    return new;
  end if;

  if tg_table_name = 'exercise_answers' then
    select
      e.student_id,
      i.question_version_id,
      qv.question_type,
      'exercise'::public.question_set_kind
    into
      v_student_id,
      v_question_version_id,
      v_question_type,
      v_source_kind
    from public.exercise_attempts a
    join public.enrollments e on e.id = a.enrollment_id
    join public.question_set_items i on i.id = new.set_item_id
    join public.question_versions qv on qv.id = i.question_version_id
    where a.id = new.attempt_id;
  elsif tg_table_name = 'exam_answers' then
    select
      e.student_id,
      i.question_version_id,
      qv.question_type,
      'exam'::public.question_set_kind
    into
      v_student_id,
      v_question_version_id,
      v_question_type,
      v_source_kind
    from public.exam_attempts a
    join public.enrollments e on e.id = a.enrollment_id
    join public.question_set_items i on i.id = new.set_item_id
    join public.question_versions qv on qv.id = i.question_version_id
    where a.id = new.attempt_id;
  else
    return new;
  end if;

  if v_student_id is null
     or v_question_version_id is null
     or v_question_type in ('essay_translation', 'speaking') then
    return new;
  end if;

  insert into public.wrong_answer_queue (
    student_id,
    question_version_id,
    source_kind,
    source_set_item_id,
    first_seen_at,
    last_seen_at,
    wrong_count,
    resolved_at
  )
  values (
    v_student_id,
    v_question_version_id,
    v_source_kind,
    new.set_item_id,
    clock_timestamp(),
    clock_timestamp(),
    1,
    null
  )
  on conflict (student_id, question_version_id) do update
  set source_kind = excluded.source_kind,
      source_set_item_id = excluded.source_set_item_id,
      last_seen_at = excluded.last_seen_at,
      wrong_count = public.wrong_answer_queue.wrong_count + 1,
      resolved_at = null;

  return new;
end;
$$;

revoke all on function app.enqueue_wrong_answer_review()
  from public, anon, authenticated;

create trigger trg_exercise_answers_enqueue_wrong_review
after insert or update of is_correct on public.exercise_answers
for each row execute function app.enqueue_wrong_answer_review();

create trigger trg_exam_answers_enqueue_wrong_review
after insert or update of is_correct on public.exam_answers
for each row execute function app.enqueue_wrong_answer_review();

-- Backfill các answer objective cũ đã được chấm sai. Question version là bất biến
-- sau khi được dùng trong set version đã khóa, nên queue chỉ cần giữ FK version/item.
with wrongs as (
  select
    e.student_id,
    i.question_version_id,
    'exercise'::public.question_set_kind as source_kind,
    a.set_item_id as source_set_item_id,
    a.saved_at as seen_at
  from public.exercise_answers a
  join public.exercise_attempts x on x.id = a.attempt_id
  join public.enrollments e on e.id = x.enrollment_id
  join public.question_set_items i on i.id = a.set_item_id
  join public.question_versions qv on qv.id = i.question_version_id
  where a.is_correct = false
    and x.submitted_at is not null
    and x.status <> 'invalidated'
    and qv.question_type not in ('essay_translation', 'speaking')

  union all

  select
    e.student_id,
    i.question_version_id,
    'exam'::public.question_set_kind,
    a.set_item_id,
    a.saved_at
  from public.exam_answers a
  join public.exam_attempts x on x.id = a.attempt_id
  join public.enrollments e on e.id = x.enrollment_id
  join public.question_set_items i on i.id = a.set_item_id
  join public.question_versions qv on qv.id = i.question_version_id
  where a.is_correct = false
    and x.submitted_at is not null
    and x.status <> 'invalidated'
    and qv.question_type not in ('essay_translation', 'speaking')
), aggregated as (
  select
    student_id,
    question_version_id,
    (array_agg(source_kind order by seen_at desc))[1] as source_kind,
    (array_agg(source_set_item_id order by seen_at desc))[1] as source_set_item_id,
    min(seen_at) as first_seen_at,
    max(seen_at) as last_seen_at,
    count(*)::integer as wrong_count
  from wrongs
  group by student_id, question_version_id
)
insert into public.wrong_answer_queue (
  student_id,
  question_version_id,
  source_kind,
  source_set_item_id,
  first_seen_at,
  last_seen_at,
  wrong_count
)
select
  student_id,
  question_version_id,
  source_kind,
  source_set_item_id,
  first_seen_at,
  last_seen_at,
  wrong_count
from aggregated
on conflict (student_id, question_version_id) do update
set source_kind = excluded.source_kind,
    source_set_item_id = excluded.source_set_item_id,
    first_seen_at = least(public.wrong_answer_queue.first_seen_at, excluded.first_seen_at),
    last_seen_at = greatest(public.wrong_answer_queue.last_seen_at, excluded.last_seen_at),
    wrong_count = greatest(public.wrong_answer_queue.wrong_count, excluded.wrong_count),
    resolved_at = null;

create or replace function app.prevent_wrong_answer_history_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Không xóa cứng lịch sử ôn câu sai';
end;
$$;

revoke all on function app.prevent_wrong_answer_history_delete()
  from public, anon, authenticated;

create trigger trg_wrong_answer_queue_prevent_delete
before delete on public.wrong_answer_queue
for each row execute function app.prevent_wrong_answer_history_delete();

create trigger trg_wrong_answer_attempts_prevent_delete
before delete on public.wrong_answer_review_attempts
for each row execute function app.prevent_wrong_answer_history_delete();

alter table public.wrong_answer_queue enable row level security;
alter table public.wrong_answer_review_attempts enable row level security;

create policy wrong_answer_queue_admin_read
on public.wrong_answer_queue
for select to authenticated
using (app.is_super_admin());

create policy wrong_answer_queue_student_read
on public.wrong_answer_queue
for select to authenticated
using (
  app.is_active()
  and app.current_role() = 'student'
  and student_id = app.my_student_id()
);

create policy wrong_answer_review_attempts_admin_read
on public.wrong_answer_review_attempts
for select to authenticated
using (app.is_super_admin());

create policy wrong_answer_review_attempts_student_read
on public.wrong_answer_review_attempts
for select to authenticated
using (
  app.is_active()
  and app.current_role() = 'student'
  and exists (
    select 1
    from public.wrong_answer_queue q
    where q.id = wrong_answer_review_attempts.queue_id
      and q.student_id = app.my_student_id()
  )
);

revoke all on public.wrong_answer_queue, public.wrong_answer_review_attempts
  from anon;
revoke insert, update, delete
  on public.wrong_answer_queue, public.wrong_answer_review_attempts
  from authenticated;
grant select on public.wrong_answer_queue, public.wrong_answer_review_attempts
  to authenticated;

create or replace function public.get_my_wrong_answer_reviews()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not app.is_active() or app.current_role() <> 'student' then
    raise exception 'Chỉ học viên đang hoạt động được xem câu sai';
  end if;

  with review_rows as (
    select
      q.last_seen_at,
      jsonb_build_object(
        'queue_id', q.id,
        'question_version_id', q.question_version_id,
        'question_type', qv.question_type,
        'prompt', qv.prompt_text,
        'prompt_content', qv.prompt_content - array[
          'answer_key',
          'correct_answer',
          'accepted_answers',
          'audio_path',
          'object_path'
        ],
        'options', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'option_key', o.option_key,
                'content', o.content
              )
              order by o.order_index
            )
            from public.question_options o
            where o.question_version_id = q.question_version_id
          ),
          '[]'::jsonb
        ),
        'source_kind', q.source_kind,
        'wrong_count', q.wrong_count,
        'first_seen_at', q.first_seen_at,
        'last_seen_at', q.last_seen_at
      ) as payload
    from public.wrong_answer_queue q
    join public.question_versions qv on qv.id = q.question_version_id
    where q.student_id = app.my_student_id()
      and q.resolved_at is null
      and qv.question_type not in ('essay_translation', 'speaking')
  )
  select coalesce(jsonb_agg(payload order by last_seen_at desc), '[]'::jsonb)
  into v_result
  from review_rows;

  return v_result;
end;
$$;

revoke all on function public.get_my_wrong_answer_reviews()
  from public, anon;
grant execute on function public.get_my_wrong_answer_reviews()
  to authenticated;

create or replace function public.submit_wrong_answer_review(
  p_queue_id uuid,
  p_answer_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_queue public.wrong_answer_queue;
  v_score numeric;
  v_correct boolean;
  v_manual boolean;
begin
  if not app.is_active() or app.current_role() <> 'student' then
    raise exception 'Chỉ học viên đang hoạt động được ôn câu sai';
  end if;

  if p_answer_payload is null
     or jsonb_typeof(p_answer_payload) <> 'object'
     or octet_length(p_answer_payload::text) > 65536 then
    raise exception 'Câu trả lời ôn tập không hợp lệ';
  end if;

  select * into v_queue
  from public.wrong_answer_queue
  where id = p_queue_id
    and student_id = app.my_student_id()
    and resolved_at is null
  for update;

  if v_queue.id is null then
    raise exception 'Không tìm thấy câu cần ôn';
  end if;

  select score, is_correct, manual_required
  into v_score, v_correct, v_manual
  from app.auto_score_answer(v_queue.source_set_item_id, p_answer_payload);

  if v_manual or v_correct is null then
    raise exception 'Dạng câu này không hỗ trợ chấm tự động';
  end if;

  insert into public.wrong_answer_review_attempts (
    queue_id,
    answer_payload,
    score,
    is_correct
  )
  values (
    v_queue.id,
    p_answer_payload,
    v_score,
    v_correct
  );

  update public.wrong_answer_queue
  set resolved_at = case when v_correct then clock_timestamp() else null end
  where id = v_queue.id;

  return jsonb_build_object(
    'is_correct', v_correct,
    'score', v_score,
    'resolved', v_correct
  );
end;
$$;

revoke all on function public.submit_wrong_answer_review(uuid, jsonb)
  from public, anon;
grant execute on function public.submit_wrong_answer_review(uuid, jsonb)
  to authenticated;

create or replace function app.can_student_read_wrong_answer_media(
  p_object_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.is_active()
    and app.current_role() = 'student'
    and p_object_path is not null
    and exists (
      select 1
      from public.question_media m
      join public.wrong_answer_queue q
        on q.question_version_id = m.question_version_id
      where m.object_path = p_object_path
        and q.student_id = app.my_student_id()
        and q.resolved_at is null
    );
$$;

revoke all on function app.can_student_read_wrong_answer_media(text)
  from public, anon;
grant execute on function app.can_student_read_wrong_answer_media(text)
  to authenticated;

create policy question_media_student_wrong_review_read
on public.question_media
for select to authenticated
using (app.can_student_read_wrong_answer_media(object_path));

create policy question_media_student_wrong_review_storage_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'question-media'
  and app.can_student_read_wrong_answer_media(name)
);

comment on table public.wrong_answer_queue is
  'Một hàng cho mỗi student + question version từng sai; đúng trong review thì resolved.';
comment on table public.wrong_answer_review_attempts is
  'Lịch sử append-only các lần DB chấm lại trong màn Ôn câu sai.';
