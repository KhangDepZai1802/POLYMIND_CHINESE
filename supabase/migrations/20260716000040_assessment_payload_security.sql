-- 40 — Payload an toàn: student không đọc score/answer key trước công bố

drop policy if exists exercise_attempt_scope on public.exercise_attempts;
drop policy if exists exercise_answers_scope on public.exercise_answers;
drop policy if exists exam_attempt_scope on public.exam_attempts;
drop policy if exists exam_answers_scope on public.exam_answers;

create policy exercise_attempt_teacher_read on public.exercise_attempts for select using (
  exists(select 1 from public.exercise_deliveries d where d.id=exercise_attempts.delivery_id and app.teaches_class(d.class_id))
);
create policy exercise_attempt_student_read on public.exercise_attempts for select using (
  exists(select 1 from public.enrollments e where e.id=exercise_attempts.enrollment_id and e.student_id=app.my_student_id())
  and (status in ('in_progress','returned_for_revision') or results_published_at is not null)
);
create policy exercise_answers_teacher_read on public.exercise_answers for select using (
  exists(select 1 from public.exercise_attempts a join public.exercise_deliveries d on d.id=a.delivery_id where a.id=exercise_answers.attempt_id and app.teaches_class(d.class_id))
);
create policy exercise_answers_student_read on public.exercise_answers for select using (
  exists(select 1 from public.exercise_attempts a join public.enrollments e on e.id=a.enrollment_id where a.id=exercise_answers.attempt_id and e.student_id=app.my_student_id() and (a.status in ('in_progress','returned_for_revision') or a.results_published_at is not null))
);

create policy exam_attempt_teacher_read on public.exam_attempts for select using (
  exists(select 1 from public.exam_deliveries d where d.id=exam_attempts.exam_delivery_id and app.teaches_class(d.class_id))
);
create policy exam_attempt_student_read on public.exam_attempts for select using (
  exists(select 1 from public.enrollments e where e.id=exam_attempts.enrollment_id and e.student_id=app.my_student_id())
  and (status='in_progress' or exists(select 1 from public.exam_deliveries d where d.id=exam_attempts.exam_delivery_id and d.results_published_at is not null))
);
create policy exam_answers_teacher_read on public.exam_answers for select using (
  exists(select 1 from public.exam_attempts a join public.exam_deliveries d on d.id=a.exam_delivery_id where a.id=exam_answers.attempt_id and app.teaches_class(d.class_id))
);
create policy exam_answers_student_read on public.exam_answers for select using (
  exists(select 1 from public.exam_attempts a join public.enrollments e on e.id=a.enrollment_id join public.exam_deliveries d on d.id=a.exam_delivery_id where a.id=exam_answers.attempt_id and e.student_id=app.my_student_id() and (a.status='in_progress' or d.results_published_at is not null))
);

create or replace function public.get_exercise_attempt_payload(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_payload jsonb;
begin
  if not exists(
    select 1 from public.exercise_attempts a
    join public.enrollments e on e.id=a.enrollment_id
    where a.id=p_attempt_id and e.student_id=app.my_student_id()
      and a.status in ('in_progress','returned_for_revision')
  ) then raise exception 'Không tìm thấy lượt làm'; end if;
  select jsonb_build_object(
    'attempt',jsonb_build_object('id',a.id,'status',a.status,'started_at',a.started_at,'attempt_no',a.attempt_no),
    'delivery',jsonb_build_object('id',d.id,'title',d.title,'instructions',d.instructions,'due_at',d.due_at,'max_score',d.max_score),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'order_index',i.order_index,'points',i.points,'required',i.required,
      'question',jsonb_build_object('id',qv.id,'type',qv.question_type,'prompt_text',qv.prompt_text,'prompt_content',qv.prompt_content,
        'options',coalesce((select jsonb_agg(jsonb_build_object('option_key',o.option_key,'content',o.content) order by o.order_index) from public.question_options o where o.question_version_id=qv.id),'[]'::jsonb)),
      'answer',(select ea.answer_payload from public.exercise_answers ea where ea.attempt_id=a.id and ea.set_item_id=i.id)
    ) order by i.order_index) from public.question_set_items i join public.question_versions qv on qv.id=i.question_version_id where i.set_version_id=d.set_version_id),'[]'::jsonb)
  ) into v_payload
  from public.exercise_attempts a join public.exercise_deliveries d on d.id=a.delivery_id where a.id=p_attempt_id;
  return v_payload;
end $$;

