-- 43 — Tổng quan an toàn cho student: thấy trạng thái nộp nhưng không lộ điểm trước công bố

create or replace function public.get_student_assessment_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_active() or app.current_role() <> 'student' then raise exception 'Chỉ học viên'; end if;
  return jsonb_build_object(
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'instructions', d.instructions, 'status', d.status,
        'available_from', d.available_from, 'due_at', d.due_at, 'max_score', d.max_score,
        'attempt_limit', d.attempt_limit, 'allow_late_submission', d.allow_late_submission,
        'class', jsonb_build_object('code', c.code, 'name', c.name),
        'attempts', coalesce((select jsonb_agg(jsonb_build_object(
          'id', a.id, 'attempt_no', a.attempt_no, 'status', a.status, 'started_at', a.started_at,
          'submitted_at', a.submitted_at,
          'final_score', case when a.results_published_at is not null then a.final_score else null end,
          'results_published_at', a.results_published_at
        ) order by a.attempt_no desc) from public.exercise_attempts a where a.delivery_id = d.id and a.enrollment_id = e.id), '[]'::jsonb)
      ) order by d.due_at)
      from public.enrollments e join public.exercise_deliveries d on d.class_id = e.class_id join public.classes c on c.id = d.class_id
      where e.student_id = app.my_student_id() and e.status in ('active','paused') and d.status not in ('draft','cancelled','archived')
    ), '[]'::jsonb),
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'status', d.status, 'opens_at', d.opens_at, 'closes_at', d.closes_at,
        'duration_minutes', d.duration_minutes, 'results_published_at', d.results_published_at,
        'class', jsonb_build_object('code', c.code, 'name', c.name),
        'attempts', coalesce((select jsonb_agg(jsonb_build_object(
          'id', a.id, 'status', a.status, 'started_at', a.started_at, 'deadline_at', a.deadline_at,
          'submitted_at', a.submitted_at,
          'final_score_100', case when d.results_published_at is not null then a.final_score_100 else null end
        )) from public.exam_attempts a where a.exam_delivery_id = d.id and a.enrollment_id = e.id and a.status <> 'invalidated'), '[]'::jsonb)
      ) order by d.opens_at)
      from public.enrollments e join public.exam_deliveries d on d.class_id = e.class_id join public.classes c on c.id = d.class_id
      where e.student_id = app.my_student_id() and e.status = 'active' and d.status not in ('draft','cancelled','archived')
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.get_student_assessment_overview() from public, anon;
grant execute on function public.get_student_assessment_overview() to authenticated;
