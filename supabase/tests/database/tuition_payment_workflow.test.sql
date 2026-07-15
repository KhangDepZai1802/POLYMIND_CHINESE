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
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.payment-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'teacher.payment-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'student.payment-test@polymind.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', '', '', '', '');

insert into public.profiles (id, role, full_name, email)
values
  ('c0000000-0000-0000-0000-000000000001', 'super_admin', 'Admin thanh toán', 'admin.payment-test@polymind.test'),
  ('c0000000-0000-0000-0000-000000000002', 'teacher', 'Giáo viên không xem thanh toán', 'teacher.payment-test@polymind.test'),
  ('c0000000-0000-0000-0000-000000000003', 'student', 'Học viên đóng học phí', 'student.payment-test@polymind.test');

insert into public.students (id, user_id, student_code, full_name)
values (
  'c1000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000003',
  'HV-PAY-01',
  'Học viên đóng học phí'
);

create temporary table test_invoice_ids (invoice_id uuid primary key);
create temporary table test_payment_ids (payment_id uuid primary key);
grant select, insert, update, delete on test_invoice_ids to authenticated;
grant select, insert, update, delete on test_payment_ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into test_invoice_ids (invoice_id)
select public.save_tuition_invoice(
  'c1000000-0000-0000-0000-000000000001',
  '2026-07-15',
  0,
  '[{"description":"Học phí toàn khóa","quantity":1,"unit_amount":1000000}]'::jsonb
);

select throws_ok(
  format(
    $$select public.record_tuition_payment(%L, 100000, 'cash', '2026-07-15 01:00+00')$$,
    (select invoice_id from test_invoice_ids)
  ),
  'P0001',
  'Hóa đơn chưa phát hành — không thể ghi nhận thanh toán',
  'Không ghi payment cho invoice draft'
);

select lives_ok(
  format('select public.issue_tuition_invoice(%L)', (select invoice_id from test_invoice_ids)),
  'Phát hành invoice trước khi thanh toán'
);

insert into test_payment_ids (payment_id)
select public.record_tuition_payment(
  (select invoice_id from test_invoice_ids),
  400000,
  'bank_transfer',
  '2026-07-15 02:30+00',
  'VCB-TEST-001',
  'Thu đợt 1'
);

