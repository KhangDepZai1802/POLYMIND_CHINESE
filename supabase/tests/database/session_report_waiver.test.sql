-- =============================================================================
-- "Buổi này không cần báo cáo" (`TEACHER-REPORT-5`, user chốt 2026-08-17)
--
-- Mọi bài dưới đây gọi THẲNG `public.set_session_report_waiver`, tức đi vòng qua
-- toàn bộ giao diện. Nút trên màn hình chỉ hiện cho giáo vụ ở buổi đã điểm danh;
-- nếu đó là chốt chặn duy nhất thì bất kỳ ai gõ được `supabase.rpc(...)` cũng
-- miễn báo cáo cho lớp người khác. Các bài này ghim chuyện đó không xảy ra.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'gv.mien@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'giaovu.mien@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'hv.mien@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'giaovu2.mien@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên miễn', 'gv.mien@polymind.test'),
  ('a0000000-0000-0000-0000-000000000002', 'academic_manager', 'Giáo vụ miễn', 'giaovu.mien@polymind.test'),
  ('a0000000-0000-0000-0000-000000000003', 'student', 'Học viên miễn', 'hv.mien@polymind.test'),
  ('a0000000-0000-0000-0000-000000000004', 'super_admin', 'Quản trị miễn', 'giaovu2.mien@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'GV-MIEN-1');

insert into public.courses (id, code, title, course_type, status)
values ('a2000000-0000-0000-0000-000000000001', 'TEST-MIEN', 'Khóa kiểm tra miễn báo cáo', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  ('a3000000-0000-0000-0000-000000000001', 'TEST-MIEN-01', 'a2000000-0000-0000-0000-000000000001',
   'Lớp miễn báo cáo', 10, 10, 90, date '2026-08-01', 'offline', 'planned');

insert into public.class_teachers (class_id, teacher_id)
values ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

insert into public.students (id, student_code, full_name, user_id)
values ('a4000000-0000-0000-0000-000000000001', 'HV-MIEN-1', 'Học viên miễn', 'a0000000-0000-0000-0000-000000000003');

insert into public.enrollments (id, student_id, class_id, status)
values ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
        'a3000000-0000-0000-0000-000000000001', 'active');

-- Buổi 1 dùng cho phần lớn bài kiểm; buổi 2 dành riêng cho ca "đã gửi báo cáo".
insert into public.class_sessions (id, class_id, session_number, starts_at, ends_at, lesson_log)
values
  ('a6000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1,
   timestamptz '2026-08-04 11:00:00+00', timestamptz '2026-08-04 12:30:00+00', null),
  ('a6000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 2,
   timestamptz '2026-08-06 11:00:00+00', timestamptz '2026-08-06 12:30:00+00', 'Đã dạy');

-- =============================================================================
-- 1. Hàng rào: ai KHÔNG được gọi
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select public.set_session_report_waiver('a6000000-0000-0000-0000-000000000001', true)$$,
  'Chỉ quản trị viên hoặc giáo vụ được đánh dấu buổi không cần báo cáo',
  'GIÁO VIÊN của chính lớp đó cũng không tự miễn báo cáo cho mình'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select public.set_session_report_waiver('a6000000-0000-0000-0000-000000000001', true)$$,
  'Chỉ quản trị viên hoặc giáo vụ được đánh dấu buổi không cần báo cáo',
  'Học viên gọi thẳng RPC bị chặn'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

-- 4 tham số, `null` ở vế thông điệp: chỉ ghim SQLSTATE `42501` chứ không ghim
-- nguyên văn câu lỗi của Postgres. Dạng 3 tham số bị pgTAP hiểu tham số cuối là
-- *thông điệp mong đợi*, nên bài kiểm đỏ vì so câu mô tả với câu lỗi thật.
select throws_ok(
  $$select public.set_session_report_waiver('a6000000-0000-0000-0000-000000000001', true)$$,
  '42501',
  null,
  'anon không có quyền EXECUTE — chặn ở tầng grant, chưa vào tới thân hàm'
);

-- =============================================================================
-- 2. Giáo vụ miễn được, và DẤU VẾT lấy từ auth.uid()
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  public.set_session_report_waiver('a6000000-0000-0000-0000-000000000001', true, 'Buổi giao lưu, không có nội dung bài học'),
  true,
  'Giáo vụ đánh dấu được buổi không cần báo cáo'
);

