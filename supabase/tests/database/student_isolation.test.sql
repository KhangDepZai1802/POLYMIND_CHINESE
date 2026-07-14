begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

-- =============================================================================
-- GATE PHASE 5: học viên KHÔNG thấy dữ liệu của học viên khác.
-- Kiểm bằng chính JWT của học viên, quét thẳng bảng — không phải "ẩn UI".
-- HV-A và HV-B học CÙNG MỘT LỚP: đây mới là ca khó, vì cùng lớp thì mọi điều kiện
-- theo `class_id` đều đúng cho cả hai.
-- =============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'hv.a@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'hv.b@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'gv.iso@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'student', 'Học viên A', 'hv.a@polymind.test'),
  ('a0000000-0000-0000-0000-000000000002', 'student', 'Học viên B', 'hv.b@polymind.test'),
  ('a0000000-0000-0000-0000-000000000003', 'teacher', 'Giáo viên ISO', 'gv.iso@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'GV-ISO');

insert into public.courses (id, code, title, course_type, status)
values
  ('a2000000-0000-0000-0000-000000000001', 'TEST-ISO', 'Khóa cách ly', 'custom', 'active'),
  ('a2000000-0000-0000-0000-000000000002', 'TEST-ISO-OTHER', 'Khóa lớp khác', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  ('a3000000-0000-0000-0000-000000000001', 'TEST-ISO-01',
   'a2000000-0000-0000-0000-000000000001', 'Lớp chung của A và B',
   10, 10, 90, date '2026-07-20', 'offline', 'planned'),
  ('a3000000-0000-0000-0000-000000000002', 'TEST-ISO-02',
   'a2000000-0000-0000-0000-000000000002', 'Lớp KHÔNG liên quan',
   10, 10, 90, date '2026-07-20', 'offline', 'planned');

insert into public.class_teachers (class_id, teacher_id, assignment_role)
values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'primary'),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 'primary');

insert into public.students (id, student_code, full_name, user_id)
values
  ('a4000000-0000-0000-0000-000000000001', 'HV-ISO-A', 'Học viên A', 'a0000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000002', 'HV-ISO-B', 'Học viên B', 'a0000000-0000-0000-0000-000000000002');

-- A và B CÙNG lớp.
insert into public.enrollments (id, student_id, class_id, status)
values
  ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'active'),
  ('a5000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'active');

insert into public.class_sessions (id, class_id, session_number, starts_at, ends_at)
values (
  'a6000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1,
  timestamptz '2026-07-21 01:00:00+00', timestamptz '2026-07-21 02:30:00+00'
);

-- Điểm danh: A có mặt, B vắng.
insert into public.attendance_records (session_id, enrollment_id, status, marked_by)
values
  ('a6000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'present',
   'a0000000-0000-0000-0000-000000000003'),
  ('a6000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002', 'absent',
   'a0000000-0000-0000-0000-000000000003');

-- Bài tập: 1 đã giao ở lớp chung, 1 còn NHÁP, 1 ở lớp khác.
insert into public.assignments (id, class_id, title, status, published_at, max_score, created_by)
values
  ('a7000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
   'Bài đã giao', 'published', now(), 100, 'a0000000-0000-0000-0000-000000000003'),
  ('a7000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001',
   'Bài còn nháp', 'draft', null, 100, 'a0000000-0000-0000-0000-000000000003'),
  ('a7000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000002',
   'Bài lớp khác', 'published', now(), 100, 'a0000000-0000-0000-0000-000000000003');

-- Trigger integrity (migration 25) ép MỌI INSERT assignment về `draft` → phải giao
-- bài bằng UPDATE riêng, đúng như luật "draft ≠ published" của sản phẩm.
update public.assignments
set status = 'published', published_at = now()
where id in ('a7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000003');

-- B đã nộp bài (seed không JWT nên trigger cho phép nạp dữ liệu lịch sử).
insert into public.submissions (id, assignment_id, enrollment_id, text_answer, submitted_at, status, score)
values (
  'a8000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000002', 'Bài làm bí mật của B', now(), 'graded', 95
);

-- Bài KT đã công bố: B được 95.
insert into public.assessments (id, class_id, type, title, max_score, created_by, published_at)
values ('a9000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
        'midterm', 'KT giữa kỳ', 100, 'a0000000-0000-0000-0000-000000000003', now());

insert into public.assessment_results (assessment_id, enrollment_id, overall_score, published_at)
values ('a9000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002', 95, now());

-- =============================================================================
-- Đăng nhập bằng HỌC VIÊN A
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::integer from public.students),
  1,
  '🔒 A quét bảng students chỉ thấy hồ sơ CỦA CHÍNH MÌNH (không thấy B cùng lớp)'
);

