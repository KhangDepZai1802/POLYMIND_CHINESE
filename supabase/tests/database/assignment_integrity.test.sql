begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into public.courses (id, code, title, course_type, status)
values
  ('70000000-0000-0000-0000-000000000001', 'TEST-ASG-1', 'Khóa kiểm tra bài tập 1', 'custom', 'active'),
  ('70000000-0000-0000-0000-000000000002', 'TEST-ASG-2', 'Khóa kiểm tra bài tập 2', 'custom', 'active');

insert into public.course_modules (id, course_id, title, order_index)
values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Chương 1', 1),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'Chương 2', 1);

insert into public.lessons (id, module_id, title, order_index)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Bài đúng khóa', 1),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'Bài sai khóa', 1);

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  ('73000000-0000-0000-0000-000000000001', 'TEST-ASG-C1', '70000000-0000-0000-0000-000000000001', 'Lớp bài tập 1', 10, 10, 90, '2026-07-20', 'offline', 'planned'),
  ('73000000-0000-0000-0000-000000000002', 'TEST-ASG-C2', '70000000-0000-0000-0000-000000000002', 'Lớp bài tập 2', 10, 10, 90, '2026-07-20', 'offline', 'planned');

insert into public.class_sessions (id, class_id, session_number, starts_at, ends_at)
values
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 1, '2026-07-21 11:00+00', '2026-07-21 12:30+00'),
  ('74000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', 1, '2026-07-21 11:00+00', '2026-07-21 12:30+00');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.asg-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'victim.asg-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'student.asg-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('75000000-0000-0000-0000-000000000001', 'super_admin', 'Admin kiểm tra bài tập', 'admin.asg-test@polymind.test'),
  ('75000000-0000-0000-0000-000000000002', 'teacher', 'Người bị mạo danh', 'victim.asg-test@polymind.test'),
  ('75000000-0000-0000-0000-000000000003', 'student', 'Học viên kiểm tra bài tập', 'student.asg-test@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values ('76000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000003', 'HV-ASG-TEST', 'Học viên kiểm tra bài tập');

insert into public.enrollments (id, student_id, class_id, status)
values ('77000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'active');

-- --- Tạo assignment dưới vai admin đã đăng nhập ------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"75000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.assignments (
  id, class_id, lesson_id, title, status, published_at, created_by
)
values (
  '78000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  'Bài tập draft an toàn',
  'published',
  now(),
  '75000000-0000-0000-0000-000000000002'
);

select is(
  (select created_by from public.assignments where id = '78000000-0000-0000-0000-000000000001'),
  '75000000-0000-0000-0000-000000000001'::uuid,
  'INSERT không mạo danh được created_by'
);

select is(
  (select status from public.assignments where id = '78000000-0000-0000-0000-000000000001'),
  'draft'::public.assignment_status,
  'INSERT luôn tạo draft dù client khai published'
);

select is(
  (select published_at from public.assignments where id = '78000000-0000-0000-0000-000000000001'),
  null::timestamptz,
  'INSERT luôn xóa published_at do client khai'
);

select ok(
  not has_column_privilege('authenticated', 'public.assignments', 'status', 'UPDATE'),
  'authenticated không được UPDATE status trực tiếp'
);

select ok(
  has_column_privilege('authenticated', 'public.assignments', 'title', 'UPDATE'),
  'authenticated vẫn sửa được nội dung assignment'
);

select throws_ok(
  $$update public.assignments set status = 'published' where id = '78000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table assignments',
  'Table API không publish trực tiếp được'
);

reset role;

select throws_ok(
  $$insert into public.assignments (class_id, lesson_id, title, created_by)
    values ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002', 'Sai lesson', '75000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Bài học không thuộc khóa học của lớp',
  'DB chặn lesson ngoài course của lớp'
);

select throws_ok(
  $$insert into public.assignments (class_id, session_id, title, created_by)
    values ('73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000002', 'Sai session', '75000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Buổi học không thuộc lớp của bài tập',
  'DB chặn session ngoài class'
);

insert into storage.objects (id, bucket_id, name)
values (
  '79000000-0000-0000-0000-000000000001',
  'assignment-files',
  '73000000-0000-0000-0000-000000000001/78000000-0000-0000-0000-000000000001/79000000-0000-0000-0000-000000000002.pdf'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"75000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$insert into public.assignment_attachments (assignment_id, object_path, file_name)
    values ('78000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002/78000000-0000-0000-0000-000000000001/sai.pdf', 'sai.pdf')$$,
  'P0001',
  'Đường dẫn file bài tập không đúng lớp hoặc bài tập',
  'DB chặn attachment path sai class'
);

insert into public.assignment_attachments (
  id, assignment_id, object_path, file_name, uploaded_by
)
values (
  '79000000-0000-0000-0000-000000000003',
  '78000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001/78000000-0000-0000-0000-000000000001/79000000-0000-0000-0000-000000000002.pdf',
  'Đề bài.pdf',
  '75000000-0000-0000-0000-000000000002'
);

select is(
  (select uploaded_by from public.assignment_attachments where id = '79000000-0000-0000-0000-000000000003'),
  '75000000-0000-0000-0000-000000000001'::uuid,
  'Attachment uploaded_by luôn là actor thật'
);

-- Draft phải vô hình ở cả metadata lẫn storage, kể cả biết chính xác object path.
set local request.jwt.claims = '{"sub":"75000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.assignments where id = '78000000-0000-0000-0000-000000000001'), 0, 'Học viên không thấy assignment draft');
select is((select count(*)::int from public.assignment_attachments where id = '79000000-0000-0000-0000-000000000003'), 0, 'Học viên không thấy metadata attachment draft');
select is((select count(*)::int from storage.objects where id = '79000000-0000-0000-0000-000000000001'), 0, 'Học viên biết path vẫn không đọc được object draft');

-- Publish atomic và idempotent.
set local request.jwt.claims = '{"sub":"75000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.publish_assignment('78000000-0000-0000-0000-000000000001')$$,
  'RPC publish chạy thành công'
);

select is((select status from public.assignments where id = '78000000-0000-0000-0000-000000000001'), 'published'::public.assignment_status, 'RPC đổi trạng thái sang published');
select ok((select published_at is not null from public.assignments where id = '78000000-0000-0000-0000-000000000001'), 'RPC đặt published_at');
select is((select count(*)::int from public.notifications where user_id = '75000000-0000-0000-0000-000000000003' and dedupe_key = 'assignment_new:78000000-0000-0000-0000-000000000001'), 1, 'Publish sinh đúng một notification');

select lives_ok(
  $$select public.publish_assignment('78000000-0000-0000-0000-000000000001')$$,
  'Publish lặp lại không lỗi'
);

select is((select count(*)::int from public.notifications where user_id = '75000000-0000-0000-0000-000000000003' and dedupe_key = 'assignment_new:78000000-0000-0000-0000-000000000001'), 1, 'Publish lặp không sinh notification trùng');

-- Sau publish, học viên đọc được đủ ba lớp dữ liệu.
set local request.jwt.claims = '{"sub":"75000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.assignments where id = '78000000-0000-0000-0000-000000000001'), 1, 'Học viên thấy assignment đã publish');
select is((select count(*)::int from public.assignment_attachments where id = '79000000-0000-0000-0000-000000000003'), 1, 'Học viên thấy metadata attachment đã publish');
select is((select count(*)::int from storage.objects where id = '79000000-0000-0000-0000-000000000001'), 1, 'Học viên đọc được object sau publish');

-- Close là trạng thái nghiệp vụ thật: DB phải chặn submission mới, không chỉ UI.
set local request.jwt.claims = '{"sub":"75000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.close_assignment('78000000-0000-0000-0000-000000000001')$$,
  'RPC đóng bài chạy thành công'
);

select is((select status from public.assignments where id = '78000000-0000-0000-0000-000000000001'), 'closed'::public.assignment_status, 'RPC đổi trạng thái sang closed');

set local request.jwt.claims = '{"sub":"75000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$insert into public.submissions (assignment_id, enrollment_id, text_answer)
    values ('78000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001', 'Cố nộp sau khi đóng')$$,
  'P0001',
  'Bài tập chưa mở nhận bài nộp',
  'Học viên không nộp mới được sau khi assignment đã đóng'
);

set local request.jwt.claims = '{"sub":"75000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$delete from public.assignments where id = '78000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không thể xóa bài tập đã giao hoặc đã có bài nộp. Hãy đóng bài để giữ lịch sử.',
  'Bài đã giao không hard-delete được'
);

insert into public.assignments (id, class_id, title, created_by)
values ('78000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001', 'Bản nháp xóa được', '75000000-0000-0000-0000-000000000001');

select lives_ok(
  $$delete from public.assignments where id = '78000000-0000-0000-0000-000000000002'$$,
  'Bản nháp chưa có lịch sử vẫn xóa được'
);

reset role;

select * from finish();
rollback;
