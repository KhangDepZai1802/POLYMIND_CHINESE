-- =============================================================================
-- Admin sửa lại điểm danh giáo viên đã chốt (`ADMIN-ATTENDANCE-1`, user chốt
-- 2026-08-19 → `D-45`)
--
-- Mọi bài dưới đây gọi THẲNG `public.admin_override_attendance`, tức đi vòng
-- qua toàn bộ giao diện. Nút sửa trên lưới chỉ hiện cho super_admin; nếu đó là
-- chốt chặn duy nhất thì bất kỳ ai gõ được `supabase.rpc(...)` cũng sửa được
-- điểm danh của lớp người khác — và sửa điểm danh nay còn kéo theo việc dựng
-- lại bản chụp của một báo cáo ĐÃ KÝ.
--
-- 🔴 Bài quan trọng nhất của file này là bài số 2: GIÁO VỤ BỊ CHẶN, kể cả giáo
--    vụ đang được phân công dạy đúng lớp đó. Fixture cố tình gán giáo vụ vào
--    `class_teachers` của lớp 1 để `app.teaches_class()` trả true — nếu cổng
--    lỡ viết thành `is_manager() or teaches_class()` thì bài đó đỏ ngay.
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
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'gv.diem@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'giaovu.diem@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'hv.diem@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'admin.diem@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('b0000000-0000-0000-0000-000000000001', 'teacher', 'Giáo viên điểm danh', 'gv.diem@polymind.test'),
  ('b0000000-0000-0000-0000-000000000002', 'academic_manager', 'Giáo vụ điểm danh', 'giaovu.diem@polymind.test'),
  ('b0000000-0000-0000-0000-000000000003', 'student', 'Học viên điểm danh', 'hv.diem@polymind.test'),
  ('b0000000-0000-0000-0000-000000000004', 'super_admin', 'Quản trị điểm danh', 'admin.diem@polymind.test');

insert into public.teachers (id, user_id, teacher_code)
values
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'GV-DIEM-1'),
  -- Giáo vụ CÓ hồ sơ giáo viên và ĐƯỢC phân công dạy lớp 1 (xem khối chú thích
  -- đầu file) — đây là điều kiện làm cho bài kiểm cổng quyền có giá trị.
  ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'GV-DIEM-2');

