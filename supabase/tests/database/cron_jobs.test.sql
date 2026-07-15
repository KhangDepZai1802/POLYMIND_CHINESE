begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select ok(
  has_function_privilege('service_role', 'public.run_session_reminders(timestamptz)', 'EXECUTE'),
  'service_role được chạy session reminder'
);
select ok(
  not has_function_privilege('authenticated', 'public.run_session_reminders(timestamptz)', 'EXECUTE'),
  'user role không gọi được session reminder'
);
select ok(
  not has_function_privilege('authenticated', 'public.run_assignment_due_reminders(timestamptz)', 'EXECUTE'),
  'user role không gọi được assignment reminder'
);
select ok(
  not has_function_privilege('authenticated', 'public.run_invoice_overdue(timestamptz)', 'EXECUTE'),
  'user role không gọi được invoice overdue'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'e0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'cron-student@polymind.test', '',
  now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', '', '', '', '', ''
);

insert into public.profiles (id, role, full_name, email)
values (
  'e0000000-0000-0000-0000-000000000001',
  'student',
  'Học viên cron',
  'cron-student@polymind.test'
);

insert into public.students (id, user_id, student_code, full_name)
values (
  'e1000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001',
  'HV-CRON-01',
  'Học viên cron'
);

insert into public.courses (id, code, title, course_type, status)
values (
  'e2000000-0000-0000-0000-000000000001',
  'KH-CRON-01',
  'Khóa kiểm thử cron',
  'custom',
  'active'
);

insert into public.classes (
  id, code, course_id, name, capacity, delivery_mode, status
)
values (
  'e3000000-0000-0000-0000-000000000001',
  'LOP-CRON-01',
  'e2000000-0000-0000-0000-000000000001',
  'Lớp kiểm thử cron',
  10,
  'online',
  'planned'
);

insert into public.enrollments (
  id, student_id, class_id, status
)
values (
  'e4000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  'e3000000-0000-0000-0000-000000000001',
  'active'
);

insert into public.class_sessions (
  id, class_id, session_number, starts_at, ends_at, status
)
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    1,
    '2026-07-15 13:00+00',
    '2026-07-15 14:30+00',
    'scheduled'
  ),
  (
    'e5000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000001',
    2,
    '2026-07-16 13:00+00',
    '2026-07-16 14:30+00',
    'scheduled'
  );

insert into public.assignments (
  id, class_id, title, due_at, status, published_at, created_by
)
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Bài chưa nộp',
    '2026-07-15 13:00+00',
    'published',
    '2026-07-14 01:00+00',
    'e0000000-0000-0000-0000-000000000001'
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-000000000001',
    'Bài đã nộp',
    '2026-07-15 13:00+00',
    'published',
    '2026-07-14 01:00+00',
    'e0000000-0000-0000-0000-000000000001'
  );

-- INSERT luôn bị trigger ép về draft; mô phỏng publish sau khi tạo.
update public.assignments
set status = 'published', published_at = '2026-07-14 01:00+00'
where id in (
  'e6000000-0000-0000-0000-000000000001',
  'e6000000-0000-0000-0000-000000000002'
);

insert into public.submissions (
  id, assignment_id, enrollment_id, submitted_at, status
)
values (
  'e7000000-0000-0000-0000-000000000001',
  'e6000000-0000-0000-0000-000000000002',
  'e4000000-0000-0000-0000-000000000001',
  '2026-07-15 00:30+00',
  'submitted'
);

insert into public.tuition_invoices (
  id, invoice_code, student_id, issue_date, due_date,
  subtotal, discount, total, status
)
values (
  'e8000000-0000-0000-0000-000000000001',
  'HD-CRON-01',
  'e1000000-0000-0000-0000-000000000001',
  '2026-07-01',
  '2026-07-14',
  1000000,
  0,
  1000000,
  'issued'
);

select is(
  (public.run_session_reminders('2026-07-15 01:00+00')->>'notifications_created')::integer,
  1,
  'session cron nhắc đúng buổi trong 24 giờ'
);
select is(
  (select count(*)::integer from public.notifications where type = 'session_upcoming'),
  1,
  'session cron tạo đúng một notification'
);
select is(
  (public.run_session_reminders('2026-07-15 01:00+00')->>'notifications_created')::integer,
  0,
  'chạy lại session cron không tạo trùng'
);

select is(
  (public.run_assignment_due_reminders('2026-07-15 01:00+00')->>'notifications_created')::integer,
  1,
  'assignment cron chỉ nhắc bài chưa nộp trong 24 giờ'
);
select is(
  (select resource_id from public.notifications where type = 'assignment_due'),
  'e6000000-0000-0000-0000-000000000001'::uuid,
  'assignment notification trỏ đúng bài chưa nộp'
);
select is(
  (public.run_assignment_due_reminders('2026-07-15 01:00+00')->>'notifications_created')::integer,
  0,
  'chạy lại assignment cron không tạo trùng'
);

select is(
  (public.run_invoice_overdue('2026-07-15 01:00+00')->>'invoices_updated')::integer,
  1,
  'invoice cron cập nhật đúng một hóa đơn quá hạn theo giờ Việt Nam'
);
select is(
  (select status from public.tuition_invoices where id = 'e8000000-0000-0000-0000-000000000001'),
  'overdue'::public.invoice_status,
  'hóa đơn chuyển sang overdue'
);
select is(
  (select count(*)::integer from public.notifications where type = 'invoice_overdue'),
  1,
  'invoice cron tạo đúng một notification'
);
select is(
  (public.run_invoice_overdue('2026-07-15 01:00+00')->>'invoices_updated')::integer,
  0,
  'chạy lại invoice cron không cập nhật lại hóa đơn'
);
select is(
  (select count(*)::integer from public.notifications where type = 'invoice_overdue'),
  1,
  'chạy lại invoice cron không spam notification'
);

select * from finish();
rollback;
