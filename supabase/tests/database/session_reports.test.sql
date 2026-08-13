-- =============================================================================
-- Báo cáo sau buổi dạy (`TEACHER-REPORT-1`, `D-43`)
--
-- Bài kiểm ở đây canh đúng những vế mà `D-43` nói là KHÔNG được nới. Mỗi bài
-- đều gọi thẳng RPC / SQL, tức là đi vòng qua toàn bộ giao diện — nếu chốt chặn
-- chỉ nằm ở React thì các bài dưới đây đỏ.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'gv.baocao@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'gv.lopkhac@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'hv.baocao@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'giaovu.baocao@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('90000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên báo cáo', 'gv.baocao@polymind.test'),
  ('90000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên lớp khác', 'gv.lopkhac@polymind.test'),
  ('90000000-0000-0000-0000-000000000003', 'student', 'Học viên tò mò', 'hv.baocao@polymind.test'),
  ('90000000-0000-0000-0000-000000000004', 'academic_manager', 'Giáo vụ', 'giaovu.baocao@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'GV-BC-1'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'GV-BC-2');

insert into public.courses (id, code, title, course_type, status)
values ('92000000-0000-0000-0000-000000000001', 'TEST-BAOCAO', 'Khóa kiểm tra báo cáo', 'custom', 'active');

insert into public.course_modules (id, course_id, title, order_index)
values ('93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'Chương 1', 1);

insert into public.lessons (id, module_id, title, order_index)
values ('94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', 'Bài 1', 1);

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  -- `planned` chứ không `active`: DB đòi lớp phải có giáo viên phụ trách trước
  -- khi kích hoạt, mà `class_teachers` chỉ được chèn ở câu ngay bên dưới.
  ('95000000-0000-0000-0000-000000000001', 'TEST-BC-01', '92000000-0000-0000-0000-000000000001',
   'Lớp báo cáo', 10, 10, 90, date '2026-08-01', 'offline', 'planned'),
  ('95000000-0000-0000-0000-000000000002', 'TEST-BC-02', '92000000-0000-0000-0000-000000000001',
   'Lớp của giáo viên khác', 10, 10, 90, date '2026-08-01', 'offline', 'planned');

insert into public.class_teachers (class_id, teacher_id)
values
  ('95000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001'),
  ('95000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002');

insert into public.students (id, student_code, full_name, user_id)
values
  ('96000000-0000-0000-0000-000000000001', 'HV-BC-1', 'Học viên A', '90000000-0000-0000-0000-000000000003'),
  ('96000000-0000-0000-0000-000000000002', 'HV-BC-2', 'Học viên B', null);

insert into public.enrollments (id, student_id, class_id, status)
values
  ('97000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001',
   '95000000-0000-0000-0000-000000000001', 'active'),
  ('97000000-0000-0000-0000-000000000002', '96000000-0000-0000-0000-000000000002',
   '95000000-0000-0000-0000-000000000001', 'active');

insert into public.class_sessions (id, class_id, session_number, starts_at, ends_at, lesson_id, lesson_log)
values
  ('98000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', 1,
   timestamptz '2026-08-04 11:00:00+00', timestamptz '2026-08-04 12:30:00+00',
   '94000000-0000-0000-0000-000000000001', 'Nội dung thực dạy'),
  ('98000000-0000-0000-0000-000000000002', '95000000-0000-0000-0000-000000000002', 1,
   timestamptz '2026-08-04 11:00:00+00', timestamptz '2026-08-04 12:30:00+00', null, null);

-- =============================================================================
-- 1. Giáo viên đúng lớp lưu được nháp
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';

select isnt(
  public.save_session_report(
    '98000000-0000-0000-0000-000000000001',
    jsonb_build_object('mode', 'offline', 'topic', 'Bài 1 — Chào hỏi', 'comprehension_level', 4),
    '[]'::jsonb
  ),
  null,
  'Giáo viên của lớp lưu được bản nháp báo cáo'
);

select is(
  (select status::text from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  'draft',
  'Bản mới luôn ở trạng thái nháp'
);

select is(
  (select class_id from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  '95000000-0000-0000-0000-000000000001'::uuid,
  'class_id được suy từ buổi học, không nhận từ client'
);

select is(
  (select attendance_snapshot from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  null,
  'Còn nháp thì CHƯA chụp chuyên cần — giao diện đọc trực tiếp từ điểm danh'
);

-- Lưu lại lần hai: vẫn đúng MỘT hàng (unique index ở DB, không phải kiểm ở app).
select public.save_session_report(
  '98000000-0000-0000-0000-000000000001',
  jsonb_build_object('mode', 'offline', 'topic', 'Sửa lại tiêu đề'),
  '[]'::jsonb
);

select is(
  (select count(*)::integer from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  1,
  'Lưu nhiều lần chỉ sinh một báo cáo cho một buổi'
);

select is(
  (select topic from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  'Sửa lại tiêu đề',
  'Lưu lần sau ghi đè nội dung lần trước'
);

-- =============================================================================
-- 2. CỔNG ĐIỂM DANH — vế sống còn của cả module
-- =============================================================================

-- Chưa điểm danh ai: phải bị chặn dù đã tick xác nhận.
select public.save_session_report(
  '98000000-0000-0000-0000-000000000001',
  jsonb_build_object('mode', 'offline', 'topic', 'Bài 1', 'confirmed', true),
  '[]'::jsonb
);

select is(
  app.session_attendance_complete('98000000-0000-0000-0000-000000000001'),
  false,
  'Chưa điểm danh ai ⇒ chuyên cần CHƯA đủ'
);

select throws_ok(
  $$select public.submit_session_report('98000000-0000-0000-0000-000000000001')$$,
  'Cần điểm danh đủ học viên trước khi gửi báo cáo',
  'Gọi thẳng RPC khi chưa điểm danh vẫn bị chặn (không đi qua giao diện)'
);

-- Điểm danh MỘT trong hai học viên: vẫn chưa đủ.
insert into public.attendance_records (session_id, enrollment_id, status, marked_by)
values ('98000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001',
        'present', '90000000-0000-0000-0000-000000000001');

select is(
  app.session_attendance_complete('98000000-0000-0000-0000-000000000001'),
  false,
  'Điểm danh 1/2 vẫn CHƯA đủ — không được làm tròn lên'
);

select throws_ok(
  $$select public.submit_session_report('98000000-0000-0000-0000-000000000001')$$,
  'Cần điểm danh đủ học viên trước khi gửi báo cáo',
  'Điểm danh thiếu một người vẫn chặn gửi'
);

-- Điểm danh nốt người thứ hai.
insert into public.attendance_records (session_id, enrollment_id, status, note, marked_by)
values ('98000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000002',
        'absent', 'Báo ốm', '90000000-0000-0000-0000-000000000001');

select is(
  app.session_attendance_complete('98000000-0000-0000-0000-000000000001'),
  true,
  'Điểm danh đủ 2/2 ⇒ chuyên cần đủ'
);

-- =============================================================================
-- 3. Ô xác nhận cũng là điều kiện chặn
-- =============================================================================

select public.save_session_report(
  '98000000-0000-0000-0000-000000000001',
  jsonb_build_object('mode', 'offline', 'topic', 'Bài 1', 'confirmed', false),
  '[]'::jsonb
);

select throws_ok(
  $$select public.submit_session_report('98000000-0000-0000-0000-000000000001')$$,
  'Cần tích ô xác nhận trước khi gửi báo cáo',
  'Chưa tick xác nhận thì không gửi được'
);

-- =============================================================================
-- 4. Gửi thành công — và ẢNH CHỤP mục 2
-- =============================================================================

select public.save_session_report(
  '98000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'mode', 'offline', 'topic', 'Bài 1 — Chào hỏi', 'confirmed', true,
    'comprehension_level', 4, 'interaction_level', 5, 'focus_level', 3,
    'overall_rating', 'good'
  ),
  jsonb_build_array(
    jsonb_build_object('category', 'needs_support',
                       'enrollment_id', '97000000-0000-0000-0000-000000000002',
                       'note', 'Cần ôn thêm phần chào hỏi')
  )
);

select isnt(
  public.submit_session_report('98000000-0000-0000-0000-000000000001'),
  null,
  'Điểm danh đủ + đã xác nhận ⇒ gửi được'
);

select is(
  (select status::text from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  'submitted',
  'Trạng thái chuyển sang submitted'
);

select is(
  (select submitted_by from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  '90000000-0000-0000-0000-000000000001'::uuid,
  'submitted_by là actor THẬT lấy từ auth.uid() (BUG_M06_01)'
);

select is(
  (select (attendance_snapshot ->> 'roster_size')::int
   from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  2,
  'Ảnh chụp chuyên cần ghi đúng sĩ số lúc gửi'
);

select is(
  (select (attendance_snapshot ->> 'absent')::int
   from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  1,
  'Ảnh chụp ghi đúng số vắng'
);

-- Gửi báo cáo = hoàn tất buổi (D-43 điểm 1), đi qua đúng save_session_log().
select is(
  (select status::text from public.class_sessions where id = '98000000-0000-0000-0000-000000000001'),
  'completed',
  'Gửi báo cáo cũng hoàn tất buổi học — một hành động, một đường ghi'
);

-- 🔴 Bài quan trọng nhất của vế (c): sửa điểm danh SAU khi gửi.
update public.attendance_records
set status = 'present'
where session_id = '98000000-0000-0000-0000-000000000001'
  and enrollment_id = '97000000-0000-0000-0000-000000000002';

select is(
  (select (attendance_snapshot ->> 'absent')::int
   from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  1,
  'Sửa điểm danh sau khi gửi KHÔNG làm đổi báo cáo đã ký'
);

-- Gửi lại lần nữa: trả id cũ, không ném lỗi, và KHÔNG ghi đè `submitted_at`.
-- Ghim mốc thời gian vào biến phiên trước khi gửi lại — so một giá trị với
-- chính nó thì bài kiểm luôn xanh và chẳng chứng minh được gì.
select set_config(
  'polymind.submitted_at_before',
  (select submitted_at::text from public.session_reports
   where session_id = '98000000-0000-0000-0000-000000000001'),
  true
);

select is(
  public.submit_session_report('98000000-0000-0000-0000-000000000001'),
  (select id from public.session_reports where session_id = '98000000-0000-0000-0000-000000000001'),
  'Gửi lại báo cáo đã gửi trả về đúng id cũ, không ném lỗi (idempotent)'
);

select is(
  (select submitted_at::text from public.session_reports
   where session_id = '98000000-0000-0000-0000-000000000001'),
  current_setting('polymind.submitted_at_before'),
  'Gửi lại KHÔNG ghi đè submitted_at — thời điểm ký giữ nguyên'
);

select throws_ok(
  $$select public.save_session_report(
      '98000000-0000-0000-0000-000000000001',
      jsonb_build_object('topic', 'Sửa sau khi đã gửi'),
      '[]'::jsonb
    )$$,
  'Báo cáo đã gửi, không sửa được nữa',
  'Báo cáo đã gửi bị khoá, không sửa được'
);

-- =============================================================================
-- 5. RLS chéo lớp
-- =============================================================================

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::integer from public.session_reports
   where session_id = '98000000-0000-0000-0000-000000000001'),
  0,
  'Giáo viên lớp khác KHÔNG đọc được báo cáo của lớp không phải mình'
);

select throws_ok(
  $$select public.save_session_report(
      '98000000-0000-0000-0000-000000000001',
      '{}'::jsonb, '[]'::jsonb
    )$$,
  'Không có quyền báo cáo buổi học này',
  'Giáo viên lớp khác không ghi được báo cáo lớp không phải mình'
);

-- =============================================================================
-- 6. Học viên không thấy gì
-- =============================================================================

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*)::integer from public.session_reports),
  0,
  'Học viên đọc bảng báo cáo trả 0 hàng — báo cáo có nhận xét nội bộ về chính họ'
);

select is(
  (select count(*)::integer from public.session_report_students),
  0,
  'Học viên không đọc được danh sách học viên được nhắc tên'
);

-- =============================================================================
-- 7. Giáo vụ đọc được tất cả (nhưng không sửa)
-- =============================================================================

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::integer from public.session_reports
   where session_id = '98000000-0000-0000-0000-000000000001'),
  1,
  'Giáo vụ đọc được báo cáo của mọi lớp'
);

reset role;

select * from finish();
rollback;