insert into public.courses (id, code, title, course_type, status)
values ('b2000000-0000-0000-0000-000000000001', 'TEST-DIEM', 'Khóa kiểm tra sửa điểm danh', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values
  ('b3000000-0000-0000-0000-000000000001', 'TEST-DIEM-01', 'b2000000-0000-0000-0000-000000000001',
   'Lớp sửa điểm danh 1', 10, 10, 90, date '2026-08-01', 'offline', 'planned'),
  -- Lớp 2 tồn tại CHỈ để chứng minh không ghi chéo được ghi danh giữa hai lớp.
  ('b3000000-0000-0000-0000-000000000002', 'TEST-DIEM-02', 'b2000000-0000-0000-0000-000000000001',
   'Lớp sửa điểm danh 2', 10, 10, 90, date '2026-08-01', 'offline', 'planned');

insert into public.class_teachers (class_id, teacher_id)
values
  ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'),
  ('b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002');

insert into public.students (id, student_code, full_name, user_id)
values
  ('b4000000-0000-0000-0000-000000000001', 'HV-DIEM-1', 'An Học Viên', 'b0000000-0000-0000-0000-000000000003'),
  ('b4000000-0000-0000-0000-000000000002', 'HV-DIEM-2', 'Bình Học Viên', null),
  ('b4000000-0000-0000-0000-000000000003', 'HV-DIEM-3', 'Cường Lớp Khác', null);

insert into public.enrollments (id, student_id, class_id, status)
values
  ('b5000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001',
   'b3000000-0000-0000-0000-000000000001', 'active'),
  ('b5000000-0000-0000-0000-000000000002', 'b4000000-0000-0000-0000-000000000002',
   'b3000000-0000-0000-0000-000000000001', 'active'),
  ('b5000000-0000-0000-0000-000000000003', 'b4000000-0000-0000-0000-000000000003',
   'b3000000-0000-0000-0000-000000000002', 'active');

insert into public.class_sessions (id, class_id, session_number, starts_at, ends_at, lesson_log)
values
  -- Buổi 1: chưa có báo cáo — đường sửa "trơn".
  ('b6000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 1,
   timestamptz '2026-08-04 11:00:00+00', timestamptz '2026-08-04 12:30:00+00', null),
  -- Buổi 2: đã có báo cáo ĐÃ GỬI — đường dựng lại bản chụp.
  ('b6000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000001', 2,
   timestamptz '2026-08-06 11:00:00+00', timestamptz '2026-08-06 12:30:00+00', 'Đã dạy'),
  -- Buổi 3: có báo cáo còn NHÁP — bản chụp phải giữ nguyên null.
  ('b6000000-0000-0000-0000-000000000003', 'b3000000-0000-0000-0000-000000000001', 3,
   timestamptz '2026-08-08 11:00:00+00', timestamptz '2026-08-08 12:30:00+00', null);

-- Điểm danh GỐC do giáo viên ghi. `marked_by` là giáo viên — đây chính là thứ
-- sẽ bị ghi đè, và là lý do phải có audit before/after.
insert into public.attendance_records (session_id, enrollment_id, status, note, marked_by)
values
  ('b6000000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001',
   'absent', 'Không thấy tới', 'b0000000-0000-0000-0000-000000000001'),
  ('b6000000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000002',
   'present', null, 'b0000000-0000-0000-0000-000000000001'),
  ('b6000000-0000-0000-0000-000000000002', 'b5000000-0000-0000-0000-000000000001',
   'absent', null, 'b0000000-0000-0000-0000-000000000001'),
  ('b6000000-0000-0000-0000-000000000002', 'b5000000-0000-0000-0000-000000000002',
   'present', null, 'b0000000-0000-0000-0000-000000000001');

-- Báo cáo của buổi 2: ĐÃ GỬI, mang bản chụp "1 vắng / 1 có mặt" đúng như lúc ký.
insert into public.session_reports (
  id, session_id, class_id, status, confirmed, created_by, submitted_by, submitted_at,
  attendance_snapshot
)
values (
  'b7000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000002',
  'b3000000-0000-0000-0000-000000000001', 'submitted', true,
  'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
  timestamptz '2026-08-06 13:00:00+00',
  jsonb_build_object(
    'captured_at', timestamptz '2026-08-06 13:00:00+00',
    'roster_size', 2, 'present', 1, 'late', 0, 'absent', 1, 'excused', 0,
    'students', '[]'::jsonb
  )
);

-- Báo cáo của buổi 3: còn NHÁP, chưa có bản chụp.
insert into public.session_reports (
  id, session_id, class_id, status, confirmed, created_by
)
values (
  'b7000000-0000-0000-0000-000000000002', 'b6000000-0000-0000-0000-000000000003',
  'b3000000-0000-0000-0000-000000000001', 'draft', false,
  'b0000000-0000-0000-0000-000000000001'
);

-- =============================================================================
-- 1. Hàng rào: ai KHÔNG được gọi
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select public.admin_override_attendance(
      '[{"session_id":"b6000000-0000-0000-0000-000000000001",
         "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"present"}]}]'::jsonb)$$,
  'Chỉ quản trị viên mới sửa được điểm danh đã chốt',
  'GIÁO VIÊN của chính lớp đó không sửa được qua đường admin'
);

-- 🔴 BÀI QUAN TRỌNG NHẤT: giáo vụ này ĐANG DẠY lớp 2 và là `app.is_manager()`.
-- Cổng của `bulk_mark_attendance` sẽ cho qua; cổng của hàm này thì không.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select public.admin_override_attendance(
      '[{"session_id":"b6000000-0000-0000-0000-000000000001",
         "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"present"}]}]'::jsonb)$$,
  'Chỉ quản trị viên mới sửa được điểm danh đã chốt',
  'GIÁO VỤ bị chặn — D-45 vế 4, dù is_manager() và teaches_class() đều true'
);

set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select public.admin_override_attendance(
      '[{"session_id":"b6000000-0000-0000-0000-000000000001",
         "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"present"}]}]'::jsonb)$$,
  'Chỉ quản trị viên mới sửa được điểm danh đã chốt',
  'Học viên gọi thẳng RPC bị chặn'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

-- 4 tham số, `null` ở vế thông điệp: chỉ ghim SQLSTATE `42501` chứ không ghim
-- nguyên văn câu lỗi của Postgres.
select throws_ok(
  $$select public.admin_override_attendance(
      '[{"session_id":"b6000000-0000-0000-0000-000000000001",
         "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"present"}]}]'::jsonb)$$,
  '42501',
  null,
  'anon không có quyền EXECUTE — chặn ở tầng grant, chưa vào tới thân hàm'
);

-- Giáo viên vẫn phải điểm danh được lớp mình qua đường CŨ. Vế này ghim rằng
-- việc siết cổng cho admin KHÔNG vô tình siết luôn đường của giáo viên.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  public.bulk_mark_attendance(
    'b6000000-0000-0000-0000-000000000001',
    '[{"enrollment_id":"b5000000-0000-0000-0000-000000000002","status":"present"}]'::jsonb
  ),
  1,
  'Giáo viên vẫn điểm danh được lớp mình qua bulk_mark_attendance (cổng cũ không đổi)'
);

-- =============================================================================
-- 2. Toàn vẹn: không ghi chéo ghi danh của lớp khác vào buổi này
--
-- 🔴 HÀNG RÀO Ở ĐÂY LÀ TRIGGER `trg_attendance_class_match` (migration `…005`),
--    KHÔNG phải một phép kiểm trong RPC.
--
--    Bản đầu của migration 95 có thêm một phép kiểm riêng trong
--    `app.upsert_attendance_records()` vì tưởng chỗ này còn hở. Kiểm ngược đã
--    bác: gỡ phép kiểm đó ra thì bài kiểm vẫn xanh, chỉ đổi câu lỗi — nghĩa là
--    nó thừa. Đã gỡ. Bài kiểm nay ghim đúng câu lỗi của trigger, tức ghim đúng
--    thứ đang thực sự bảo vệ dữ liệu.
-- =============================================================================

set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select throws_ok(
  $$select public.admin_override_attendance(
      '[{"session_id":"b6000000-0000-0000-0000-000000000001",
         "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000003","status":"present"}]}]'::jsonb)$$,
  'Học viên không thuộc lớp của buổi học này',
  'Ghi danh của LỚP KHÁC bị chặn, không lọt vào buổi này'
);

