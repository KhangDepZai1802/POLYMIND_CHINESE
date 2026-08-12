begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- Actor: super admin, giáo viên thường, học viên.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'admin.makeup@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'teacher.makeup@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'student.makeup@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '');

insert into public.profiles(id, role, full_name, email)
values
  ('91000000-0000-0000-0000-000000000001', 'super_admin', 'Admin lịch bù', 'admin.makeup@polymind.test'),
  ('91000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên lịch bù', 'teacher.makeup@polymind.test'),
  ('91000000-0000-0000-0000-000000000003', 'student', 'Học viên lịch bù', 'student.makeup@polymind.test');

insert into public.teachers(id, user_id, teacher_code)
values ('91100000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 'GV-MAKEUP');

insert into public.students(id, user_id, student_code, full_name)
values ('91200000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', 'HV-MAKEUP', 'Học viên lịch bù');

insert into public.courses(id, code, title, course_type, status)
values ('91300000-0000-0000-0000-000000000001', 'TEST-MAKEUP', 'Khóa kiểm tra lịch bù', 'custom', 'active');

insert into public.classes(
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  ('91400000-0000-0000-0000-000000000001', 'TEST-MAKEUP-01',
   '91300000-0000-0000-0000-000000000001', 'Lớp chính', 10, 5, 90,
   date '2099-01-01', 'offline', 'planned'),
  ('91400000-0000-0000-0000-000000000002', 'TEST-MAKEUP-02',
   '91300000-0000-0000-0000-000000000001', 'Lớp xung đột', 10, 1, 90,
   date '2099-01-01', 'offline', 'planned');

insert into public.class_teachers(class_id, teacher_id)
values
  ('91400000-0000-0000-0000-000000000001', '91100000-0000-0000-0000-000000000002'),
  ('91400000-0000-0000-0000-000000000002', '91100000-0000-0000-0000-000000000002');

insert into public.enrollments(id, student_id, class_id, status)
values ('91500000-0000-0000-0000-000000000001', '91200000-0000-0000-0000-000000000003',
        '91400000-0000-0000-0000-000000000001', 'active');

insert into public.class_sessions(id, class_id, session_number, starts_at, ends_at)
values
  ('91600000-0000-0000-0000-000000000001', '91400000-0000-0000-0000-000000000001', 1,
   timestamptz '2099-01-02 01:00+00', timestamptz '2099-01-02 02:30+00'),
  ('91600000-0000-0000-0000-000000000002', '91400000-0000-0000-0000-000000000001', 2,
   timestamptz '2099-01-04 01:00+00', timestamptz '2099-01-04 02:30+00'),
  ('91600000-0000-0000-0000-000000000003', '91400000-0000-0000-0000-000000000001', 3,
   timestamptz '2099-01-06 01:00+00', timestamptz '2099-01-06 02:30+00'),
  ('91600000-0000-0000-0000-000000000004', '91400000-0000-0000-0000-000000000001', 4,
   timestamptz '2099-01-08 01:00+00', timestamptz '2099-01-08 02:30+00'),
  ('91600000-0000-0000-0000-000000000005', '91400000-0000-0000-0000-000000000001', 5,
   timestamptz '2099-01-10 01:00+00', timestamptz '2099-01-10 02:30+00'),
  ('91600000-0000-0000-0000-000000000006', '91400000-0000-0000-0000-000000000002', 1,
   timestamptz '2099-01-14 01:00+00', timestamptz '2099-01-14 02:30+00');

select has_function(
  'public', 'reschedule_class_session_with_makeup',
  array['uuid', 'timestamp with time zone', 'timestamp with time zone', 'text', 'uuid'],
  'Có RPC đổi lịch/học bù'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.class_session_schedule_changes'::regclass),
  'Bảng lịch sử thay đổi lịch đã bật RLS'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.reschedule_class_session_with_makeup(uuid,timestamptz,timestamptz,text,uuid)',
    'EXECUTE'
  ),
  'Anon không có EXECUTE RPC'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select public.reschedule_class_session_with_makeup(
      '91600000-0000-0000-0000-000000000002',
      timestamptz '2099-01-12 01:00+00', timestamptz '2099-01-12 02:30+00',
      'Nghỉ theo thông báo', '91700000-0000-0000-0000-000000000001')$$,
  'P0001', 'Chỉ quản trị viên hoặc giáo vụ được đổi lịch học',
  'Giáo viên thường bị RPC chặn fail-closed'
);

set local request.jwt.claims = '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select public.reschedule_class_session_with_makeup(
      '91600000-0000-0000-0000-000000000002',
      timestamptz '2099-01-12 01:00+00', timestamptz '2099-01-12 02:30+00',
      'Nghỉ theo thông báo', '91700000-0000-0000-0000-000000000002')$$,
  'P0001', 'Chỉ quản trị viên hoặc giáo vụ được đổi lịch học',
  'Học viên bị RPC chặn fail-closed'
);

set local request.jwt.claims = '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  public.reschedule_class_session_with_makeup(
    '91600000-0000-0000-0000-000000000002',
    timestamptz '2099-01-12 01:00+00', timestamptz '2099-01-12 02:30+00',
    'Nghỉ theo thông báo của đơn vị', '91700000-0000-0000-0000-000000000003'
  ),
  4,
  'Đổi Buổi 2 dời đúng 4 buổi tới cuối khóa'
);

