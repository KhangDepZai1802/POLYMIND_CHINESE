begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- =============================================================================
-- GATE `GIAOVU-1`: role thứ 4 `academic_manager` ("Giáo vụ").
--
-- Quyết định `D-2` (user chốt 2026-08-03): mọi quyền QUẢN LÝ của admin + mọi
-- quyền giáo viên, TRỪ quản trị tài khoản và đọc audit.
--
-- Bài kiểm này chạy bằng chính JWT của giáo vụ và quét THẲNG bảng. Ẩn menu
-- không tính là phân quyền (`D-13`) — nếu RLS mở thì gõ URL là vào được.
--
-- Ba vế dễ hỏng nhất, mỗi vế có bài riêng bên dưới:
--   1. `my_teacher_id()` phải nhận role mới, nếu không nhánh menu "Lớp được
--      phân công" hiện ra nhưng mọi trang bên trong đều rỗng.
--   2. `audit_logs` + đường ghi `profiles` phải VẪN đóng — đó là đúng hai thứ
--      user loại ra khỏi role này.
--   3. Flashcard và ngân hàng câu hỏi phải VẪN đóng (user chốt điểm 3).
-- =============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'gv.vu@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'gv.thuong@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'hv.gv1@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'gv.khoa@polymind.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '');

-- `Giáo vụ Khoá` sinh ra đã bị khoá sẵn (`is_active = false`) chứ không khoá
-- bằng `update` về sau: `trg_profiles_no_self_escalation` chặn mọi lệnh đổi
-- `is_active` khi `request.jwt.claims` khác null — kể cả lệnh do `postgres`
-- chạy. Trigger chỉ gác UPDATE nên INSERT thẳng trạng thái là đường sạch.
insert into public.profiles (id, role, full_name, email, is_active)
values
  ('c0000000-0000-0000-0000-000000000001', 'academic_manager', 'Giáo vụ Vũ',      'gv.vu@polymind.test',     true),
  ('c0000000-0000-0000-0000-000000000002', 'teacher',          'Giáo viên Thương','gv.thuong@polymind.test', true),
  ('c0000000-0000-0000-0000-000000000003', 'student',          'Học viên Một',    'hv.gv1@polymind.test',    true),
  ('c0000000-0000-0000-0000-000000000004', 'academic_manager', 'Giáo vụ Khoá',    'gv.khoa@polymind.test',   false);

-- Điểm (2) của `D-2`: giáo vụ LUÔN có hàng `teachers` ngay khi tạo tài khoản,
-- để tự phân công chính mình mà không phải nhờ super admin.
insert into public.teachers (id, user_id, teacher_code)
values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'GV-VU'),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'GV-THUONG'),
  ('c1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'GV-KHOA');

insert into public.students (id, user_id, student_code, full_name)
values ('c4000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'HV-GV-1', 'Học viên Một');

insert into public.courses (id, code, title, course_type, status)
values ('c2000000-0000-0000-0000-000000000001', 'TEST-GIAOVU', 'Khoá kiểm giáo vụ', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, planned_session_count,
  session_duration_minutes, start_date, delivery_mode, status
)
values ('c3000000-0000-0000-0000-000000000001', 'TEST-GIAOVU-01',
        'c2000000-0000-0000-0000-000000000001', 'Lớp kiểm giáo vụ',
        10, 10, 90, date '2026-08-10', 'offline', 'planned');

-- Hai bảng thuộc điểm (3) — giáo vụ KHÔNG được thấy. Phải có dữ liệu thật,
-- không thì bài "đếm bằng 0" xanh vì bảng rỗng chứ không vì RLS.
-- `trg_flashcard_decks_actor` ép `created_by := auth.uid()` và ném lỗi khi null,
-- nên phải có JWT sẵn ngay từ lúc dựng fixture. Vẫn đang ở role `postgres`
-- (bỏ qua RLS) — claim này chỉ để trigger có người tạo.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

insert into public.flashcard_decks (id, course_id, title, code)
values ('c5000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',
        'Bộ thẻ kiểm giáo vụ', 'test-giaovu');

insert into public.questions (id, owner_id, title, skill, created_by)
values ('c6000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
        'Câu hỏi kiểm giáo vụ', 'vocabulary', 'c0000000-0000-0000-0000-000000000002');

insert into public.tuition_invoices (id, invoice_code, student_id, subtotal, total)
values ('c7000000-0000-0000-0000-000000000001', 'HD-TEST-GIAOVU',
        'c4000000-0000-0000-0000-000000000003', 1000000, 1000000);

insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id)
values ('c0000000-0000-0000-0000-000000000002', 'teacher', 'test.giaovu', 'class',
        'c3000000-0000-0000-0000-000000000001');

-- =============================================================================
-- 1–5. Helper `app.is_manager()` và `app.my_teacher_id()`
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select ok(app.is_manager(), '✅ giáo vụ ⇒ is_manager() = true');

select is(
  app.my_teacher_id(),
  'c1000000-0000-0000-0000-000000000001'::uuid,
  '✅ my_teacher_id() NHẬN role academic_manager — vế quyết định nhánh menu "Lớp được phân công" có chạy hay không'
);

set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(not app.is_manager(), '🔒 giáo viên thường ⇒ is_manager() = false');

set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select ok(not app.is_manager(), '🔒 học viên ⇒ is_manager() = false');

-- Fail-closed: khoá tài khoản là mất quyền ngay, không có nhánh nào cứu.
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select ok(not app.is_manager(), '🔒 giáo vụ bị KHOÁ tài khoản ⇒ is_manager() = false (fail-closed)');

-- =============================================================================
-- 6–13. Quyền QUẢN LÝ — phải CÓ
-- =============================================================================

set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::integer from public.students where student_code = 'HV-GV-1'),
  1,
  '✅ giáo vụ đọc được hồ sơ học viên'
);

