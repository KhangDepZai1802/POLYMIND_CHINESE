-- 44 — View tiến độ additive dùng assessment engine mới (giữ view cũ đến cutover)

alter table public.courses add column if not exists completion_require_all_exercises boolean not null default true;
update public.courses set completion_require_all_exercises = completion_require_all_assignments;

create view public.v_enrollment_assessment_progress with (security_invoker = true) as
with lesson_stats as (
  select e.id enrollment_id,
    (select count(*) from public.lessons l join public.course_modules m on m.id=l.module_id join public.classes c on c.course_id=m.course_id where c.id=e.class_id) total_lessons,
    (select count(*) from public.lesson_progress lp where lp.enrollment_id=e.id and lp.status='completed') completed_lessons
  from public.enrollments e
), exercise_stats as (
  select e.id enrollment_id,
    (select count(*) from public.exercise_deliveries d where d.class_id=e.class_id and d.published_at is not null and d.status not in ('cancelled','archived')) total_exercises,
    (select count(distinct a.delivery_id) from public.exercise_attempts a join public.exercise_deliveries d on d.id=a.delivery_id where a.enrollment_id=e.id and a.submitted_at is not null and a.status<>'invalidated') submitted_exercises
  from public.enrollments e
), score_stats as (
  select e.id enrollment_id, (
    select round(avg(x.score),2) from (
      select a.final_score / nullif(d.max_score,0) * 100 score
      from public.exercise_attempts a join public.exercise_deliveries d on d.id=a.delivery_id
      where a.enrollment_id=e.id and a.results_published_at is not null and a.status='graded'
      union all
      select a.final_score_100 score
      from public.exam_attempts a join public.exam_deliveries d on d.id=a.exam_delivery_id
      where a.enrollment_id=e.id and d.results_published_at is not null and a.status='graded'
    ) x
  ) avg_score from public.enrollments e
)
select e.id enrollment_id,e.student_id,e.class_id,e.status enrollment_status,c.course_id,
  ls.total_lessons,ls.completed_lessons,xs.total_exercises,xs.submitted_exercises,ss.avg_score,att.attendance_rate,
  round(0.40*case when ls.total_lessons>0 then 100.0*ls.completed_lessons/ls.total_lessons else 0 end
    +0.30*coalesce(att.attendance_rate,0)
    +0.15*case when xs.total_exercises>0 then 100.0*xs.submitted_exercises/xs.total_exercises else 0 end
    +0.15*coalesce(ss.avg_score,0),2) progress_percent,
  (coalesce(att.attendance_rate,0)>=co.completion_min_attendance_rate
    and coalesce(ss.avg_score,0)>=co.completion_min_overall_score
    and (not co.completion_require_all_exercises or (xs.total_exercises>0 and xs.submitted_exercises>=xs.total_exercises))) is_completion_ready,
  co.completion_min_attendance_rate,co.completion_min_overall_score,co.completion_require_all_exercises
from public.enrollments e join public.classes c on c.id=e.class_id join public.courses co on co.id=c.course_id
join lesson_stats ls on ls.enrollment_id=e.id join exercise_stats xs on xs.enrollment_id=e.id join score_stats ss on ss.enrollment_id=e.id
left join public.v_student_attendance_summary att on att.enrollment_id=e.id;

create view public.v_class_assessment_progress with (security_invoker = true) as
select c.id class_id,c.code class_code,c.name class_name,c.status,c.capacity,
  count(e.id) filter(where e.status='active') active_students,
  count(e.id) filter(where e.status='completed') completed_students,
  round(avg(p.attendance_rate),2) avg_attendance_rate,round(avg(p.avg_score),2) avg_score,
  round(avg(p.progress_percent),2) avg_progress_percent
from public.classes c left join public.enrollments e on e.class_id=c.id
left join public.v_enrollment_assessment_progress p on p.enrollment_id=e.id group by c.id;

create view public.v_at_risk_assessment_students with (security_invoker = true) as
select p.enrollment_id,p.student_id,p.class_id,s.full_name,s.student_code,c.name class_name,
  p.attendance_rate,p.avg_score,p.progress_percent,
  (p.total_exercises-p.submitted_exercises) missing_exercises,
  array_remove(array[
    case when p.attendance_rate is not null and p.attendance_rate<p.completion_min_attendance_rate then 'Chuyên cần thấp' end,
    case when p.avg_score is not null and p.avg_score<p.completion_min_overall_score then 'Điểm thấp' end,
    case when p.total_exercises-p.submitted_exercises>=2 then 'Thiếu bài tập' end
  ],null) risk_reasons
from public.v_enrollment_assessment_progress p join public.students s on s.id=p.student_id join public.classes c on c.id=p.class_id
where p.enrollment_status='active' and (
  (p.attendance_rate is not null and p.attendance_rate<p.completion_min_attendance_rate)
  or (p.avg_score is not null and p.avg_score<p.completion_min_overall_score)
  or p.total_exercises-p.submitted_exercises>=2
);

grant select on public.v_enrollment_assessment_progress, public.v_class_assessment_progress, public.v_at_risk_assessment_students to authenticated;
