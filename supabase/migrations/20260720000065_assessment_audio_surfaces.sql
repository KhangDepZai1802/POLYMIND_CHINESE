-- 65 — Đồng bộ audio đề và audio bài Nói trên màn chấm + kết quả.
--
-- Học viên cần tiếp tục đọc audio đề sau khi kết quả được công bố. Giáo viên
-- phụ trách lớp cần đọc audio của đúng bộ đề đã giao, kể cả khi câu hỏi thuộc
-- owner khác. RPC kết quả phải trả version id để app ký đúng object private.

create or replace function app.can_student_read_question_media(p_object_path text)
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
    and (
      exists (
        select 1
        from public.question_media m
        join public.question_set_items i
          on i.question_version_id = m.question_version_id
        join public.exercise_deliveries d
          on d.set_version_id = i.set_version_id
        join public.exercise_attempts a
          on a.delivery_id = d.id
         and (
           a.status in ('in_progress', 'returned_for_revision')
           or a.results_published_at is not null
         )
        join public.enrollments e
          on e.id = a.enrollment_id
        where m.object_path = p_object_path
          and e.student_id = app.my_student_id()
      )
      or exists (
        select 1
        from public.question_media m
        join public.question_set_items i
          on i.question_version_id = m.question_version_id
        join public.exam_deliveries d
          on d.set_version_id = i.set_version_id
        join public.exam_attempts a
          on a.exam_delivery_id = d.id
         and (
           (a.status = 'in_progress' and clock_timestamp() < a.deadline_at)
           or d.results_published_at is not null
         )
        join public.enrollments e
          on e.id = a.enrollment_id
        where m.object_path = p_object_path
          and e.student_id = app.my_student_id()
      )
    );
$$;

create or replace function app.can_teacher_read_assessment_question_media(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.is_active()
    and p_object_path is not null
    and (
      app.is_super_admin()
      or (
        app.current_role() = 'teacher'
        and (
          exists (
            select 1
            from public.question_media m
            join public.question_set_items i
              on i.question_version_id = m.question_version_id
            join public.exercise_deliveries d
              on d.set_version_id = i.set_version_id
            where m.object_path = p_object_path
              and app.teaches_class(d.class_id)
          )
          or exists (
            select 1
            from public.question_media m
            join public.question_set_items i
              on i.question_version_id = m.question_version_id
            join public.exam_deliveries d
              on d.set_version_id = i.set_version_id
            where m.object_path = p_object_path
              and app.teaches_class(d.class_id)
          )
        )
      )
    );
$$;

revoke all on function app.can_student_read_question_media(text)
  from public, anon;
revoke all on function app.can_teacher_read_assessment_question_media(text)
  from public, anon;
grant execute on function app.can_student_read_question_media(text)
  to authenticated;
grant execute on function app.can_teacher_read_assessment_question_media(text)
  to authenticated;

create policy question_media_teacher_delivery_read
on public.question_media
for select
to authenticated
using (app.can_teacher_read_assessment_question_media(object_path));

create policy question_media_teacher_delivery_storage_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'question-media'
  and app.can_teacher_read_assessment_question_media(name)
);

create or replace function public.get_my_assessment_result(
  p_kind public.question_set_kind,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_kind = 'exercise' then
    select jsonb_build_object(
      'status', attempt.status,
      'raw_score', attempt.raw_score,
      'final_score', attempt.final_score,
      'max_score', delivery.max_score,
      'published_at', attempt.results_published_at,
      'answers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'set_item_id', answer.set_item_id,
          'order_index', item.order_index,
          'points', item.points,
          'question_version_id', version.id,
          'question_type', version.question_type,
          'prompt_text', version.prompt_text,
          'prompt_content', version.prompt_content,
          'options', coalesce((
            select jsonb_agg(jsonb_build_object(
              'option_key', option.option_key,
              'content', option.content
            ) order by option.order_index)
            from public.question_options option
            where option.question_version_id = version.id
          ), '[]'::jsonb),
          'answer', answer.answer_payload,
          'score', answer.final_score,
          'feedback', answer.feedback,
          'answer_key', case
            when delivery.answer_release_mode = 'after_submit'
              or (delivery.answer_release_mode = 'after_due' and clock_timestamp() >= delivery.due_at)
              or delivery.answer_release_mode = 'with_results'
            then answer_key.answer_key else null end,
          'explanation', case when delivery.answer_release_mode <> 'never'
            then version.explanation_text else null end
        ) order by item.order_index), '[]'::jsonb)
        from public.exercise_answers answer
        join public.question_set_items item on item.id = answer.set_item_id
        join public.question_versions version on version.id = item.question_version_id
        left join public.question_answer_keys answer_key on answer_key.question_version_id = version.id
        where answer.attempt_id = attempt.id
      )
    ) into v_result
    from public.exercise_attempts attempt
    join public.exercise_deliveries delivery on delivery.id = attempt.delivery_id
    join public.enrollments enrollment on enrollment.id = attempt.enrollment_id
    where attempt.id = p_attempt_id
      and enrollment.student_id = app.my_student_id()
      and attempt.results_published_at is not null;
  else
    select jsonb_build_object(
      'status', attempt.status,
      'raw_score', attempt.raw_score,
      'final_score', attempt.final_score_100,
      'max_score', 100,
      'published_at', delivery.results_published_at,
      'answers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'set_item_id', answer.set_item_id,
          'order_index', item.order_index,
          'points', item.points,
          'question_version_id', version.id,
          'question_type', version.question_type,
          'prompt_text', version.prompt_text,
          'prompt_content', version.prompt_content,
          'options', coalesce((
            select jsonb_agg(jsonb_build_object(
              'option_key', option.option_key,
              'content', option.content
            ) order by option.order_index)
            from public.question_options option
            where option.question_version_id = version.id
          ), '[]'::jsonb),
          'answer', answer.answer_payload,
          'score', answer.final_score,
          'feedback', answer.feedback,
          'answer_key', case when delivery.answer_release_mode <> 'never'
            then answer_key.answer_key else null end,
          'explanation', case when delivery.answer_release_mode <> 'never'
            then version.explanation_text else null end
        ) order by item.order_index), '[]'::jsonb)
        from public.exam_answers answer
        join public.question_set_items item on item.id = answer.set_item_id
        join public.question_versions version on version.id = item.question_version_id
        left join public.question_answer_keys answer_key on answer_key.question_version_id = version.id
        where answer.attempt_id = attempt.id
      )
    ) into v_result
    from public.exam_attempts attempt
    join public.exam_deliveries delivery on delivery.id = attempt.exam_delivery_id
    join public.enrollments enrollment on enrollment.id = attempt.enrollment_id
    where attempt.id = p_attempt_id
      and enrollment.student_id = app.my_student_id()
      and delivery.results_published_at is not null;
  end if;

  if v_result is null then raise exception 'Kết quả chưa được công bố'; end if;
  return v_result;
end
$$;

revoke all on function public.get_my_assessment_result(public.question_set_kind, uuid)
  from public, anon;
grant execute on function public.get_my_assessment_result(public.question_set_kind, uuid)
  to authenticated;
