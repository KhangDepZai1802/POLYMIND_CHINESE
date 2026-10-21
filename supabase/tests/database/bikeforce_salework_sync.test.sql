begin;
select plan(11);

select has_table('public', 'bikeforce_salework_snapshots', 'Có bảng snapshot SaleWork');
select row_security_active('public.bikeforce_salework_snapshots'), 'RLS được bật';
select has_pk('public', 'bikeforce_salework_snapshots', 'Có khóa chính người + ngày');
select ok(not has_table_privilege('anon', 'public.bikeforce_salework_snapshots', 'SELECT'), 'anon không đọc bảng');
select ok(has_table_privilege('authenticated', 'public.bikeforce_salework_snapshots', 'SELECT'), 'authenticated có quyền SELECT để RLS lọc manager');
select ok(not has_function_privilege('anon', 'public.upsert_bikeforce_salework_snapshot(text,date,jsonb)', 'EXECUTE'), 'anon không gọi RPC');
select ok(not has_function_privilege('authenticated', 'public.upsert_bikeforce_salework_snapshot(text,date,jsonb)', 'EXECUTE'), 'authenticated không gọi RPC');
select has_function_privilege('service_role', 'public.upsert_bikeforce_salework_snapshot(text,date,jsonb)', 'EXECUTE'), 'service_role gọi được RPC';

set local role service_role;
select lives_ok($$select public.upsert_bikeforce_salework_snapshot('co-le', '2026-10-21', '{"conversations":3,"sentMessages":4,"receivedMessages":5,"incomingCalls":6,"outgoingCalls":7,"missedCalls":1,"callDurationSeconds":120,"syncedAt":"2026-10-21T07:00:00Z"}'::jsonb)$$, 'Tạo snapshot đủ 8 trường');
select public.upsert_bikeforce_salework_snapshot('co-le', '2026-10-21', '{"conversations":8,"sentMessages":9,"receivedMessages":10,"incomingCalls":11,"outgoingCalls":12,"missedCalls":2,"callDurationSeconds":240,"syncedAt":"2026-10-21T08:00:00Z"}'::jsonb);
reset role;

select is(
  (select snapshot->'conversations' from public.bikeforce_salework_snapshots where person_slug='co-le' and work_date='2026-10-21'),
  '8'::jsonb,
  'Gửi lại thay thế snapshot, không cộng dồn'
);
select is((select count(*)::integer from public.bikeforce_salework_snapshots where person_slug='co-le' and work_date='2026-10-21'), 1, 'Chỉ có một hàng cho mỗi người và ngày');
select throws_ok($$insert into public.bikeforce_salework_snapshots(person_slug,work_date,snapshot) values('co-thy','2026-10-21','{"conversations":1}'::jsonb)$$, '23514', null, 'DB từ chối snapshot thiếu trường');
select throws_ok($$insert into public.bikeforce_salework_snapshots(person_slug,work_date,snapshot) values('co-thy','2026-10-21','{"conversations":1,"sentMessages":1,"receivedMessages":1,"incomingCalls":1,"outgoingCalls":1,"missedCalls":-1,"callDurationSeconds":1,"syncedAt":"2026-10-21T07:00:00Z"}'::jsonb)$$, '23514', null, 'DB từ chối chỉ số âm');

select * from finish();
rollback;
