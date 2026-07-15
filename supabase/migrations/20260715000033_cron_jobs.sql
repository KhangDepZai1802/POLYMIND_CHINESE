-- =============================================================================
-- 33 — Cron jobs: nhắc lịch, nhắc bài sắp hạn, hóa đơn quá hạn
--
-- Đây là system flow, không phải user flow. Ba RPC chỉ mở cho service_role và
-- tự đóng gói toàn bộ mutation; route cron không được ghi bảng tùy ý.
-- =============================================================================

create or replace function public.run_session_reminders(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.notifications (
    user_id, type, title, body, link, resource_type, resource_id, dedupe_key
  )
  select
    student.user_id,
    'session_upcoming'::public.notification_type,
    'Sắp đến buổi học',
    format(
      'Lớp %s có buổi học lúc %s (giờ Việt Nam).',
      class.name,
      to_char(session.starts_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
    ),
    '/student/schedule',
    'class_session',
    session.id,
    format('session_upcoming:%s', session.id)
  from public.class_sessions session
  join public.classes class on class.id = session.class_id
  join public.enrollments enrollment
    on enrollment.class_id = session.class_id
   and enrollment.status = 'active'
  join public.students student on student.id = enrollment.student_id
  join public.profiles profile
    on profile.id = student.user_id
   and profile.is_active
  where session.status = 'scheduled'
    and session.starts_at >= p_now
    and session.starts_at < p_now + interval '24 hours'
    and student.user_id is not null
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object('notifications_created', v_inserted);
end;
$$;

create or replace function public.run_assignment_due_reminders(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.notifications (
    user_id, type, title, body, link, resource_type, resource_id, dedupe_key
  )
  select
    student.user_id,
    'assignment_due'::public.notification_type,
    'Bài tập sắp hết hạn',
    format(
      'Bài “%s” hết hạn lúc %s (giờ Việt Nam).',
      assignment.title,
      to_char(assignment.due_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
    ),
    format('/student/assignments/%s', assignment.id),
    'assignment',
    assignment.id,
    format('assignment_due:%s', assignment.id)
  from public.assignments assignment
  join public.enrollments enrollment
    on enrollment.class_id = assignment.class_id
   and enrollment.status = 'active'
  join public.students student on student.id = enrollment.student_id
  join public.profiles profile
    on profile.id = student.user_id
   and profile.is_active
  where assignment.status = 'published'
    and assignment.published_at is not null
    and assignment.due_at >= p_now
    and assignment.due_at < p_now + interval '24 hours'
    and student.user_id is not null
    and not exists (
      select 1
      from public.submissions submission
      where submission.assignment_id = assignment.id
        and submission.enrollment_id = enrollment.id
        and submission.submitted_at is not null
    )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object('notifications_created', v_inserted);
end;
$$;

create or replace function public.run_invoice_overdue(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
  v_inserted integer;
begin
  with overdue as (
    update public.tuition_invoices invoice
    set status = 'overdue'
    where invoice.status in ('issued', 'partial')
      and invoice.due_date is not null
      and invoice.due_date < (p_now at time zone 'Asia/Ho_Chi_Minh')::date
    returning invoice.id, invoice.invoice_code, invoice.student_id
  ), notified as (
    insert into public.notifications (
      user_id, type, title, body, link, resource_type, resource_id, dedupe_key
    )
    select
      student.user_id,
      'invoice_overdue'::public.notification_type,
      'Hóa đơn đã quá hạn',
      format('Hóa đơn %s đã quá hạn thanh toán.', overdue.invoice_code),
      '/student/tuition',
      'tuition_invoice',
      overdue.id,
      format('invoice_overdue:%s', overdue.id)
    from overdue
    join public.students student on student.id = overdue.student_id
    join public.profiles profile
      on profile.id = student.user_id
     and profile.is_active
    where student.user_id is not null
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select
    (select count(*) from overdue),
    (select count(*) from notified)
  into v_updated, v_inserted;

  return jsonb_build_object(
    'invoices_updated', v_updated,
    'notifications_created', v_inserted
  );
end;
$$;

revoke all on function public.run_session_reminders(timestamptz)
  from public, anon, authenticated;
revoke all on function public.run_assignment_due_reminders(timestamptz)
  from public, anon, authenticated;
revoke all on function public.run_invoice_overdue(timestamptz)
  from public, anon, authenticated;

grant execute on function public.run_session_reminders(timestamptz) to service_role;
grant execute on function public.run_assignment_due_reminders(timestamptz) to service_role;
grant execute on function public.run_invoice_overdue(timestamptz) to service_role;
