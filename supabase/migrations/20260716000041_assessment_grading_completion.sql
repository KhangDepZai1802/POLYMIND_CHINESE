-- 41 — Hoàn thiện tổng hợp điểm, chấm lại và thông báo công bố kết quả

create or replace function app.recalculate_exam_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_pending integer;
  v_raw_max numeric;
begin
  select
    coalesce(sum(coalesce(a.final_score, 0)), 0),
    count(*) filter (where a.final_score is null),
    sv.raw_max_score
  into v_total, v_pending, v_raw_max
  from public.exam_attempts ea
  join public.exam_deliveries d on d.id = ea.exam_delivery_id
  join public.question_set_versions sv on sv.id = d.set_version_id
  left join public.exam_answers a on a.attempt_id = ea.id
  where ea.id = p_attempt_id
  group by sv.raw_max_score;

  if v_raw_max is null then
    raise exception 'Không tìm thấy lượt thi';
  end if;

  update public.exam_attempts
  set raw_score = v_total,
      final_score_100 = round(v_total / nullif(v_raw_max, 0) * 100, 2),
      status = case when v_pending = 0 then 'graded' else 'pending_manual_grading' end,
      graded_at = case when v_pending = 0 then clock_timestamp() else null end
  where id = p_attempt_id;
end
$$;

