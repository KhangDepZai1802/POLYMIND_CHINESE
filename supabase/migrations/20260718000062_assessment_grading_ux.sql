-- Chấm nhiều câu trong một lần lưu và trả kết quả học viên ở dạng đủ dữ liệu để
-- giao diện hiển thị nội dung, không lộ JSON/khóa đáp án kỹ thuật.

create or replace function public.grade_exercise_answers_bulk(
  p_delivery_id uuid,
  p_grades jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grade jsonb;
  v_count integer := 0;
  v_answer_id uuid;
begin
  perform app.require_assessment_author();
  if jsonb_typeof(p_grades) <> 'array' or jsonb_array_length(p_grades) = 0 then
    raise exception 'Chưa có điểm nào để lưu';
  end if;

  for v_grade in select value from jsonb_array_elements(p_grades)
  loop
    v_answer_id := (v_grade->>'answer_id')::uuid;
    if not exists (
      select 1
      from public.exercise_answers answer
      join public.exercise_attempts attempt on attempt.id = answer.attempt_id
      where answer.id = v_answer_id
        and attempt.delivery_id = p_delivery_id
    ) then
      raise exception 'Câu trả lời không thuộc bài tập đang chấm';
    end if;

    perform public.grade_exercise_answer(
      v_answer_id,
      (v_grade->>'score')::numeric,
      nullif(trim(v_grade->>'feedback'), ''),
      nullif(trim(v_grade->>'override_reason'), '')
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

create or replace function public.grade_exam_answers_bulk(
  p_delivery_id uuid,
  p_grades jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grade jsonb;
  v_count integer := 0;
  v_answer_id uuid;
begin
  perform app.require_assessment_author();
  if jsonb_typeof(p_grades) <> 'array' or jsonb_array_length(p_grades) = 0 then
    raise exception 'Chưa có điểm nào để lưu';
  end if;

  for v_grade in select value from jsonb_array_elements(p_grades)
  loop
    v_answer_id := (v_grade->>'answer_id')::uuid;
    if not exists (
      select 1
      from public.exam_answers answer
      join public.exam_attempts attempt on attempt.id = answer.attempt_id
      where answer.id = v_answer_id
        and attempt.exam_delivery_id = p_delivery_id
    ) then
      raise exception 'Câu trả lời không thuộc kỳ thi đang chấm';
    end if;

    perform public.grade_exam_answer(
      v_answer_id,
      (v_grade->>'score')::numeric,
      nullif(trim(v_grade->>'feedback'), ''),
      nullif(trim(v_grade->>'override_reason'), '')
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

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
          'question_type', version.question_type,
          'prompt_text', version.prompt_text,
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
          'question_type', version.question_type,
          'prompt_text', version.prompt_text,
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

revoke all on function public.grade_exercise_answers_bulk(uuid, jsonb) from public, anon;
revoke all on function public.grade_exam_answers_bulk(uuid, jsonb) from public, anon;
grant execute on function public.grade_exercise_answers_bulk(uuid, jsonb) to authenticated;
grant execute on function public.grade_exam_answers_bulk(uuid, jsonb) to authenticated;