select is(
  (select full_name from public.profiles where id = 'c0000000-0000-0000-0000-000000000003'),
  'Học viên Một',
  '✅ giáo vụ ĐỌC được profiles (cần để dựng mọi danh sách người)'
);

select is(
  (select count(*)::integer from public.tuition_invoices where invoice_code = 'HD-TEST-GIAOVU'),
  1,
  '✅ giáo vụ đọc được học phí'
);

select lives_ok(
  $$insert into public.classes (
      code, course_id, name, capacity, planned_session_count,
      session_duration_minutes, start_date, delivery_mode, status
    ) values ('TEST-GIAOVU-02', 'c2000000-0000-0000-0000-000000000001', 'Lớp do giáo vụ tạo',
              10, 10, 90, date '2026-08-11', 'offline', 'planned')$$,
  '✅ giáo vụ TẠO được lớp học'
);

-- Yêu cầu gốc của user, nguyên văn: "quản lí/phân bổ các giáo viên về các lớp
-- (kể cả bản thân)". Hai bài dưới đây là chỗ đo đúng câu đó.
select lives_ok(
  $$insert into public.class_teachers (class_id, teacher_id)
    values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002')$$,
  '✅ giáo vụ phân công GIÁO VIÊN KHÁC vào lớp'
);

reset role;
delete from public.class_teachers where class_id = 'c3000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$insert into public.class_teachers (class_id, teacher_id)
    values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001')$$,
  '✅ giáo vụ tự phân công CHÍNH MÌNH vào lớp ("kể cả bản thân")'
);

select ok(
  app.teaches_class('c3000000-0000-0000-0000-000000000001'),
  '✅ phân công xong thì teaches_class() = true — nhánh menu 2 có dữ liệu thật, không phải trang rỗng'
);

select lives_ok(
  $$update public.teachers set specialization = 'HSK 5'
    where id = 'c1000000-0000-0000-0000-000000000002'$$,
  '✅ giáo vụ SỬA được hồ sơ giáo viên'
);

-- =============================================================================
-- RPC nghiệp vụ (`…088`)
--
-- ⚠️ Vì sao mở RLS thôi là KHÔNG đủ, và vì sao bốn bài này đáng có:
-- phần lớn thao tác ghi của hệ này đi qua RPC `security definer`, mà
-- `security definer` chạy dưới quyền chủ hàm nên RLS không với tới. Mỗi RPC tự
-- gác bằng `is_super_admin()` trong thân hàm. Nếu chỉ sửa policy mà quên thân
-- hàm thì giáo vụ vào đủ 9 trang, thấy đủ dữ liệu, và bấm nút nào cũng bị từ
-- chối — hỏng theo kiểu trang trông vẫn bình thường.
-- =============================================================================

