begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.announcement@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'teacher.a.announcement@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'teacher.b.announcement@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'student.a.announcement@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'student.b.announcement@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('e0000000-0000-0000-0000-000000000001', 'super_admin', 'Admin announcement', 'admin.announcement@polymind.test'),
  ('e0000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên A', 'teacher.a.announcement@polymind.test'),
  ('e0000000-0000-0000-0000-000000000003', 'teacher', 'Giáo viên B', 'teacher.b.announcement@polymind.test'),
  ('e0000000-0000-0000-0000-000000000004', 'student', 'Học viên A', 'student.a.announcement@polymind.test'),
  ('e0000000-0000-0000-0000-000000000005', 'student', 'Học viên B', 'student.b.announcement@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'GV-ANN-A'),
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'GV-ANN-B');

insert into public.students (id, user_id, student_code, full_name)
values
  ('e2000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'HV-ANN-A', 'Học viên A'),
  ('e2000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'HV-ANN-B', 'Học viên B');

insert into public.courses (id, code, title, course_type, status)
values ('e3000000-0000-0000-0000-000000000001', 'ANN-COURSE', 'Khóa test announcement', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  ('e4000000-0000-0000-0000-000000000001', 'ANN-CLASS-A', 'e3000000-0000-0000-0000-000000000001', 'Lớp nhận announcement', 10, 10, 90, '2026-07-20', 'offline', 'planned'),
  ('e4000000-0000-0000-0000-000000000002', 'ANN-CLASS-B', 'e3000000-0000-0000-0000-000000000001', 'Lớp không liên quan', 10, 10, 90, '2026-07-20', 'offline', 'planned');

insert into public.class_teachers (class_id, teacher_id, assignment_role)
values
  ('e4000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'primary'),
  ('e4000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003', 'primary');

insert into public.enrollments (id, student_id, class_id, status)
values
  ('e5000000-0000-0000-0000-000000000004', 'e2000000-0000-0000-0000-000000000004', 'e4000000-0000-0000-0000-000000000001', 'active'),
  ('e5000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000005', 'e4000000-0000-0000-0000-000000000002', 'active');

create temporary table test_announcement_ids (
  kind text primary key,
  announcement_id uuid not null
);
grant select, insert, update, delete on test_announcement_ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select public.save_announcement('Giáo viên tự tạo', 'Không hợp lệ')$$,
  'P0001',
  'Chỉ super admin được quản lý announcement',
  'Giáo viên không gọi được RPC tạo announcement'
);

select throws_ok(
  $$select public.publish_announcement('e6000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Chỉ super admin được phát hành announcement',
  'Giáo viên không gọi được RPC phát hành announcement'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$insert into public.announcements (title, body, created_by)
    values ('Ghi thẳng', 'Không qua RPC', 'e0000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'Admin không ghi thẳng announcements — mutation chỉ qua RPC'
);

insert into test_announcement_ids (kind, announcement_id)
select 'class', public.save_announcement(
  'Lịch nghỉ lớp A',
  'Lớp A nghỉ buổi học cuối tuần.',
  'e4000000-0000-0000-0000-000000000001'
);

select ok(
  (select announcement_id is not null from test_announcement_ids where kind = 'class'),
  'RPC tạo draft và trả announcement id'
);

select is(
  (select created_by from public.announcements
   where id = (select announcement_id from test_announcement_ids where kind = 'class')),
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'created_by là actor admin thật'
);

select is(
  (select count(*)::integer from public.audit_logs
   where resource_id = (select announcement_id from test_announcement_ids where kind = 'class')
     and action = 'announcement.create_draft'),
  1,
  'Tạo draft có audit'
);

select lives_ok(
  format(
    $$select public.save_announcement('Lịch nghỉ lớp A — cập nhật', 'Nội dung đã rà soát.', %L, null, %L)$$,
    'e4000000-0000-0000-0000-000000000001',
    (select announcement_id from test_announcement_ids where kind = 'class')
  ),
  'Admin sửa được draft qua RPC'
);

select is(
  (select title from public.announcements
   where id = (select announcement_id from test_announcement_ids where kind = 'class')),
  'Lịch nghỉ lớp A — cập nhật',
  'Draft lưu nội dung cập nhật'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::integer from public.announcements),
  0,
  'Học viên không thấy announcement còn draft'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  public.publish_announcement(
    (select announcement_id from test_announcement_ids where kind = 'class')
  ),
  2,
  'Publish theo lớp phân phối đúng 2 notification'
);

select ok(
  (select published_at is not null from public.announcements
   where id = (select announcement_id from test_announcement_ids where kind = 'class')),
  'Publish đặt published_at'
);

select is(
  (select count(*)::integer from public.notifications
   where resource_id = (select announcement_id from test_announcement_ids where kind = 'class')),
  2,
  'Announcement lớp tạo đúng 2 notification'
);

select is(
  (select count(*)::integer from public.notifications
   where resource_id = (select announcement_id from test_announcement_ids where kind = 'class')
     and user_id in ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004')),
  2,
  'Người nhận là giáo viên và học viên lớp A'
);

select is(
  (select count(*)::integer from public.notifications
   where resource_id = (select announcement_id from test_announcement_ids where kind = 'class')
     and user_id in ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000005')),
  0,
  'Lớp B không nhận notification của lớp A'
);

select is(
  (select count(*)::integer from public.audit_logs
   where resource_id = (select announcement_id from test_announcement_ids where kind = 'class')
     and action = 'announcement.publish'),
  1,
  'Publish announcement có audit'
);

select throws_ok(
  format(
    'select public.publish_announcement(%L)',
    (select announcement_id from test_announcement_ids where kind = 'class')
  ),
  'P0001',
  'Announcement đã được phát hành',
  'Không publish trùng announcement'
);

select throws_ok(
  format(
    $$select public.save_announcement('Sửa lịch sử', 'Không được phép', %L, null, %L)$$,
    'e4000000-0000-0000-0000-000000000001',
    (select announcement_id from test_announcement_ids where kind = 'class')
  ),
  'P0001',
  'Announcement đã phát hành — không thể sửa',
  'Announcement đã publish bị khóa nội dung'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.announcements), 1, 'Giáo viên lớp A đọc được announcement lớp A');

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.announcements), 0, 'Giáo viên lớp B không đọc announcement lớp A');

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.announcements), 1, 'Học viên lớp A đọc được announcement lớp A');

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is((select count(*)::integer from public.announcements), 0, 'Học viên lớp B không đọc announcement lớp A');

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into test_announcement_ids (kind, announcement_id)
select 'global', public.save_announcement(
  'Thông báo toàn trung tâm',
  'Nội dung dành cho mọi giáo viên và học viên.'
);

select is(
  public.publish_announcement(
    (select announcement_id from test_announcement_ids where kind = 'global')
  ),
  4,
  'Announcement toàn hệ thống phân phối tới 4 teacher/student'
);

select is(
  (select count(*)::integer from public.notifications
   where resource_id = (select announcement_id from test_announcement_ids where kind = 'global')),
  4,
  'Global announcement tạo đúng 4 notification'
);

select is(
  (select count(*)::integer from public.notifications
   where resource_id = (select announcement_id from test_announcement_ids where kind = 'global')
     and user_id = 'e0000000-0000-0000-0000-000000000001'),
  0,
  'Actor admin không tự nhận notification announcement'
);

select is(
  (select class_id from public.announcements
   where id = (select announcement_id from test_announcement_ids where kind = 'global')),
  null::uuid,
  'Global announcement có class_id null'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::integer from public.announcements
   where id = (select announcement_id from test_announcement_ids where kind = 'global')),
  1,
  'Giáo viên lớp B đọc được global announcement'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (select count(*)::integer from public.announcements
   where id = (select announcement_id from test_announcement_ids where kind = 'global')),
  1,
  'Học viên lớp B đọc được global announcement'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  format(
    'select public.expire_announcement(%L)',
    (select announcement_id from test_announcement_ids where kind = 'class')
  ),
  'Admin kết thúc announcement đã publish qua RPC'
);

select is(
  (select count(*)::integer from public.audit_logs
   where resource_id = (select announcement_id from test_announcement_ids where kind = 'class')
     and action = 'announcement.expire'),
  1,
  'Kết thúc announcement có audit'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is(
  (select count(*)::integer from public.announcements
   where id = (select announcement_id from test_announcement_ids where kind = 'class')),
  0,
  'Announcement hết hiệu lực biến mất khỏi học viên lớp A'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  format(
    'delete from public.announcements where id = %L',
    (select announcement_id from test_announcement_ids where kind = 'class')
  ),
  '42501',
  null,
  'Không hard-delete announcement qua table grant'
);

select throws_ok(
  format(
    'select public.expire_announcement(%L)',
    (select announcement_id from test_announcement_ids where kind = 'class')
  ),
  'P0001',
  'Announcement đã hết hiệu lực',
  'Không kết thúc trùng announcement'
);

select * from finish();
rollback;

