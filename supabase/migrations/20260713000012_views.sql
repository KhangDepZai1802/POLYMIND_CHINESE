-- =============================================================================
-- 12 — Views
--
-- Tất cả dùng `security_invoker = true`: RLS của NGƯỜI GỌI vẫn được áp dụng.
-- Nếu để mặc định (security_definer), view sẽ chạy với quyền của người tạo
-- (postgres) và trở thành cửa hậu vòng qua toàn bộ RLS.
-- =============================================================================

-- --- Chuyên cần theo enrollment ----------------------------------------------
-- Buổi `cancelled` KHÔNG tính vào mẫu số — học viên không thể có mặt ở buổi bị hủy.

create view public.v_student_attendance_summary
with (security_invoker = true) as
select
  e.id                as enrollment_id,
  e.student_id,
  e.class_id,
  count(s.id)         as total_sessions,
  count(a.id) filter (where a.status = 'present') as present_count,
  count(a.id) filter (where a.status = 'late')    as late_count,
  count(a.id) filter (where a.status = 'absent')  as absent_count,
  count(a.id) filter (where a.status = 'excused') as excused_count,
  case
    when count(s.id) = 0 then null
    else round(
      100.0 * count(a.id) filter (where a.status in ('present', 'late'))
      / count(s.id), 2)
  end as attendance_rate
from public.enrollments e
left join public.class_sessions s
  on s.class_id = e.class_id
  and s.status in ('completed', 'scheduled')
  and s.starts_at <= now()
left join public.attendance_records a
  on a.session_id = s.id and a.enrollment_id = e.id
group by e.id, e.student_id, e.class_id;

-- --- Số dư học phí ------------------------------------------------------------
-- KHÔNG có bảng "công nợ". Số dư là GIÁ TRỊ TÍNH RA từ invoice và payment.
-- Lưu thành cột riêng thì sớm muộn cũng lệch.

create view public.v_tuition_balance
with (security_invoker = true) as
select
  i.id            as invoice_id,
  i.invoice_code,
  i.student_id,
  i.class_id,
  i.enrollment_id,
  i.issue_date,
  i.due_date,
  i.total,
  i.status,
  coalesce(sum(p.amount), 0)            as paid_amount,
  i.total - coalesce(sum(p.amount), 0)  as balance,
  (
    i.due_date is not null
    and i.due_date < current_date
    and i.total - coalesce(sum(p.amount), 0) > 0
    and i.status not in ('cancelled', 'refunded', 'paid')
  ) as is_overdue
from public.tuition_invoices i
left join public.tuition_payments p on p.invoice_id = i.id
group by i.id;

-- --- Tiến độ theo enrollment --------------------------------------------------
-- Công thức CÔNG KHAI, tính từ dữ liệu thật — không phải cột "% tiến độ" nhập tay
-- như hệ cũ (nhập tay thì nó là ý kiến, không phải sự thật).
--
--   progress = 0.40 × bài học hoàn thành
--            + 0.30 × chuyên cần
--            + 0.15 × bài tập đã nộp
--            + 0.15 × điểm TB đã publish