select is(
  (select count(*)::integer from public.attendance_records
   where enrollment_id = 'b5000000-0000-0000-0000-000000000003'),
  0,
  'Và không có hàng nào được ghi (giao dịch đã cuộn lại)'
);

-- =============================================================================
-- 3. Admin sửa được, và dấu vết đi vào audit
-- =============================================================================

select is(
  public.admin_override_attendance(
    '[{"session_id":"b6000000-0000-0000-0000-000000000001",
       "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"excused","note":"Phụ huynh báo ốm"}]}]'::jsonb,
    'Phụ huynh gọi báo sau buổi học'
  ) -> 'sessions',
  '1'::jsonb,
  'Super admin sửa được, trả về đúng 1 buổi bị chạm'
);

select is(
  (select status::text from public.attendance_records
   where session_id = 'b6000000-0000-0000-0000-000000000001'
     and enrollment_id = 'b5000000-0000-0000-0000-000000000001'),
  'excused',
  'Trạng thái đã đổi từ vắng sang có phép'
);

select is(
  (select marked_by from public.attendance_records
   where session_id = 'b6000000-0000-0000-0000-000000000001'
     and enrollment_id = 'b5000000-0000-0000-0000-000000000001'),
  'b0000000-0000-0000-0000-000000000004'::uuid,
  'marked_by = auth.uid() của CHÍNH admin đang bấm (BUG_M06_01)'
);