create or replace function public.get_exam_attempt_payload(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_payload jsonb;
begin
  if not exists(select 1 from public.exam_attempts a join public.enrollments e on e.id=a.enrollment_id where a.id=p_attempt_id and e.student_id=app.my_student_id() and a.status='in_progress' and clock_timestamp()<a.deadline_at) then raise exception 'Không tìm thấy lượt thi đang mở'; end if;
  select jsonb_build_object(
    'attempt',jsonb_build_object('id',a.id,'status',a.status,'started_at',a.started_at,'deadline_at',a.deadline_at,'server_time',clock_timestamp()),
    'delivery',jsonb_build_object('id',d.id,'title',d.title,'opens_at',d.opens_at,'closes_at',d.closes_at,'duration_minutes',d.duration_minutes),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'order_index',i.order_index,'points',i.points,'required',i.required,
      'question',jsonb_build_object('id',qv.id,'type',qv.question_type,'prompt_text',qv.prompt_text,'prompt_content',qv.prompt_content,
        'options',coalesce((select jsonb_agg(jsonb_build_object('option_key',o.option_key,'content',o.content) order by o.order_index) from public.question_options o where o.question_version_id=qv.id),'[]'::jsonb)),
      'answer',(select ea.answer_payload from public.exam_answers ea where ea.attempt_id=a.id and ea.set_item_id=i.id)
    ) order by i.order_index) from public.question_set_items i join public.question_versions qv on qv.id=i.question_version_id where i.set_version_id=d.set_version_id),'[]'::jsonb)
  ) into v_payload from public.exam_attempts a join public.exam_deliveries d on d.id=a.exam_delivery_id where a.id=p_attempt_id;
  return v_payload;
end $$;

create or replace function public.get_my_assessment_result(p_kind public.question_set_kind,p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if p_kind='exercise' then
    select jsonb_build_object('status',a.status,'raw_score',a.raw_score,'final_score',a.final_score,'published_at',a.results_published_at,
      'answers',(select jsonb_agg(jsonb_build_object('set_item_id',ea.set_item_id,'answer',ea.answer_payload,'score',ea.final_score,'feedback',ea.feedback,
        'answer_key',case when d.answer_release_mode='after_submit' or (d.answer_release_mode='after_due' and clock_timestamp()>=d.due_at) or d.answer_release_mode='with_results' then k.answer_key else null end,
        'explanation',case when d.answer_release_mode<>'never' then qv.explanation_text else null end))
        from public.exercise_answers ea join public.question_set_items i on i.id=ea.set_item_id join public.question_versions qv on qv.id=i.question_version_id join public.question_answer_keys k on k.question_version_id=qv.id where ea.attempt_id=a.id)
    ) into v_result from public.exercise_attempts a join public.exercise_deliveries d on d.id=a.delivery_id join public.enrollments e on e.id=a.enrollment_id where a.id=p_attempt_id and e.student_id=app.my_student_id() and a.results_published_at is not null;
  else
    select jsonb_build_object('status',a.status,'raw_score',a.raw_score,'final_score',a.final_score_100,'published_at',d.results_published_at,
      'answers',(select jsonb_agg(jsonb_build_object('set_item_id',ea.set_item_id,'answer',ea.answer_payload,'score',ea.final_score,'feedback',ea.feedback,
        'answer_key',case when d.answer_release_mode<>'never' then k.answer_key else null end,'explanation',case when d.answer_release_mode<>'never' then qv.explanation_text else null end))
        from public.exam_answers ea join public.question_set_items i on i.id=ea.set_item_id join public.question_versions qv on qv.id=i.question_version_id join public.question_answer_keys k on k.question_version_id=qv.id where ea.attempt_id=a.id)
    ) into v_result from public.exam_attempts a join public.exam_deliveries d on d.id=a.exam_delivery_id join public.enrollments e on e.id=a.enrollment_id where a.id=p_attempt_id and e.student_id=app.my_student_id() and d.results_published_at is not null;
  end if;
  if v_result is null then raise exception 'Kết quả chưa được công bố'; end if;
  return v_result;
end $$;

revoke all on function public.get_exercise_attempt_payload(uuid) from public,anon;
revoke all on function public.get_exam_attempt_payload(uuid) from public,anon;
revoke all on function public.get_my_assessment_result(public.question_set_kind,uuid) from public,anon;
grant execute on function public.get_exercise_attempt_payload(uuid) to authenticated;
grant execute on function public.get_exam_attempt_payload(uuid) to authenticated;
grant execute on function public.get_my_assessment_result(public.question_set_kind,uuid) to authenticated;
