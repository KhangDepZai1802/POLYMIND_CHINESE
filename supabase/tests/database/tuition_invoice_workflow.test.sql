begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

-- --- Dữ liệu nền -------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.tuition-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'teacher.tuition-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'student.tuition-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'other.tuition-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('b0000000-0000-0000-0000-000000000001', 'super_admin', 'Admin học phí', 'admin.tuition-test@polymind.test'),
  ('b0000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên không xem học phí', 'teacher.tuition-test@polymind.test'),
  ('b0000000-0000-0000-0000-000000000003', 'student', 'Học viên nhận hóa đơn', 'student.tuition-test@polymind.test'),
  ('b0000000-0000-0000-0000-000000000004', 'student', 'Học viên khác', 'other.tuition-test@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'HV-TUI-01', 'Học viên nhận hóa đơn'),
  ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'HV-TUI-02', 'Học viên khác');

insert into public.courses (id, code, title, course_type, status)
values ('b2000000-0000-0000-0000-000000000001', 'TEST-TUI', 'Khóa kiểm tra học phí', 'custom', 'active');

insert into public.classes (
  id, code, course_id, name, capacity, delivery_mode, status
)
values (
  'b3000000-0000-0000-0000-000000000001', 'LOP-TUI',
  'b2000000-0000-0000-0000-000000000001', 'Lớp kiểm tra học phí',
  10, 'offline', 'planned'
);

insert into public.enrollments (id, student_id, class_id, status)
values (
  'b4000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'b3000000-0000-0000-0000-000000000001',
  'active'
);

create temporary table test_invoice_ids (invoice_id uuid primary key);
grant select, insert, update, delete on test_invoice_ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select public.save_tuition_invoice('b1000000-0000-0000-0000-000000000002', '2026-07-15', 0, '[{"description":"Sai ghi danh","quantity":1,"unit_amount":1000}]'::jsonb, null, 'b4000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'Ghi danh không thuộc học viên đã chọn',
  'DB chặn enrollment không thuộc học viên'
);
select throws_ok(
  $$select public.save_tuition_invoice('b1000000-0000-0000-0000-000000000001', '2026-07-15', 2000, '[{"description":"Giảm quá mức","quantity":1,"unit_amount":1000}]'::jsonb)$$,
  'P0001',
  'Giảm trừ không được vượt tạm tính',
  'DB chặn discount vượt subtotal'
);
select throws_ok(
  $$select public.save_tuition_invoice('b1000000-0000-0000-0000-000000000001', '2026-07-15', 0, '[{"description":"Sai hạn","quantity":1,"unit_amount":1000}]'::jsonb, null, null, '2026-07-01')$$,
  'P0001',
  'Hạn thanh toán không được trước ngày lập hóa đơn',
  'DB chặn due_date trước issue_date'
);

insert into test_invoice_ids (invoice_id)
select public.save_tuition_invoice(
  'b1000000-0000-0000-0000-000000000001',
  '2026-07-15',
  50000,
  '[{"description":"Học phí","quantity":2,"unit_amount":100000},{"description":"Giáo trình","quantity":1,"unit_amount":150000,"line_total":1}]'::jsonb,
  null,
  'b4000000-0000-0000-0000-000000000001',
  '2026-07-31',
  'Học phí tháng 7'
);