select is(
  (select count(*)::integer from public.class_sessions where class_id = '91400000-0000-0000-0000-000000000001'),
  5,
  'Tổng số row vẫn đúng 5 — không sinh Buổi 6'
);

select is(
  (select array_agg(session_number order by session_number) from public.class_sessions
   where class_id = '91400000-0000-0000-0000-000000000001'),
  array[1,2,3,4,5],
  'Số buổi vẫn liên tục 1…5'
);

select is(
  (select array_agg(id order by id) from public.class_sessions
   where class_id = '91400000-0000-0000-0000-000000000001'),
  array[
    '91600000-0000-0000-0000-000000000001'::uuid,
    '91600000-0000-0000-0000-000000000002'::uuid,
    '91600000-0000-0000-0000-000000000003'::uuid,
    '91600000-0000-0000-0000-000000000004'::uuid,
    '91600000-0000-0000-0000-000000000005'::uuid
  ],
  'Giữ nguyên toàn bộ session_id'
);

select is(
  (select starts_at from public.class_sessions where id = '91600000-0000-0000-0000-000000000002'),
  timestamptz '2099-01-06 01:00+00',
  'Buổi 2 nhận ngày cũ của Buổi 3'
);

select is(
  (select starts_at from public.class_sessions where id = '91600000-0000-0000-0000-000000000005'),
  timestamptz '2099-01-12 01:00+00',
  'Buổi cuối nhận đúng ngày học bù'
);

select is(
  (select affected_session_count from public.class_session_schedule_changes
   where request_id = '91700000-0000-0000-0000-000000000003'),
  4,
  'Lưu đúng số buổi bị ảnh hưởng'
);

select is(
  (select changed_by from public.class_session_schedule_changes
   where request_id = '91700000-0000-0000-0000-000000000003'),
  '91000000-0000-0000-0000-000000000001'::uuid,
  'Lịch sử ghi actor thật từ auth.uid()'
);

select is(
  (select count(*)::integer from public.audit_logs
   where action = 'class.session.reschedule_makeup'
     and resource_id = '91600000-0000-0000-0000-000000000002'),
  1,
  'Ghi đúng một audit cho thao tác đổi lịch'
);

select is(
  (select count(*)::integer from public.notifications
   where user_id = '91000000-0000-0000-0000-000000000003'
     and type = 'session_changed'),
  1,
  'Học viên trong lớp nhận một thông báo tổng hợp'
);

select is(
  public.reschedule_class_session_with_makeup(
    '91600000-0000-0000-0000-000000000002',
    timestamptz '2099-01-12 01:00+00', timestamptz '2099-01-12 02:30+00',
    'Nghỉ theo thông báo của đơn vị', '91700000-0000-0000-0000-000000000003'
  ),
  4,
  'Gọi lại cùng request_id trả kết quả cũ, không dời lần hai'
);

select is(
  (select count(*)::integer from public.class_session_schedule_changes
   where request_id = '91700000-0000-0000-0000-000000000003'),
  1,
  'Idempotency giữ đúng một hàng lịch sử'
);

select is(
  (select starts_at from public.class_sessions where id = '91600000-0000-0000-0000-000000000005'),
  timestamptz '2099-01-12 01:00+00',
  'Request lặp không dời lịch thêm lần nữa'
);

select throws_ok(
  $$select public.reschedule_class_session_with_makeup(
      '91600000-0000-0000-0000-000000000003',
      timestamptz '2099-01-12 01:00+00', timestamptz '2099-01-12 02:30+00',
      'Thử trùng lịch lớp', '91700000-0000-0000-0000-000000000004')$$,
  'P0001', 'Thời gian học bù bị trùng với một buổi khác của lớp',
  'Chặn mốc bù trùng với buổi khác của lớp'
);

insert into public.attendance_records(session_id, enrollment_id, status, marked_by)
values ('91600000-0000-0000-0000-000000000003', '91500000-0000-0000-0000-000000000001',
        'present', '91000000-0000-0000-0000-000000000001');

select throws_ok(
  $$select public.reschedule_class_session_with_makeup(
      '91600000-0000-0000-0000-000000000003',
      timestamptz '2099-01-16 01:00+00', timestamptz '2099-01-16 02:30+00',
      'Thử dời buổi đã điểm danh', '91700000-0000-0000-0000-000000000005')$$,
  'P0001', 'Không thể dời chuỗi có buổi đã dạy, có nhật ký hoặc có điểm danh',
  'Chặn dời chuỗi có điểm danh'
);

select throws_ok(
  $$insert into public.class_sessions(class_id, session_number, starts_at, ends_at)
    values ('91400000-0000-0000-0000-000000000001', 6,
            timestamptz '2099-01-18 01:00+00', timestamptz '2099-01-18 02:30+00')$$,
  'P0001', 'Lớp chỉ có 5 buổi; không thể tạo Buổi 6',
  'Trigger DB chặn trực tiếp Buổi N+1'
);

delete from public.attendance_records
where session_id = '91600000-0000-0000-0000-000000000003';

select throws_ok(
  $$select public.reschedule_class_session_with_makeup(
      '91600000-0000-0000-0000-000000000004',
      timestamptz '2099-01-14 01:00+00', timestamptz '2099-01-14 02:30+00',
      'Thử trùng lịch giáo viên', '91700000-0000-0000-0000-000000000006')$$,
  'P0001', 'Giáo viên đã có lớp khác trong thời gian học bù',
  'Chặn lịch bù trùng lớp khác của giáo viên'
);

select * from finish();
rollback;