/*
 * 🔴 VÌ SAO PHẢI CÓ BÀI NÀY: user chốt "chỉ ghi audit_logs, không thêm cột".
 * `marked_by` vừa bị ghi đè ở bài trên, nên `audit_logs.before` là chỗ DUY NHẤT
 * còn giữ được "giáo viên nào điểm danh gốc". Mất vế đó là mất hẳn.
 *
 * ⚠️ `order by created_at limit 1` KHÔNG phải để "cho chắc". Không có nó, một
 * lỗi ở nơi khác làm sinh ra dòng audit thứ hai sẽ khiến subquery nổ
 * *"more than one row"* ⇒ transaction hỏng ⇒ **20 bài phía sau không chạy nữa
 * và không ai biết**. Đã gặp thật lúc chạy kiểm ngược: cả phần nguyên tử ở mục
 * 7 im lặng biến mất khỏi kết quả. Vế "đúng MỘT dòng audit" do bài đếm ở mục 4
 * lo, không phải do subquery này lo.
 */
select is(
  (select before -> 0 ->> 'marked_by' from public.audit_logs
   where action = 'attendance.admin_override'
     and resource_id = 'b6000000-0000-0000-0000-000000000001'
   order by created_at limit 1),
  'b0000000-0000-0000-0000-000000000001',
  'audit.before còn giữ marked_by của GIÁO VIÊN gốc'
);

select is(
  (select before -> 0 ->> 'status' from public.audit_logs
   where action = 'attendance.admin_override'
     and resource_id = 'b6000000-0000-0000-0000-000000000001'
   order by created_at limit 1),
  'absent',
  'audit.before giữ đúng trạng thái cũ'
);

select is(
  (select after ->> 'reason' from public.audit_logs
   where action = 'attendance.admin_override'
     and resource_id = 'b6000000-0000-0000-0000-000000000001'
   order by created_at limit 1),
  'Phụ huynh gọi báo sau buổi học',
  'Lý do sửa được ghi lại'
);

-- =============================================================================
-- 4. IDEMPOTENCY — gửi lại y nguyên không sinh dòng audit thứ hai
-- =============================================================================

select is(
  public.admin_override_attendance(
    '[{"session_id":"b6000000-0000-0000-0000-000000000001",
       "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"excused","note":"Phụ huynh báo ốm"}]}]'::jsonb,
    'Bấm lại lần hai'
  ) -> 'sessions',
  '0'::jsonb,
  'Gửi lại y nguyên: 0 buổi bị chạm, không phải lỗi'
);

select is(
  (select count(*)::integer from public.audit_logs
   where action = 'attendance.admin_override'
     and resource_id = 'b6000000-0000-0000-0000-000000000001'),
  1,
  'Vẫn đúng MỘT dòng audit sau hai lần bấm (BUG_M09_01)'
);

-- =============================================================================
-- 5. Báo cáo ĐÃ GỬI — bản chụp được dựng lại (`D-45` vế 2, đảo `D-43` (c))
-- =============================================================================

select is(
  public.admin_override_attendance(
    '[{"session_id":"b6000000-0000-0000-0000-000000000002",
       "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"present"}]}]'::jsonb,
    'Điểm danh nhầm, em có đi học'
  ) -> 'reports_resynced',
  '1'::jsonb,
  'Sửa buổi đã có báo cáo GỬI thì dựng lại đúng 1 bản chụp'
);

select is(
  (select attendance_snapshot ->> 'absent' from public.session_reports
   where id = 'b7000000-0000-0000-0000-000000000001'),
  '0',
  'Bản chụp trong báo cáo đã ký nay đọc 0 vắng — số liệu ĐÃ ĐỔI theo điểm danh'
);