select lives_ok(
  $$select public.generate_class_sessions('c3000000-0000-0000-0000-000000000001')$$,
  '✅ giáo vụ gọi được generate_class_sessions (module Lịch học)'
);

select lives_ok(
  $$select public.enroll_student(
      'c4000000-0000-0000-0000-000000000003',
      'c3000000-0000-0000-0000-000000000001',
      'active', 'Giáo vụ ghi danh')$$,
  '✅ giáo vụ gọi được enroll_student (module Học viên)'
);

select lives_ok(
  $$select public.save_announcement('Thông báo của giáo vụ', 'Nội dung', null, null, null)$$,
  '✅ giáo vụ gọi được save_announcement (module Thông báo)'
);

select lives_ok(
  $$select public.save_tuition_invoice(
      'c4000000-0000-0000-0000-000000000003', current_date, 0,
      '[{"description":"Học phí","quantity":1,"unit_amount":1000000}]'::jsonb,
      null, null, null, null)$$,
  '✅ giáo vụ gọi được save_tuition_invoice (module Học phí)'
);

-- =============================================================================
-- 14–21. Quyền QUẢN TRỊ — phải KHÔNG
-- =============================================================================

select is(
  (select count(*)::integer from public.audit_logs),
  0,
  '🔒 giáo vụ KHÔNG đọc được audit_logs (dù có 1 dòng thật trong bảng)'
);

-- `teachers.user_id` là `not null references auth.users` ⇒ INSERT ở đây chính
-- là tạo tài khoản giáo viên bằng cửa sau. Đây là chỗ cưỡng chế điểm (4).
select throws_ok(
  $$insert into public.teachers (user_id, teacher_code)
    values ('c0000000-0000-0000-0000-000000000003', 'GV-CHUI')$$,
  '42501',
  null,
  '🔒 giáo vụ KHÔNG tạo được hồ sơ giáo viên (= không tạo được tài khoản qua cửa sau)'
);

-- ⚠️ INSERT và DELETE/UPDATE hỏng theo HAI kiểu khác nhau, đừng đo chung một
-- cách. INSERT vướng `with check` ⇒ **ném** 42501 (bài 15). DELETE/UPDATE thì
-- `using` chỉ **lọc hàng ra khỏi tầm nhìn** ⇒ lệnh chạy xong, báo thành công,
-- xoá/sửa 0 dòng. Nên hai bài dưới phải đo dữ liệu SAU đó; viết `throws_ok`
-- ở đây là bài luôn đỏ dù RLS đang chặn đúng.
delete from public.teachers where id = 'c1000000-0000-0000-0000-000000000002';

select is(
  (select count(*)::integer from public.teachers where id = 'c1000000-0000-0000-0000-000000000002'),
  1,
  '🔒 giáo vụ KHÔNG xoá được hồ sơ giáo viên (lệnh chạy nhưng không chạm hàng nào)'
);

update public.profiles set role = 'student'
where id = 'c0000000-0000-0000-0000-000000000002';

select is(
  (select role::text from public.profiles where id = 'c0000000-0000-0000-0000-000000000002'),
  'teacher',
  '🔒 giáo vụ KHÔNG đổi được vai trò người khác (lệnh chạy nhưng không chạm hàng nào)'
);

select throws_ok(
  $$update public.profiles set role = 'super_admin'
    where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Không được tự đổi vai trò tài khoản',
  '🔒 giáo vụ KHÔNG tự nâng mình lên super_admin'
);

select is(
  (select count(*)::integer from public.flashcard_decks),
  0,
  '🔒 giáo vụ KHÔNG thấy bộ flashcard nào (điểm 3 — Flashcard chỉ super admin)'
);

select is(
  (select count(*)::integer from public.questions),
  0,
  '🔒 giáo vụ KHÔNG thấy câu hỏi nào (điểm 3 — Duyệt câu hỏi chỉ super admin)'
);

reset role;

select * from finish();
rollback;