select ok((select payment_id is not null from test_payment_ids), 'RPC trả payment id');
select matches((select payment_code from public.tuition_payments where id = (select payment_id from test_payment_ids)), '^TT[0-9]{4}-[0-9]{6}$', 'Payment code sinh bằng sequence');
select is((select amount from public.tuition_payments where id = (select payment_id from test_payment_ids)), 400000::numeric, 'Lưu đúng số tiền thanh toán');
select is((select method from public.tuition_payments where id = (select payment_id from test_payment_ids)), 'bank_transfer'::public.payment_method, 'Lưu đúng phương thức');
select is((select reference from public.tuition_payments where id = (select payment_id from test_payment_ids)), 'VCB-TEST-001', 'Lưu mã tham chiếu');
select is((select recorded_by from public.tuition_payments where id = (select payment_id from test_payment_ids)), 'c0000000-0000-0000-0000-000000000001'::uuid, 'recorded_by là actor thật');
select is((select status from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 'partial'::public.invoice_status, 'Thanh toán đợt 1 chuyển invoice sang partial');
select is((select balance from public.v_tuition_balance where invoice_id = (select invoice_id from test_invoice_ids)), 600000::numeric, 'View tính đúng số dư sau đợt 1');
select is((select count(*)::int from public.tuition_receipts where payment_id = (select payment_id from test_payment_ids)), 1, 'Payment đợt 1 sinh đúng một receipt');
select matches((select receipt_code from public.tuition_receipts where payment_id = (select payment_id from test_payment_ids)), '^PT[0-9]{4}-[0-9]{6}$', 'Receipt code sinh bằng sequence');
select is((select issued_by from public.tuition_receipts where payment_id = (select payment_id from test_payment_ids)), 'c0000000-0000-0000-0000-000000000001'::uuid, 'issued_by là actor thật');
select is((select snapshot->>'amount' from public.tuition_receipts where payment_id = (select payment_id from test_payment_ids)), '400000', 'Receipt snapshot giữ số tiền đợt 1');
select is((select count(*)::int from public.notifications where user_id = 'c0000000-0000-0000-0000-000000000003' and resource_type = 'tuition_payment'), 1, 'Thanh toán đợt 1 sinh notification');
select is((select count(*)::int from public.audit_logs where resource_id = (select invoice_id from test_invoice_ids) and action = 'tuition.record_payment'), 1, 'Thanh toán đợt 1 có audit');

insert into test_payment_ids (payment_id)
select public.record_tuition_payment(
  (select invoice_id from test_invoice_ids),
  600000,
  'cash',
  '2026-07-16 03:00+00',
  null,
  'Thu đủ'
);

select is((select count(*)::int from test_payment_ids), 2, 'RPC tạo payment đợt 2');
select is((select status from public.tuition_invoices where id = (select invoice_id from test_invoice_ids)), 'paid'::public.invoice_status, 'Thu đủ chuyển invoice sang paid');
select is((select count(*)::int from public.tuition_payments where invoice_id = (select invoice_id from test_invoice_ids)), 2, 'Invoice có đúng hai payment');
select is((select count(*)::int from public.tuition_receipts where payment_id in (select payment_id from test_payment_ids)), 2, 'Hai payment có đúng hai receipt');
select is(
  (
    select count(*)::int
    from test_payment_ids payment
    where (select count(*) from public.tuition_receipts receipt where receipt.payment_id = payment.payment_id) <> 1
  ),
  0,
  'Mọi payment đều có chính xác một receipt'
);
select is((select balance from public.v_tuition_balance where invoice_id = (select invoice_id from test_invoice_ids)), 0::numeric, 'Thu đủ đưa balance về 0');
select is((select count(*)::int from public.notifications where user_id = 'c0000000-0000-0000-0000-000000000003' and resource_type = 'tuition_payment'), 2, 'Hai payment sinh hai notification riêng');
select is((select count(*)::int from public.audit_logs where resource_id = (select invoice_id from test_invoice_ids) and action = 'tuition.record_payment'), 2, 'Hai payment có hai audit event');

select throws_ok(
  format(
    $$select public.record_tuition_payment(%L, 1, 'cash', '2026-07-17 01:00+00')$$,
    (select invoice_id from test_invoice_ids)
  ),
  'P0001',
  'Hóa đơn đã thanh toán đủ',
  'Không thu thêm invoice đã paid'
);
select is((select count(*)::int from public.tuition_payments where invoice_id = (select invoice_id from test_invoice_ids)), 2, 'Lần thu bị từ chối không sinh payment rác');
select ok(not has_table_privilege('authenticated', 'public.tuition_payments', 'INSERT'), 'authenticated không INSERT payment trực tiếp');

set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.tuition_payments), 0, 'Giáo viên đọc trực tiếp được 0 payment');
select throws_ok(
  format(
    $$select public.record_tuition_payment(%L, 1, 'cash', '2026-07-17 01:00+00')$$,
    (select invoice_id from test_invoice_ids)
  ),
  'P0001',
  'Chỉ quản trị viên được ghi nhận thanh toán',
  'Giáo viên gọi RPC payment bị từ chối fail-closed'
);

set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.tuition_payments), 2, 'Học viên đọc được payment của chính mình');
select is((select count(*)::int from public.tuition_receipts), 2, 'Học viên đọc được receipt của chính mình');
select throws_ok(
  format(
    $$select public.record_tuition_payment(%L, 1, 'cash', '2026-07-17 01:00+00')$$,
    (select invoice_id from test_invoice_ids)
  ),
  'P0001',
  'Chỉ quản trị viên được ghi nhận thanh toán',
  'Học viên không tự ghi nhận thanh toán'
);

reset role;

select * from finish();
rollback;