select is(
  (select attendance_snapshot -> 'revised_from' ->> 'absent' from public.session_reports
   where id = 'b7000000-0000-0000-0000-000000000001'),
  '1',
  'revised_from giữ nguyên con số LÚC GIÁO VIÊN KÝ (1 vắng)'
);

select is(
  (select attendance_snapshot ->> 'revised_by' from public.session_reports
   where id = 'b7000000-0000-0000-0000-000000000001'),
  'b0000000-0000-0000-0000-000000000004',
  'Bản chụp mang dấu vết ai sửa — bản in nói ra được, không im lặng đổi số'
);

select is(
  (select attendance_snapshot ->> 'revised_reason' from public.session_reports
   where id = 'b7000000-0000-0000-0000-000000000001'),
  'Điểm danh nhầm, em có đi học',
  'Và mang cả lý do sửa'
);

-- Sửa lần thứ hai: `revised_from` KHÔNG được trôi theo lần sửa liền trước.
select is(
  (select public.admin_override_attendance(
    '[{"session_id":"b6000000-0000-0000-0000-000000000002",
       "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000002","status":"late"}]}]'::jsonb,
    'Sửa tiếp lần hai'
  ) is not null),
  true,
  'Sửa lần hai chạy được'
);

select is(
  (select attendance_snapshot -> 'revised_from' ->> 'absent' from public.session_reports
   where id = 'b7000000-0000-0000-0000-000000000001'),
  '1',
  'Sau lần sửa thứ hai, revised_from VẪN là con số lúc ký (không trôi theo lần trước)'
);

-- =============================================================================
-- 6. Báo cáo còn NHÁP — không đụng vào bản chụp
-- =============================================================================

select is(
  public.admin_override_attendance(
    '[{"session_id":"b6000000-0000-0000-0000-000000000003",
       "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"present"}]}]'::jsonb
  ) -> 'reports_resynced',
  '0'::jsonb,
  'Báo cáo còn nháp thì KHÔNG dựng bản chụp — bản chụp chỉ sinh ra lúc gửi'
);

select is(
  (select attendance_snapshot from public.session_reports
   where id = 'b7000000-0000-0000-0000-000000000002'),
  null,
  'Bản chụp của báo cáo nháp vẫn là null'
);

-- =============================================================================
-- 7. Nhiều buổi trong MỘT lượt, và cả lô cùng sống cùng chết
-- =============================================================================

select is(
  public.admin_override_attendance(
    '[{"session_id":"b6000000-0000-0000-0000-000000000001",
       "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000002","status":"late"}]},
      {"session_id":"b6000000-0000-0000-0000-000000000003",
       "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000002","status":"absent"}]}]'::jsonb
  ) -> 'sessions',
  '2'::jsonb,
  'Hai buổi trong một lượt gọi, cả hai cùng vào'
);

/*
 * 🔴 NGUYÊN TỬ: buổi hợp lệ đứng TRƯỚC, buổi hỏng đứng SAU. Nếu hàm ghi từng
 * buổi rồi mới nổ thì buổi đầu đã kịp vào DB — bài này bắt đúng chuyện đó.
 */
select throws_ok(
  $$select public.admin_override_attendance(
      '[{"session_id":"b6000000-0000-0000-0000-000000000001",
         "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000001","status":"absent"}]},
        {"session_id":"b6000000-0000-0000-0000-000000000001",
         "records":[{"enrollment_id":"b5000000-0000-0000-0000-000000000003","status":"present"}]}]'::jsonb)$$,
  'Học viên không thuộc lớp của buổi học này',
  'Một buổi hỏng thì cả lô cuộn lại'
);

select is(
  (select status::text from public.attendance_records
   where session_id = 'b6000000-0000-0000-0000-000000000001'
     and enrollment_id = 'b5000000-0000-0000-0000-000000000001'),
  'excused',
  'Buổi hợp lệ đứng trước KHÔNG bị ghi (vẫn là "có phép", không thành "vắng")'
);

select * from finish();

rollback;