create view public.v_enrollment_progress
with (security_invoker = true) as
with lesson_stats as (
  select
    e.id as enrollment_id,
    (
      select count(*)
      from public.lessons l
      join public.course_modules m on m.id = l.module_id
      join public.classes c on c.course_id = m.course_id
      where c.id = e.class_id
    ) as total_lessons,
    (
      select count(*)
      from public.lesson_progress lp
      where lp.enrollment_id = e.id and lp.status = 'completed'
    ) as completed_lessons
  from public.enrollments e
),
assignment_stats as (
  select
    e.id as enrollment_id,
    (
      select count(*)
      from public.assignments a
      where a.class_id = e.class_id and a.published_at is not null
    ) as total_assignments,
    (
      select count(*)
      from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.enrollment_id = e.id
        and a.published_at is not null
        and s.submitted_at is not null
    ) as submitted_assignments
  from public.enrollments e
),
score_stats as (
  select
    e.id as enrollment_id,
    (
      select round(avg(r.overall_score), 2)
      from public.assessment_results r
      where r.enrollment_id = e.id
        and r.published_at is not null
        and r.overall_score is not null
    ) as avg_score
  from public.enrollments e
)
select
  e.id as enrollment_id,
  e.student_id,
  e.class_id,
  e.status as enrollment_status,
  c.course_id,

  ls.total_lessons,
  ls.completed_lessons,
  ats.total_assignments,
  ats.submitted_assignments,
  ss.avg_score,
  att.attendance_rate,

  round(
      0.40 * case when ls.total_lessons > 0
                  then 100.0 * ls.completed_lessons / ls.total_lessons else 0 end
    + 0.30 * coalesce(att.attendance_rate, 0)
    + 0.15 * case when ats.total_assignments > 0
                  then 100.0 * ats.submitted_assignments / ats.total_assignments else 0 end
    + 0.15 * coalesce(ss.avg_score, 0)
  , 2) as progress_percent,

  -- Đủ điều kiện hoàn thành? So với rule cấu hình TRÊN COURSE.
  -- Hệ thống chỉ TÍNH và hiển thị. NGƯỜI mới là người bấm nút xác nhận (BR-9).
  (
    coalesce(att.attendance_rate, 0) >= co.completion_min_attendance_rate
    and coalesce(ss.avg_score, 0) >= co.completion_min_overall_score
    and (
      not co.completion_require_all_assignments
      or (ats.total_assignments > 0 and ats.submitted_assignments >= ats.total_assignments)
    )
  ) as is_completion_ready,

  co.completion_min_attendance_rate,
  co.completion_min_overall_score,
  co.completion_require_all_assignments
from public.enrollments e
join public.classes c on c.id = e.class_id
join public.courses co on co.id = c.course_id
join lesson_stats ls on ls.enrollment_id = e.id
join assignment_stats ats on ats.enrollment_id = e.id
join score_stats ss on ss.enrollment_id = e.id
left join public.v_student_attendance_summary att on att.enrollment_id = e.id;

-- --- Tiến độ theo lớp ---------------------------------------------------------

create view public.v_class_progress
with (security_invoker = true) as
select
  c.id   as class_id,
  c.code as class_code,
  c.name as class_name,
  c.status,
  c.capacity,
  count(e.id) filter (where e.status = 'active')    as active_students,
  count(e.id) filter (where e.status = 'completed') as completed_students,
  round(avg(p.attendance_rate), 2)  as avg_attendance_rate,
  round(avg(p.avg_score), 2)        as avg_score,
  round(avg(p.progress_percent), 2) as avg_progress_percent
from public.classes c
left join public.enrollments e on e.class_id = c.id
left join public.v_enrollment_progress p on p.enrollment_id = e.id
group by c.id;

-- --- Học viên cần chú ý -------------------------------------------------------

create view public.v_at_risk_students
with (security_invoker = true) as
select
  p.enrollment_id,
  p.student_id,
  p.class_id,
  s.full_name,
  s.student_code,
  c.name as class_name,
  p.attendance_rate,
  p.avg_score,
  p.progress_percent,
  (p.total_assignments - p.submitted_assignments) as missing_assignments,
  array_remove(array[
    case when p.attendance_rate is not null
              and p.attendance_rate < p.completion_min_attendance_rate
         then 'Chuyên cần thấp' end,
    case when p.avg_score is not null
              and p.avg_score < p.completion_min_overall_score
         then 'Điểm thấp' end,
    case when p.total_assignments - p.submitted_assignments >= 2
         then 'Thiếu bài tập' end
  ], null) as risk_reasons
from public.v_enrollment_progress p
join public.students s on s.id = p.student_id
join public.classes c on c.id = p.class_id
where p.enrollment_status = 'active'
  and (
    (p.attendance_rate is not null and p.attendance_rate < p.completion_min_attendance_rate)
    or (p.avg_score is not null and p.avg_score < p.completion_min_overall_score)
    or (p.total_assignments - p.submitted_assignments >= 2)
  );