create or replace function public.grade_exam_answer(
  p_answer_id uuid,
  p_score numeric,
  p_feedback text default null,
  p_override_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class uuid;
  v_points numeric;
  v_attempt uuid;
  v_before jsonb;
begin
  perform app.require_assessment_author();
  select d.class_id, i.points, a.attempt_id, to_jsonb(a)
  into v_class, v_points, v_attempt, v_before
  from public.exam_answers a
  join public.exam_attempts ea on ea.id = a.attempt_id
  join public.exam_deliveries d on d.id = ea.exam_delivery_id
  join public.question_set_items i on i.id = a.set_item_id
  where a.id = p_answer_id;

  if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then
    raise exception 'Không có quyền chấm';
  end if;
  if p_score < 0 or p_score > v_points then
    raise exception 'Điểm vượt giới hạn câu';
  end if;

  update public.exam_answers
  set manual_score = p_score,
      final_score = p_score,
      feedback = nullif(trim(p_feedback), ''),
      override_reason = nullif(trim(p_override_reason), ''),
      graded_by = auth.uid(),
      graded_at = clock_timestamp()
  where id = p_answer_id;

  perform app.recalculate_exam_attempt(v_attempt);
  perform app.write_audit(
    'exam.answer.grade',
    'exam_answer',
    p_answer_id,
    v_before,
    (select to_jsonb(a) from public.exam_answers a where a.id = p_answer_id)
  );
end
$$;

create or replace function public.run_exam_regrade(
  p_delivery_id uuid,
  p_reason text,
  p_rule_override jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_class uuid;
  v_answer record;
  v_score numeric;
  v_correct boolean;
  v_manual boolean;
  v_before jsonb;
  v_after jsonb;
begin
  perform app.require_assessment_author();
  select class_id into v_class from public.exam_deliveries where id = p_delivery_id;
  if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then
    raise exception 'Không có quyền chấm lại';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Phải nhập lý do chấm lại';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
  into v_before
  from public.exam_attempts a
  where a.exam_delivery_id = p_delivery_id;

  insert into public.exam_regrade_runs(
    exam_delivery_id, reason, rule_override, started_by, status
  ) values (
    p_delivery_id, trim(p_reason), coalesce(p_rule_override, '{}'::jsonb), auth.uid(), 'running'
  ) returning id into v_id;

  for v_answer in
    select a.id, a.attempt_id, a.set_item_id, a.answer_payload, a.manual_score
    from public.exam_answers a
    join public.exam_attempts ea on ea.id = a.attempt_id
    where ea.exam_delivery_id = p_delivery_id
    for update of a
  loop
    if v_answer.manual_score is null then
      select score, is_correct, requires_manual
      into v_score, v_correct, v_manual
      from app.auto_score_answer(v_answer.set_item_id, v_answer.answer_payload);
      update public.exam_answers
      set auto_score = v_score,
          final_score = case when v_manual then null else v_score end,
          is_correct = v_correct
      where id = v_answer.id;
    end if;
  end loop;

  for v_answer in
    select id from public.exam_attempts where exam_delivery_id = p_delivery_id
  loop
    perform app.recalculate_exam_attempt(v_answer.id);
  end loop;

  update public.exam_regrade_runs
  set status = 'completed', completed_at = clock_timestamp()
  where id = v_id;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
  into v_after
  from public.exam_attempts a
  where a.exam_delivery_id = p_delivery_id;

  perform app.write_audit(
    'exam.regrade',
    'exam_delivery',
    p_delivery_id,
    v_before,
    jsonb_build_object('run_id', v_id, 'reason', trim(p_reason), 'attempts', v_after)
  );
  return v_id;
exception when others then
  if v_id is not null then
    update public.exam_regrade_runs set status = 'failed', completed_at = clock_timestamp() where id = v_id;
  end if;
  raise;
end
$$;

create or replace function public.publish_exercise_results(p_delivery_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class uuid;
  v_count integer;
begin
  perform app.require_assessment_author();
  select class_id into v_class from public.exercise_deliveries where id = p_delivery_id for update;
  if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then
    raise exception 'Không có quyền công bố';
  end if;
  if exists(select 1 from public.exercise_attempts where delivery_id = p_delivery_id and status = 'pending_manual_grading') then
    raise exception 'Còn câu chưa chấm';
  end if;

  update public.exercise_attempts
  set results_published_at = clock_timestamp()
  where delivery_id = p_delivery_id and status = 'graded' and results_published_at is null;
  get diagnostics v_count = row_count;
  update public.exercise_deliveries set status = 'results_published' where id = p_delivery_id;

  insert into public.notifications(user_id, type, title, body, link, resource_type, resource_id, dedupe_key)
  select s.user_id, 'exercise_result_published', 'Kết quả bài tập', d.title,
         '/student/exercises', 'exercise_delivery', d.id, 'exercise-result:' || d.id
  from public.exercise_deliveries d
  join public.enrollments e on e.class_id = d.class_id and e.status in ('active', 'paused')
  join public.students s on s.id = e.student_id
  where d.id = p_delivery_id and s.user_id is not null
  on conflict(user_id, dedupe_key) where dedupe_key is not null do nothing;
  return v_count;
end
$$;

create or replace function public.publish_exam_results(p_delivery_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class uuid;
  v_count integer;
begin
  perform app.require_assessment_author();
  select class_id into v_class from public.exam_deliveries where id = p_delivery_id for update;
  if v_class is null or (not app.is_super_admin() and not app.teaches_class(v_class)) then
    raise exception 'Không có quyền công bố';
  end if;
  if exists(select 1 from public.exam_attempts where exam_delivery_id = p_delivery_id and status in ('in_progress', 'pending_manual_grading')) then
    raise exception 'Còn lượt thi chưa nộp hoặc câu chưa chấm';
  end if;

  update public.exam_deliveries
  set status = 'results_published', results_published_at = clock_timestamp()
  where id = p_delivery_id and status <> 'results_published';
  get diagnostics v_count = row_count;

  insert into public.notifications(user_id, type, title, body, link, resource_type, resource_id, dedupe_key)
  select s.user_id, 'exam_result_published', 'Kết quả kỳ thi', d.title,
         '/student/exams', 'exam_delivery', d.id, 'exam-result:' || d.id
  from public.exam_deliveries d
  join public.enrollments e on e.class_id = d.class_id and e.status in ('active', 'paused')
  join public.students s on s.id = e.student_id
  where d.id = p_delivery_id and s.user_id is not null
  on conflict(user_id, dedupe_key) where dedupe_key is not null do nothing;
  return v_count;
end
$$;

revoke all on function app.recalculate_exam_attempt(uuid) from public, anon, authenticated;
revoke all on function public.grade_exam_answer(uuid, numeric, text, text) from public, anon;
revoke all on function public.run_exam_regrade(uuid, text, jsonb) from public, anon;
revoke all on function public.publish_exercise_results(uuid) from public, anon;
revoke all on function public.publish_exam_results(uuid) from public, anon;
grant execute on function public.grade_exam_answer(uuid, numeric, text, text) to authenticated;
grant execute on function public.run_exam_regrade(uuid, text, jsonb) to authenticated;
grant execute on function public.publish_exercise_results(uuid) to authenticated;
grant execute on function public.publish_exam_results(uuid) to authenticated;
