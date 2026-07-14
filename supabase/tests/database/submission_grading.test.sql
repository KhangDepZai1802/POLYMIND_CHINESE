begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into public.courses (id, code, title, course_type, status)
values ('80000000-0000-0000-0000-000000000001', 'TEST-GRADE', 'Khóa kiểm tra chấm bài', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values (
  '81000000-0000-0000-0000-000000000001', 'TEST-GRADE-C1',
  '80000000-0000-0000-0000-000000000001', 'Lớp kiểm tra chấm bài',
  10, 10, 90, '2026-07-20', 'offline', 'planned'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'teacher.grade-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'outside.grade-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'student.grade-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'admin.grade-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('82000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên chấm bài', 'teacher.grade-test@polymind.test'),
  ('82000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên ngoài lớp', 'outside.grade-test@polymind.test'),
  ('82000000-0000-0000-0000-000000000003', 'student', 'Học viên nộp bài', 'student.grade-test@polymind.test'),
  ('82000000-0000-0000-0000-000000000004', 'super_admin', 'Quản trị chấm bài', 'admin.grade-test@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values
  ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'GV-GRADE-1'),
  ('83000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 'GV-GRADE-2');

insert into public.class_teachers (class_id, teacher_id, assignment_role)
values ('81000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'primary');

insert into public.students (id, user_id, student_code, full_name)
values ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000003', 'HV-GRADE', 'Học viên nộp bài');

insert into public.enrollments (id, student_id, class_id, status)
values ('85000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'active');

insert into public.assignments (id, class_id, title, max_score, created_by)
values ('86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Bài kiểm tra grading', 100, '82000000-0000-0000-0000-000000000001');

update public.assignments
set status = 'published', published_at = now()
where id = '86000000-0000-0000-0000-000000000001';

-- Kể cả admin dùng client JWT cũng không được INSERT sẵn một bài đã chấm.
set local role authenticated;
set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000004","role":"authenticated"}';

insert into public.submissions (
  id, assignment_id, enrollment_id, text_answer, status, score, feedback, graded_by, graded_at
)
values (
  '87000000-0000-0000-0000-000000000099',
  '86000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  'Bài admin nhập hộ',
  'graded', 99, 'Điểm giả', '82000000-0000-0000-0000-000000000004', now()
);

select is((select status from public.submissions where id = '87000000-0000-0000-0000-000000000099'), 'submitted'::public.submission_status, 'Admin INSERT qua JWT cũng về trạng thái submitted');
select is((select score from public.submissions where id = '87000000-0000-0000-0000-000000000099'), null::numeric, 'Admin INSERT qua JWT không thể khai sẵn score');
delete from public.submissions where id = '87000000-0000-0000-0000-000000000099';

-- --- Học viên INSERT: cố tự khai điểm phải bị DB xóa -------------------------

set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000003","role":"authenticated"}';

insert into public.submissions (
  id, assignment_id, enrollment_id, text_answer, submitted_at, is_late,
  status, score, feedback, graded_by, graded_at
)
values (
  '87000000-0000-0000-0000-000000000001',
  '86000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  'Câu trả lời ban đầu',
  '2020-01-01 00:00+00',
  true,
  'graded',
  100,
  'Tự khen mình',
  '82000000-0000-0000-0000-000000000002',
  now()
);

select is((select status from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 'submitted'::public.submission_status, 'Student INSERT luôn về trạng thái submitted');
select is((select score from public.submissions where id = '87000000-0000-0000-0000-000000000001'), null::numeric, 'Student INSERT không tự khai score');
select is((select feedback from public.submissions where id = '87000000-0000-0000-0000-000000000001'), null::text, 'Student INSERT không tự khai feedback');
select is((select graded_by from public.submissions where id = '87000000-0000-0000-0000-000000000001'), null::uuid, 'Student INSERT không mạo danh grader');
select ok((select submitted_at > now() - interval '5 seconds' from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 'submitted_at do DB đặt theo thời điểm thật');

select throws_ok(
  $$update public.submissions set score = 100 where id = '87000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table submissions',
  'Student không UPDATE score trực tiếp được ở tầng GRANT'
);

select lives_ok(
  $$update public.submissions set text_answer = 'Câu trả lời đã sửa' where id = '87000000-0000-0000-0000-000000000001'$$,
  'Student vẫn sửa được text khi bài chưa chấm'
);

select is((select text_answer from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 'Câu trả lời đã sửa', 'Nội dung student sửa được lưu đúng');

-- --- Giáo viên đúng lớp ------------------------------------------------------

set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$update public.submissions set score = 80 where id = '87000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table submissions',
  'Teacher không chấm bằng table UPDATE trực tiếp'
);

select throws_ok(
  $$update public.submissions set text_answer = 'Giáo viên sửa bài học viên' where id = '87000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Giáo viên/quản trị viên không được sửa nội dung bài làm của học viên',
  'Teacher không sửa được bằng chứng text_answer'
);

select lives_ok(
  $$select public.grade_submission('87000000-0000-0000-0000-000000000001', 85, 'Làm tốt')$$,
  'Teacher đúng lớp chấm bài qua RPC thành công'
);

select is((select score from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 85::numeric, 'RPC lưu đúng score');
select is((select feedback from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 'Làm tốt', 'RPC lưu đúng feedback');
select is((select status from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 'graded'::public.submission_status, 'RPC chuyển status sang graded');
select is((select graded_by from public.submissions where id = '87000000-0000-0000-0000-000000000001'), '82000000-0000-0000-0000-000000000001'::uuid, 'graded_by là auth.uid() của teacher thật');
select ok((select graded_at is not null from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 'RPC đặt graded_at');

set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.notifications where user_id = '82000000-0000-0000-0000-000000000003' and dedupe_key = 'submission_graded:87000000-0000-0000-0000-000000000001'), 1, 'Chấm bài sinh đúng một notification');

set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.grade_submission('87000000-0000-0000-0000-000000000001', 90, 'Đã rà soát lại')$$,
  'Chấm lại hợp lệ'
);

set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.notifications where user_id = '82000000-0000-0000-0000-000000000003' and dedupe_key = 'submission_graded:87000000-0000-0000-0000-000000000001'), 1, 'Chấm lại không sinh notification trùng');

set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select public.grade_submission('87000000-0000-0000-0000-000000000001', 101, 'Quá điểm')$$,
  'P0001',
  'Điểm phải từ 0 đến 100.00',
  'RPC chặn score vượt max_score'
);

select is((select score from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 90::numeric, 'Score giữ nguyên sau request vượt max bị rollback');

-- Học viên không sửa được text sau khi đã chấm.
set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$update public.submissions set text_answer = 'Sửa sau chấm' where id = '87000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không thể sửa bài sau khi đã chấm hoặc bài tập đã đóng',
  'Student không sửa bài sau khi đã chấm'
);

-- Giáo viên ngoài lớp không thấy/chấm được submission.
set local request.jwt.claims = '{"sub":"82000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.submissions where id = '87000000-0000-0000-0000-000000000001'), 0, 'Teacher ngoài lớp không SELECT được submission');
select throws_ok(
  $$select public.grade_submission('87000000-0000-0000-0000-000000000001', 50, 'Không có quyền')$$,
  'P0001',
  'Không có quyền chấm bài nộp này',
  'Teacher ngoài lớp bị RPC từ chối'
);

-- Path metadata file phải đúng class/submission.
reset role;
select throws_ok(
  $$insert into public.submission_files (submission_id, object_path, file_name)
    values ('87000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000099/87000000-0000-0000-0000-000000000001/sai.txt', 'sai.txt')$$,
  'P0001',
  'Đường dẫn file bài nộp không đúng lớp hoặc submission',
  'DB chặn submission file path sai class'
);

select is((select count(*)::int from public.audit_logs where action = 'submission.grade' and resource_id = '87000000-0000-0000-0000-000000000001'), 2, 'Mỗi lần chấm hợp lệ có một audit row');

select * from finish();
rollback;
