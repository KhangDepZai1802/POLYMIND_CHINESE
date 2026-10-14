begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(35);
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('77000000-0000-4000-8000-000000000001','authenticated','authenticated','schedule-manager@example.test',now(),now()),
('77000000-0000-4000-8000-000000000002','authenticated','authenticated','schedule-teacher@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('77000000-0000-4000-8000-000000000001','academic_manager','TEST SCHEDULE MANAGER',true),
('77000000-0000-4000-8000-000000000002','teacher','TEST SCHEDULE TEACHER',true);
insert into public.teachers(id,user_id) values('77000000-0000-4000-8000-000000000003','77000000-0000-4000-8000-000000000002');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('77000000-0000-4000-8000-000000000004','TEST SCHEDULE TEACHER','77000000-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,program_slug,name,teacher_name,start_date) values
('77000000-0000-4000-8000-000000000010','tieng-anh','TEST SCHEDULE A','TEST SCHEDULE TEACHER','2026-01-05'),
('77000000-0000-4000-8000-000000000011','tieng-anh','TEST SCHEDULE B','NO MATCH','2026-01-05');
create temp table schedule_ctx(payload jsonb,result jsonb);grant all on schedule_ctx to authenticated;
insert into schedule_ctx(payload) values('{"class_id":"77000000-0000-4000-8000-000000000010","request_id":"77000000-0000-4000-8000-000000000050","weekdays":[3,1,3],"start_time":"10:00","end_time":"11:00","date_from":"2026-01-05","date_to":"2026-01-14","room_name":"TEST-SCHEDULE-ROOM-UNIQUE"}');
select ok((select relrowsecurity from pg_class where oid='public.b2c_class_schedules'::regclass),'Rules RLS enabled');
select ok(not has_table_privilege('authenticated','public.b2c_class_schedules','INSERT'),'No direct rule writes');
select ok(not has_function_privilege('anon','public.generate_b2c_class_schedule(jsonb)','EXECUTE'),'Anonymous cannot generate');
select set_config('request.jwt.claims','{"sub":"77000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update schedule_ctx set result=public.generate_b2c_class_schedule(payload);
select is((select (result->>'created')::int from schedule_ctx),4,'Generates inclusive Monday/Wednesday range');
select is((select weekdays from public.b2c_class_schedules where class_id='77000000-0000-4000-8000-000000000010'),array[1,3],'Sorted unique weekdays');
select is((select min(starts_at) from public.b2c_class_meetings where class_id='77000000-0000-4000-8000-000000000010'),'2026-01-05T03:00:00Z'::timestamptz,'Vietnam clock converts to UTC');
select is((select count(*)::int from public.b2c_class_meetings where class_id='77000000-0000-4000-8000-000000000010' and schedule_id is not null),4,'Every generated meeting links to rule');
select is((select created_by from public.b2c_class_schedules where class_id='77000000-0000-4000-8000-000000000010'),'77000000-0000-4000-8000-000000000001'::uuid,'True actor');
select is((select count(*)::int from public.b2c_teaching_sessions where class_id='77000000-0000-4000-8000-000000000010'),0,'Generation does not create payroll');
select ok((select (public.generate_b2c_class_schedule(payload)->>'retry')::boolean from schedule_ctx),'Same request retry safe');
select is((select (public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid()))->>'created')::int from schedule_ctx),0,'New request same plan creates no duplicates');
select is((select count(*)::int from public.b2c_class_schedules where class_id='77000000-0000-4000-8000-000000000010'),1,'One rule for equivalent plan');
select throws_ok($$select public.generate_b2c_class_schedule(payload||'{"end_time":"11:30"}') from schedule_ctx$$,'P0001',null,'Request cannot change payload');
select throws_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'weekdays',jsonb_build_array())) from schedule_ctx$$,'P0001',null,'Empty weekdays rejected');
select throws_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'end_time','09:00')) from schedule_ctx$$,'P0001',null,'Reverse clock rejected');
select throws_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'date_to','2027-01-07')) from schedule_ctx$$,'P0001',null,'Unbounded range rejected');
select throws_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'date_from','2026-01-01')) from schedule_ctx$$,'P0001',null,'Before opening rejected');
select throws_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'date_from','2026-01-06','date_to','2026-01-06')) from schedule_ctx$$,'P0001',null,'No matching dates rejected');
select throws_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'class_id','77000000-0000-4000-8000-000000000011','date_to','2026-01-21')) from schedule_ctx$$,'P0001',null,'Room clash aborts entire generation');
select is((select count(*)::int from public.b2c_class_schedules where class_id='77000000-0000-4000-8000-000000000011'),0,'Room failure rolls back rule');
select is((select count(*)::int from public.b2c_class_meetings where class_id='77000000-0000-4000-8000-000000000011'),0,'Room failure rolls back meetings');
select throws_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'start_time','10:30','end_time','11:30','room_name','OTHER ROOM')) from schedule_ctx$$,'P0001',null,'Same-class overlaps rejected across rooms');
select lives_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'class_id','77000000-0000-4000-8000-000000000011','start_time','11:00','end_time','12:00')) from schedule_ctx$$,'Adjacent same-room meetings allowed');
select lives_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid(),'class_id','77000000-0000-4000-8000-000000000011','room_name','')) from schedule_ctx$$,'Unassigned room allowed');
select throws_ok($$select public.write_b2c_class_workspace('save_meeting',jsonb_build_object('class_id','77000000-0000-4000-8000-000000000010','request_id',gen_random_uuid(),'id',id,'starts_at',starts_at+interval '1 hour','ends_at',ends_at+interval '1 hour','expected_updated_at',updated_at,'status','planned')) from public.b2c_class_meetings where class_id='77000000-0000-4000-8000-000000000010' limit 1$$,'P0001',null,'Generated original time preserved for retry safety');
reset role;
update public.b2c_class_meetings set status='cancelled' where class_id='77000000-0000-4000-8000-000000000010';
set local role authenticated;
select lives_ok($$select public.generate_b2c_class_schedule(payload||jsonb_build_object('request_id',gen_random_uuid())) from schedule_ctx$$,'Regeneration preserves cancelled meetings');
select is((select count(*)::int from public.b2c_class_meetings where class_id='77000000-0000-4000-8000-000000000010' and status='cancelled'),4,'Cancelled meetings never resurrected');
reset role;
select throws_ok($$insert into public.b2c_class_meetings(request_id,class_id,starts_at,ends_at,room_name,created_by,updated_by) values(gen_random_uuid(),'77000000-0000-4000-8000-000000000010','2026-01-05T11:15:00+07','2026-01-05T11:45:00+07',' test-schedule-room-unique ','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001')$$,'23P01',null,'Room exclusion normalizes case and whitespace even for direct writes');
insert into public.b2c_class_meetings(request_id,class_id,starts_at,ends_at,status,created_by,updated_by) values
(gen_random_uuid(),'77000000-0000-4000-8000-000000000010',((now() at time zone 'Asia/Ho_Chi_Minh')::date+time '09:00') at time zone 'Asia/Ho_Chi_Minh',((now() at time zone 'Asia/Ho_Chi_Minh')::date+time '10:00') at time zone 'Asia/Ho_Chi_Minh','cancelled','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001'),
(gen_random_uuid(),'77000000-0000-4000-8000-000000000011',((now() at time zone 'Asia/Ho_Chi_Minh')::date+time '09:00') at time zone 'Asia/Ho_Chi_Minh',((now() at time zone 'Asia/Ho_Chi_Minh')::date+time '10:00') at time zone 'Asia/Ho_Chi_Minh','planned','77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"77000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.generate_b2c_class_schedule(payload) from schedule_ctx$$,'42501',null,'Teacher cannot generate');
select is((select count(*)::int from public.b2c_class_schedules),0,'Teacher cannot read raw rules');
select ok(public.read_my_b2c_classes('77000000-0000-4000-8000-000000000010','schedule')->'rows'->0 ? 'room_name','Assigned teacher receives room projection');
select is(jsonb_array_length(public.read_my_b2c_today()->'rows'),1,'Today shows only assigned class meetings');
select is(public.read_my_b2c_today()->'rows'->0->>'status','cancelled','Today preserves cancelled meeting status');
select ok((public.read_my_b2c_today()->'override_class_ids') ? '77000000-0000-4000-8000-000000000010','Actual meeting suppresses weekly fallback');
select ok(not(public.read_my_b2c_today()->'rows'->0 ?| array['hourly_rate','paid_amount','balance']),'Today projection has no financial fields');
reset role;
select * from finish();
rollback;