select is(
  (select report_waived_by from public.class_sessions
   where id = 'a6000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'report_waived_by = auth.uid() của CHÍNH người bấm (BUG_M06_01)'
);

select is(
  (select report_waive_reason from public.class_sessions
   where id = 'a6000000-0000-0000-0000-000000000001'),
  'Buổi giao lưu, không có nội dung bài học',
  'Lý do được lưu nguyên văn'
);

select isnt(
  (select report_waived_at from public.class_sessions
   where id = 'a6000000-0000-0000-0000-000000000001'),
  null,
  'Có mốc thời gian miễn'
);

/*
 * 🔴 ĐỔI SANG SUPER ADMIN ĐỂ ĐỌC AUDIT — không phải để "lách" cho test xanh.
 *
 * `audit_logs` chỉ có một policy đọc: `app.is_super_admin()`. Đứng bằng chính
 * giáo vụ vừa bấm nút thì câu đếm trả **0** dù dòng audit có thật — đó là hàng
 * rào đúng, và bài kiểm đầu tiên viết ra đã đỏ vì chuyện này. Đếm bằng role đọc
 * được là cách duy nhất chứng minh dòng audit tồn tại.
 */
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::integer from public.audit_logs
   where action = 'class_session.report_waived'
     and resource_id = 'a6000000-0000-0000-0000-000000000001'),
  1,
  'Ghi đúng MỘT dòng audit'
);

-- =============================================================================
-- 3. IDEMPOTENCY — bấm lần hai không ghi lại mốc, không thêm audit
-- =============================================================================

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  public.set_session_report_waiver('a6000000-0000-0000-0000-000000000001', true, 'Lý do khác hẳn'),
  false,
  'Bấm lần hai trả false = "không có gì đổi", không phải lỗi'
);

select is(
  (select report_waive_reason from public.class_sessions
   where id = 'a6000000-0000-0000-0000-000000000001'),
  'Buổi giao lưu, không có nội dung bài học',
  'Lần hai KHÔNG ghi đè lý do và mốc thời gian gốc'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::integer from public.audit_logs
   where action = 'class_session.report_waived'
     and resource_id = 'a6000000-0000-0000-0000-000000000001'),
  1,
  'Vẫn đúng MỘT dòng audit sau hai lần bấm (BUG_M09_01)'
);

-- =============================================================================
-- 4. Bỏ đánh dấu — ba cột phải cùng trống trở lại
-- =============================================================================

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  public.set_session_report_waiver('a6000000-0000-0000-0000-000000000001', false),
  true,
  'Giáo vụ bỏ được đánh dấu — không phải ngõ cụt một chiều'
);

select is(
  (select num_nonnulls(report_waived_at, report_waived_by, report_waive_reason)
   from public.class_sessions where id = 'a6000000-0000-0000-0000-000000000001'),
  0,
  'Bỏ đánh dấu thì cả ba cột cùng trống, không để lại lý do mồ côi'
);

-- =============================================================================
-- 5. Báo cáo ĐÃ GỬI thì không miễn được — hai sự thật mâu thuẫn trên một buổi
-- =============================================================================

-- Dựng một báo cáo đã gửi bằng đường thật: giáo viên điểm danh đủ rồi gửi.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.attendance_records (session_id, enrollment_id, status, marked_by)
values ('a6000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000001',
        'present', 'a0000000-0000-0000-0000-000000000001');

select public.save_session_report(
  'a6000000-0000-0000-0000-000000000002',
  jsonb_build_object('mode', 'offline', 'topic', 'Bài 2', 'confirmed', true),
  '[]'::jsonb
);
select public.submit_session_report('a6000000-0000-0000-0000-000000000002');

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select public.set_session_report_waiver('a6000000-0000-0000-0000-000000000002', true)$$,
  'Buổi này đã có báo cáo đã gửi, không đánh dấu "không cần báo cáo" được',
  'Buổi đã có báo cáo đã gửi thì không miễn được'
);

-- =============================================================================
-- 6. Ràng buộc ở DB: không thể có mốc miễn mà không có người đứng tên
-- =============================================================================

reset role;

select throws_ok(
  $$update public.class_sessions
       set report_waived_at = now(), report_waived_by = null
     where id = 'a6000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'UPDATE trực tiếp bỏ trống report_waived_by bị CHECK constraint chặn'
);

select * from finish();
rollback;
