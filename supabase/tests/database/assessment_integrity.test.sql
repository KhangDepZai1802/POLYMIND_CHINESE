begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- --- Dữ liệu nền -------------------------------------------------------------

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
    '80000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'teacher.assessment@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '80000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'teacher.outside-assessment@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '80000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'student.assessment@polymind.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

insert into public.profiles (id, role, full_name, email)
values
  ('80000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên chấm KT', 'teacher.assessment@polymind.test'),
  ('80000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên ngoài lớp', 'teacher.outside-assessment@polymind.test'),
  ('80000000-0000-0000-0000-000000000003', 'student', 'Học viên có điểm', 'student.assessment@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'GV-KT-1'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'GV-KT-2');

insert into public.courses (id, code, title, course_type, status)
values
  ('82000000-0000-0000-0000-000000000001', 'TEST-ASSESSMENT', 'Khóa kiểm tra điểm', 'custom', 'active'),
  ('82000000-0000-0000-0000-000000000002', 'TEST-ASSESSMENT-OTHER', 'Khóa khác', 'custom', 'active');

insert into public.course_modules (id, course_id, title, order_index)
values
  ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'Chương kiểm tra', 1),
  ('83000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 'Chương khóa khác', 1);

insert into public.lessons (id, module_id, title, order_index)
values
  ('84000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Bài thuộc khóa của lớp', 1),
  ('84000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000002', 'Bài khóa khác', 1);

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  (
    '85000000-0000-0000-0000-000000000001', 'TEST-KT-01',
    '82000000-0000-0000-0000-000000000001', 'Lớp có bài kiểm tra',
    10, 10, 90, date '2026-07-20', 'offline', 'planned'
  ),
  (
    '85000000-0000-0000-0000-000000000002', 'TEST-KT-02',
    '82000000-0000-0000-0000-000000000001', 'Lớp của giáo viên khác',
    10, 10, 90, date '2026-07-20', 'offline', 'planned'
  );

insert into public.class_teachers (class_id, teacher_id, assignment_role)
values
  ('85000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'primary'),
  ('85000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'primary');

insert into public.students (id, student_code, full_name, user_id)
values
  ('86000000-0000-0000-0000-000000000001', 'HV-KT-1', 'Học viên có điểm', '80000000-0000-0000-0000-000000000003'),
  ('86000000-0000-0000-0000-000000000002', 'HV-KT-2', 'Học viên đã rút', null),
  ('86000000-0000-0000-0000-000000000003', 'HV-KT-3', 'Học viên lớp khác', null);

insert into public.enrollments (id, student_id, class_id, status)
values
  ('87000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'active'),
  ('87000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000001', 'withdrawn'),
  ('87000000-0000-0000-0000-000000000003', '86000000-0000-0000-0000-000000000003', '85000000-0000-0000-0000-000000000002', 'active');

-- --- Giáo viên của lớp: tạo bài KT ------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Client khai sẵn created_by của người khác và published_at đã công bố.
insert into public.assessments (
  id, class_id, lesson_id, type, title, assessment_date, max_score,
  created_by, published_at
)
values (
  '88000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  '84000000-0000-0000-0000-000000000001',
  'midterm', 'Kiểm tra giữa kỳ', date '2026-07-25', 100,
  '80000000-0000-0000-0000-000000000002',
  now()
);

select is(
  (select created_by from public.assessments where id = '88000000-0000-0000-0000-000000000001'),
  '80000000-0000-0000-0000-000000000001'::uuid,
  'created_by bị ép về actor thật (auth.uid()), không phải giá trị client khai'
);

select ok(
  (select published_at is null from public.assessments where id = '88000000-0000-0000-0000-000000000001'),
  'Bài KT luôn sinh ra ở trạng thái nháp dù client gửi published_at'
);

-- Công bố phải là hành động riêng: cột published_at không nằm trong GRANT UPDATE.
select throws_ok(
  $$update public.assessments set published_at = now()
    where id = '88000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'Không thể công bố bài KT bằng UPDATE trực tiếp (đi vòng qua RPC)'
);

select throws_ok(
  $$insert into public.assessments (class_id, lesson_id, type, title, max_score, created_by)
    values ('85000000-0000-0000-0000-000000000001',
            '84000000-0000-0000-0000-000000000002',
            'quiz', 'Bài KT gắn sai khóa', 100,
            '80000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Bài học không thuộc khóa học của lớp này',
  'Không gắn được lesson của khóa khác vào bài KT'
);

select throws_ok(
  $$insert into public.assessments (class_id, type, title, max_score, created_by)
    values ('85000000-0000-0000-0000-000000000002', 'quiz', 'Bài KT lớp không dạy', 100,
            '80000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'Giáo viên không tạo được bài KT cho lớp mình không dạy (RLS)'
);

-- --- Nhập điểm ---------------------------------------------------------------

-- Đóng hẳn đường ghi trực tiếp: mọi lần nhập điểm phải qua RPC.
select throws_ok(
  $$insert into public.assessment_results (assessment_id, enrollment_id, overall_score)
    values ('88000000-0000-0000-0000-000000000001',
            '87000000-0000-0000-0000-000000000001', 100)$$,
  '42501',
  null,
  'Không INSERT trực tiếp được assessment_results (một hành động = một đường ghi)'
);

select ok(
  public.save_assessment_result(
    '88000000-0000-0000-0000-000000000001',
    '87000000-0000-0000-0000-000000000001',
    85, 90, 80, 88, 82, 86, 84,
    'Nghe tốt, cần luyện nói.'
  ) ->> 'id' is not null,
  'RPC nhập điểm tổng + 6 kỹ năng thành công'
);

select is(
  (select overall_score from public.assessment_results
   where assessment_id = '88000000-0000-0000-0000-000000000001'
     and enrollment_id = '87000000-0000-0000-0000-000000000001'),
  85.00::numeric,
  'Điểm tổng được lưu đúng'
);

select is(
  (select listening_score from public.assessment_results
   where assessment_id = '88000000-0000-0000-0000-000000000001'
     and enrollment_id = '87000000-0000-0000-0000-000000000001'),
  90.00::numeric,
  'Điểm kỹ năng nghe được lưu đúng'
);

select is(
  (select graded_by from public.assessment_results
   where assessment_id = '88000000-0000-0000-0000-000000000001'
     and enrollment_id = '87000000-0000-0000-0000-000000000001'),
  '80000000-0000-0000-0000-000000000001'::uuid,
  'graded_by là actor thật từ auth.uid()'
);

select is(
  (select classification from public.assessment_results
   where assessment_id = '88000000-0000-0000-0000-000000000001'
     and enrollment_id = '87000000-0000-0000-0000-000000000001'),
  'Giỏi',
  'Xếp loại do DB tính từ thang điểm, không do client gửi'
);

-- Bấm Lưu hai lần: upsert theo (assessment, enrollment), không sinh dòng trùng.
select ok(
  public.save_assessment_result(
    '88000000-0000-0000-0000-000000000001',
    '87000000-0000-0000-0000-000000000001',
    85, 90, 80, 88, 82, 86, 84,
    'Nghe tốt, cần luyện nói.'
  ) ->> 'id' is not null,
  'Gửi lại đúng payload vẫn thành công'
);

select is(
  (select count(*)::integer from public.assessment_results
   where assessment_id = '88000000-0000-0000-0000-000000000001'),
  1,
  'Lưu hai lần không sinh hai dòng điểm'
);

select throws_ok(
  $$select public.save_assessment_result(
      '88000000-0000-0000-0000-000000000001',
      '87000000-0000-0000-0000-000000000001',
      101)$$,
  'P0001',
  'Điểm phải từ 0 đến 100.00',
  'Điểm vượt thang max_score bị từ chối'
);

select throws_ok(
  $$select public.save_assessment_result(
      '88000000-0000-0000-0000-000000000001',
      '87000000-0000-0000-0000-000000000002',
      70)$$,
  'P0001',
  'Học viên không còn thuộc lớp này',
  'Không chấm điểm cho học viên đã rút khỏi lớp'
);

select throws_ok(
  $$select public.save_assessment_result(
      '88000000-0000-0000-0000-000000000001',
      '87000000-0000-0000-0000-000000000003',
      70)$$,
  'P0001',
  'Kết quả không khớp lớp của bài kiểm tra và ghi danh',
  'Không gắn được kết quả của ghi danh thuộc lớp khác'
);

-- --- IDOR: giáo viên ngoài lớp ----------------------------------------------

set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::integer from public.assessments
   where id = '88000000-0000-0000-0000-000000000001'),
  0,
  'Giáo viên lớp khác không đọc được bài KT (RLS)'
);

select throws_ok(
  $$select public.save_assessment_result(
      '88000000-0000-0000-0000-000000000001',
      '87000000-0000-0000-0000-000000000001',
      100)$$,
  'P0001',
  'Không có quyền nhập điểm cho bài kiểm tra này',
  'Giáo viên lớp khác gọi thẳng RPC nhập điểm vẫn bị chặn'
);

select throws_ok(
  $$select public.publish_assessment_results('88000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Không có quyền công bố kết quả bài kiểm tra này',
  'Giáo viên lớp khác không công bố được kết quả'
);

-- --- Công bố -----------------------------------------------------------------

set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.assessments (id, class_id, type, title, max_score, created_by)
values (
  '88000000-0000-0000-0000-000000000002',
  '85000000-0000-0000-0000-000000000001',
  'quiz', 'Bài KT chưa chấm', 100,
  '80000000-0000-0000-0000-000000000001'
);

select throws_ok(
  $$select public.publish_assessment_results('88000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'Chưa có điểm nào để công bố',
  'Không công bố được bài KT chưa có điểm nào'
);

select is(
  public.publish_assessment_results('88000000-0000-0000-0000-000000000001'),
  1,
  'Công bố đúng một kết quả đã chấm'
);

select ok(
  (select published_at is not null from public.assessments
   where id = '88000000-0000-0000-0000-000000000001'),
  'Bài KT chuyển sang trạng thái đã công bố'
);

-- Đếm notification bằng role postgres: RLS của notifications chỉ cho user đọc
-- thông báo của chính mình, nên đếm bằng JWT giáo viên sẽ luôn ra 0 và assertion
-- trở nên vô nghĩa. Ở đây cần sự thật trong DB, không phải góc nhìn của teacher.
set local role postgres;

select is(
  (select count(*)::integer from public.notifications
   where user_id = '80000000-0000-0000-0000-000000000003'
     and resource_id = '88000000-0000-0000-0000-000000000001'),
  1,
  'Học viên nhận đúng một thông báo kết quả'
);

set local role authenticated;

-- Công bố lại (sau khi chấm bù) không gửi thông báo trùng.
select is(
  public.publish_assessment_results('88000000-0000-0000-0000-000000000001'),
  0,
  'Công bố lần hai không công bố lại kết quả cũ'
);

set local role postgres;

select is(
  (select count(*)::integer from public.notifications
   where user_id = '80000000-0000-0000-0000-000000000003'
     and resource_id = '88000000-0000-0000-0000-000000000001'),
  1,
  'Công bố lại không sinh thông báo trùng'
);

set local role authenticated;

-- Sửa điểm sau khi công bố: cập nhật điểm nhưng KHÔNG âm thầm thu hồi kết quả.
select ok(
  public.save_assessment_result(
    '88000000-0000-0000-0000-000000000001',
    '87000000-0000-0000-0000-000000000001',
    92
  ) ->> 'published_at' is not null,
  'Sửa điểm sau công bố giữ nguyên trạng thái đã công bố'
);

select throws_ok(
  $$delete from public.assessments where id = '88000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Bài kiểm tra đã công bố kết quả nên không thể xóa',
  'Không hard delete được bài KT đã công bố'
);

-- --- Học viên ----------------------------------------------------------------

set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select overall_score from public.assessment_results
   where assessment_id = '88000000-0000-0000-0000-000000000001'),
  92.00::numeric,
  'Học viên đọc được kết quả đã công bố của chính mình'
);

reset role;

select * from finish();
rollback;