select ok((select invoice_id is not null from test_invoice_ids), 'RPC tạo hóa đơn và trả id');
select matches((select invoice_code from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), '^HD[0-9]{4}-[0-9]{6}$', 'Mã hóa đơn sinh bằng sequence');
select is((select created_by from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 'b0000000-0000-0000-0000-000000000001'::uuid, 'created_by là actor thật');
select is((select subtotal from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 350000::numeric, 'DB tính subtotal từ items');
select is((select discount from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 50000::numeric, 'DB lưu giảm trừ hợp lệ');
select is((select total from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 300000::numeric, 'DB tính total = subtotal - discount');
select is((select class_id from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 'b3000000-0000-0000-0000-000000000001'::uuid, 'class_id lấy từ enrollment');
select is((select count(*)::int from public.tuition_invoice_items where invoice_id = (select invoice_id from test_invoice_ids)), 2, 'Tạo đủ khoản mục trong cùng transaction');
select is((select line_total from public.tuition_invoice_items where invoice_id = (select invoice_id from test_invoice_ids) and description = 'Giáo trình'), 150000::numeric, 'line_total do DB tính, không tin giá trị client khai');
select is((select count(*)::int from public.audit_logs where resource_id = (select invoice_id from test_invoice_ids) and action = 'tuition.invoice.create'), 1, 'Tạo hóa đơn có audit');
select ok(not has_table_privilege('authenticated', 'public.tuition_invoices', 'UPDATE'), 'authenticated không sửa invoice trực tiếp');

-- Draft phải vô hình với học viên ở tầng RLS.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.tuition_invoices), 0, 'Học viên không thấy hóa đơn draft của mình');
select is((select count(*)::int from public.tuition_invoice_items), 0, 'Học viên không thấy items của hóa đơn draft');

-- Cập nhật draft thay toàn bộ items và tính lại tổng.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  format(
    $$select public.save_tuition_invoice('b1000000-0000-0000-0000-000000000001', '2026-07-16', 0, '[{"description":"Học phí cập nhật","quantity":1,"unit_amount":200000}]'::jsonb, %L, 'b4000000-0000-0000-0000-000000000001', '2026-08-01', '')$$,
    (select invoice_id from test_invoice_ids)
  ),
  'RPC cập nhật hóa đơn draft chạy thành công'
);
select is((select subtotal from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 200000::numeric, 'Cập nhật tính lại subtotal');
select is((select count(*)::int from public.tuition_invoice_items where invoice_id = (select invoice_id from test_invoice_ids)), 1, 'Cập nhật thay items cũ nguyên tử');
select is((select count(*)::int from public.audit_logs where resource_id = (select invoice_id from test_invoice_ids) and action = 'tuition.invoice.update'), 1, 'Cập nhật hóa đơn có audit');

select lives_ok(
  format('select public.issue_tuition_invoice(%L)', (select invoice_id from test_invoice_ids)),
  'RPC phát hành hóa đơn chạy thành công'
);
select is((select status from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 'issued'::public.invoice_status, 'Phát hành đổi trạng thái sang issued');
select is((select count(*)::int from public.notifications where user_id = 'b0000000-0000-0000-0000-000000000003' and dedupe_key = format('invoice_new:%s', (select invoice_id from test_invoice_ids))), 1, 'Phát hành sinh đúng một notification');
select is((select count(*)::int from public.audit_logs where resource_id = (select invoice_id from test_invoice_ids) and action = 'tuition.invoice.issue'), 1, 'Phát hành hóa đơn có audit');
select lives_ok(
  format('select public.issue_tuition_invoice(%L)', (select invoice_id from test_invoice_ids)),
  'Phát hành lặp lại không lỗi'
);
select is((select count(*)::int from public.notifications where user_id = 'b0000000-0000-0000-0000-000000000003' and dedupe_key = format('invoice_new:%s', (select invoice_id from test_invoice_ids))), 1, 'Phát hành lặp không sinh notification trùng');
select throws_ok(
  format(
    $$select public.save_tuition_invoice('b1000000-0000-0000-0000-000000000001', '2026-07-16', 0, '[{"description":"Sửa sau phát hành","quantity":1,"unit_amount":1}]'::jsonb, %L)$$,
    (select invoice_id from test_invoice_ids)
  ),
  'P0001',
  'Chỉ hóa đơn nháp mới được chỉnh sửa',
  'Hóa đơn đã phát hành không sửa được'
);
select throws_ok(
  format('select public.delete_tuition_invoice_draft(%L)', (select invoice_id from test_invoice_ids)),
  'P0001',
  'Chỉ hóa đơn nháp mới được xóa',
  'Hóa đơn đã phát hành không hard-delete được'
);

-- Giáo viên không đọc và không gọi được RPC học phí.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.save_tuition_invoice('b1000000-0000-0000-0000-000000000001', '2026-07-15', 0, '[{"description":"Trái phép","quantity":1,"unit_amount":1}]'::jsonb)$$,
  'P0001',
  'Chỉ quản trị viên được quản lý hóa đơn',
  'Giáo viên bị RPC từ chối fail-closed'
);
select is((select count(*)::int from public.tuition_invoices), 0, 'Giáo viên đọc trực tiếp được 0 hóa đơn');

-- Học viên chỉ đọc hóa đơn đã phát hành của chính mình.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.tuition_invoices), 1, 'Học viên thấy hóa đơn đã phát hành của mình');
select is((select count(*)::int from public.tuition_invoice_items), 1, 'Học viên thấy items của hóa đơn đã phát hành');
select throws_ok(
  $$select public.issue_tuition_invoice('00000000-0000-0000-0000-000000000000')$$,
  'P0001',
  'Chỉ quản trị viên được phát hành hóa đơn',
  'Học viên không tự phát hành hóa đơn'
);

set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.tuition_invoices), 0, 'Học viên khác không thấy hóa đơn');

-- Draft chưa có lịch sử được xóa; items cascade và audit vẫn giữ.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into test_invoice_ids (invoice_id)
select public.save_tuition_invoice(
  'b1000000-0000-0000-0000-000000000002', '2026-07-15', 0,
  '[{"description":"Bản nháp sẽ xóa","quantity":1,"unit_amount":100000}]'::jsonb
);
select lives_ok(
  format(
    'select public.delete_tuition_invoice_draft(%L)',
    (select id from public.tuition_invoices where student_id = 'b1000000-0000-0000-0000-000000000002')
  ),
  'Xóa hóa đơn draft chạy thành công'
);
select is((select count(*)::int from public.tuition_invoices), 1, 'Xóa draft không ảnh hưởng hóa đơn đã phát hành');
select is((select count(*)::int from public.audit_logs where action = 'tuition.invoice.delete_draft'), 1, 'Xóa draft có audit');

reset role;

select * from finish();
rollback;