select is(
  (select student_code from public.students),
  'HV-ISO-A',
  'Hồ sơ A đọc được đúng là của A'
);

select is(
  (select count(*)::integer from public.enrollments),
  1,
  '🔒 A chỉ thấy ghi danh của mình, không thấy ghi danh của B cùng lớp'
);

select is(
  (select count(*)::integer from public.submissions),
  0,
  '🔒 A KHÔNG đọc được bài nộp của B — dù cùng lớp, cùng bài tập'
);

select is(
  (select count(*)::integer from public.submissions
   where text_answer = 'Bài làm bí mật của B'),
  0,
  '🔒 Nội dung bài làm của B không lộ cho A'
);

select is(
  (select count(*)::integer from public.assessment_results),
  0,
  '🔒 A KHÔNG đọc được điểm bài kiểm tra của B (dù đã công bố cho B)'
);

select is(
  (select count(*)::integer from public.attendance_records),
  1,
  '🔒 A chỉ thấy điểm danh của mình (1 dòng), không thấy của B'
);

select is(
  (select status::text from public.attendance_records),
  'present',
  'Điểm danh A đọc được đúng là của A'
);

-- Bài tập: thấy bài đã giao của lớp mình, KHÔNG thấy bài nháp, KHÔNG thấy lớp khác.
select is(
  (select count(*)::integer from public.assignments),
  1,
  '🔒 A chỉ thấy bài ĐÃ GIAO của lớp mình (không thấy bài nháp, không thấy lớp khác)'
);

select is(
  (select title from public.assignments),
  'Bài đã giao',
  'Bài tập A đọc được đúng là bài đã giao của lớp mình'
);

-- =============================================================================
-- A cố tình ghi đè lên dữ liệu của B / tự nâng điểm
-- =============================================================================

-- Nộp bài dưới danh nghĩa enrollment của B.
select throws_ok(
  $$insert into public.submissions (assignment_id, enrollment_id, text_answer)
    values ('a7000000-0000-0000-0000-000000000001',
            'a5000000-0000-0000-0000-000000000002', 'A giả danh B')$$,
  '42501',
  null,
  '🔒 A KHÔNG nộp bài được dưới danh nghĩa ghi danh của B'
);

-- Nộp bài vào assignment còn nháp. Trigger integrity chạy TRƯỚC RLS nên chặn ở đây
-- bằng P0001; dù đi tới RLS thì policy cũng đòi `status = 'published'`.
select throws_ok(
  $$insert into public.submissions (assignment_id, enrollment_id, text_answer)
    values ('a7000000-0000-0000-0000-000000000002',
            'a5000000-0000-0000-0000-000000000001', 'Nộp vào bài nháp')$$,
  'P0001',
  'Bài tập chưa mở nhận bài nộp',
  '🔒 A không nộp được bài vào assignment CHƯA GIAO'
);

-- A nộp bài hợp lệ của chính mình.
insert into public.submissions (assignment_id, enrollment_id, text_answer, score, status)
values (
  'a7000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001',
  'Bài làm của A', 100, 'graded'
);

select is(
  (select score from public.submissions
   where enrollment_id = 'a5000000-0000-0000-0000-000000000001'),
  null::numeric,
  '🔒 A tự khai score=100 lúc nộp → DB xóa sạch, điểm là NULL'
);

select is(
  (select status::text from public.submissions
   where enrollment_id = 'a5000000-0000-0000-0000-000000000001'),
  'submitted',
  'Trạng thái bài nộp do DB đặt (submitted), không phải do client khai'
);

-- A tự chấm điểm cho mình bằng UPDATE trực tiếp.
select throws_ok(
  $$update public.submissions set score = 100
    where enrollment_id = 'a5000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  '🔒 A KHÔNG tự sửa điểm bài nộp của mình (column grant chỉ cho text_answer)'
);

-- A tự nâng quyền.
select throws_ok(
  $$update public.profiles set role = 'super_admin'
    where id = 'a0000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không được tự đổi vai trò tài khoản',
  '🔒 A KHÔNG tự nâng vai trò lên super_admin'
);

reset role;

select * from finish();
rollback;
